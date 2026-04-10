import type { ServiceWorkerRequest, ServiceWorkerResponse, PRBranchInfo, PRReviewStatus, PRApproveResult, TagInfo } from "./lib/messages";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// In-memory map of in-flight fetches to coalesce concurrent requests for the same key
const inflight = new Map<string, Promise<unknown>>();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

async function getCached<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.session.get(key);
  const entry = result[key] as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    chrome.storage.session.remove(key);
    return null;
  }
  return entry.data;
}

async function setCache<T>(key: string, data: T): Promise<void> {
  await chrome.storage.session.set({ [key]: { data, timestamp: Date.now() } });
}

async function cachedFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = await getCached<T>(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fetcher().then(async (data) => {
    await setCache(key, data);
    return data;
  }).finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}

function getToken(): Promise<string> {
  return new Promise((resolve) => {
    chrome.storage.local.get("githubToken", (result) => {
      resolve(result.githubToken || "");
    });
  });
}

async function fetchPRBranches(
  owner: string,
  repo: string,
  state: string,
  page: number,
): Promise<PRBranchInfo[]> {
  const cacheKey = `cache:branches:${owner}/${repo}:${state}:${page}`;
  return cachedFetch<PRBranchInfo[]>(cacheKey, async () => {
    const perPage = 30;
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&page=${page}&per_page=${perPage}`;

    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`[Better GitHub] API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const pulls: Array<{ number: number; head: { ref: string } }> = await response.json();
    return pulls.map((pr) => ({
      number: pr.number,
      headRef: pr.head.ref,
    }));
  });
}

async function fetchPRReviewStatuses(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<PRReviewStatus[]> {
  if (prNumbers.length === 0) return [];

  const token = await getToken();
  if (!token) return [];

  const cacheKey = `cache:reviews:${owner}/${repo}:${prNumbers.sort().join(",")}`;
  return cachedFetch<PRReviewStatus[]>(cacheKey, async () => {
    const prQueries = prNumbers
      .map(
        (n) => `    pr_${n}: pullRequest(number: ${n}) {
      reviewThreads(first: 100) {
        totalCount
        nodes { isResolved }
      }
    }`,
      )
      .join("\n");

    const query = `query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
${prQueries}
  }
}`;

    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { owner, repo },
      }),
    });

    if (!response.ok) {
      console.error(`[Better GitHub] GraphQL error: ${response.status} ${response.statusText}`);
      return [];
    }

    const json = await response.json();
    if (json.errors) {
      console.error("[Better GitHub] GraphQL errors:", json.errors);
      return [];
    }

    const repoData = json.data?.repository;
    if (!repoData) return [];

    return prNumbers
      .map((n) => {
        const pr = repoData[`pr_${n}`];
        if (!pr) return null;
        const threads = pr.reviewThreads;
        const totalThreads = threads.totalCount;
        const resolvedThreads = (threads.nodes as Array<{ isResolved: boolean }>).filter(
          (t) => t.isResolved,
        ).length;
        return { number: n, totalThreads, resolvedThreads };
      })
      .filter((s): s is PRReviewStatus => s !== null);
  });
}

async function approvePR(
  owner: string,
  repo: string,
  prNumber: number,
  body?: string,
): Promise<PRApproveResult> {
  const token = await getToken();
  if (!token) return { success: false, error: "No token configured. Please set a GitHub token in the extension settings." };

  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "APPROVE",
        body: body || "",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const msg = (data as { message?: string }).message || `${response.status} ${response.statusText}`;
      return { success: false, error: msg };
    }

    // Fire-and-forget: invalidate review caches for this repo
    chrome.storage.session.get(null).then((all) => {
      const keys = Object.keys(all).filter((k) => k.startsWith(`cache:reviews:${owner}/${repo}:`));
      if (keys.length > 0) chrome.storage.session.remove(keys);
    }).catch(() => {});

    return { success: true };
  } catch (err) {
    console.error("[Better GitHub] Failed to approve PR:", err);
    return { success: false, error: "Network error" };
  }
}

async function fetchRepoTags(
  owner: string,
  repo: string,
): Promise<TagInfo[]> {
  const cacheKey = `cache:tags:${owner}/${repo}`;
  return cachedFetch<TagInfo[]>(cacheKey, async () => {
    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const allTags: TagInfo[] = [];
    const maxPages = 3;

    for (let page = 1; page <= maxPages; page++) {
      const url = `https://api.github.com/repos/${owner}/${repo}/tags?per_page=100&page=${page}`;
      const response = await fetch(url, { headers });

      if (!response.ok) {
        console.error(`[Better GitHub] Tags API error: ${response.status} ${response.statusText}`);
        break;
      }

      const tags: Array<{ name: string; commit: { sha: string } }> = await response.json();
      if (tags.length === 0) break;

      for (const tag of tags) {
        allTags.push({ name: tag.name, commitSha: tag.commit.sha });
      }

      if (tags.length < 100) break;
    }

    return allTags;
  });
}

async function handleMessage(request: ServiceWorkerRequest): Promise<ServiceWorkerResponse<unknown>> {
  switch (request.type) {
    case "FETCH_PR_BRANCHES":
      return { ok: true, data: await fetchPRBranches(request.owner, request.repo, request.state, request.page) };
    case "FETCH_PR_REVIEW_STATUSES":
      return { ok: true, data: await fetchPRReviewStatuses(request.owner, request.repo, request.prNumbers) };
    case "APPROVE_PR":
      return { ok: true, data: await approvePR(request.owner, request.repo, request.prNumber, request.body) };
    case "FETCH_REPO_TAGS":
      return { ok: true, data: await fetchRepoTags(request.owner, request.repo) };
    default:
      return { ok: false, error: "Unknown message type" };
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  handleMessage(request as ServiceWorkerRequest)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// Clear all cached API responses when the GitHub token changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "githubToken" in changes) {
    chrome.storage.session.clear();
  }
});
