import type { ServiceWorkerRequest, ServiceWorkerResponse, PRBranchInfo, PRReviewStatus, PRApproveResult } from "./lib/messages";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
  const cached = await getCached<PRBranchInfo[]>(cacheKey);
  if (cached) return cached;

  const perPage = 30;
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=${state}&page=${page}&per_page=${perPage}`;

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
  const data = pulls.map((pr) => ({
    number: pr.number,
    headRef: pr.head.ref,
  }));

  await setCache(cacheKey, data);
  return data;
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
  const cached = await getCached<PRReviewStatus[]>(cacheKey);
  if (cached) return cached;

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

  try {
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

    const data: PRReviewStatus[] = prNumbers
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

    await setCache(cacheKey, data);
    return data;
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch review statuses:", err);
    return [];
  }
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

    // Invalidate review caches for this repo after successful approve
    const allKeys = Object.keys(await chrome.storage.session.get(null));
    const keysToRemove = allKeys.filter((k) => k.startsWith(`cache:reviews:${owner}/${repo}:`));
    if (keysToRemove.length > 0) {
      await chrome.storage.session.remove(keysToRemove);
    }

    return { success: true };
  } catch (err) {
    console.error("[Better GitHub] Failed to approve PR:", err);
    return { success: false, error: "Network error" };
  }
}

async function handleMessage(request: ServiceWorkerRequest): Promise<ServiceWorkerResponse<unknown>> {
  switch (request.type) {
    case "FETCH_PR_BRANCHES":
      return { ok: true, data: await fetchPRBranches(request.owner, request.repo, request.state, request.page) };
    case "FETCH_PR_REVIEW_STATUSES":
      return { ok: true, data: await fetchPRReviewStatuses(request.owner, request.repo, request.prNumbers) };
    case "APPROVE_PR":
      return { ok: true, data: await approvePR(request.owner, request.repo, request.prNumber, request.body) };
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
