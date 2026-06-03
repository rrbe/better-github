import type { ServiceWorkerRequest, ServiceWorkerResponse, PRBranchInfo, PRReviewStatus, ReviewThreadDetail, PRDiffStats, CommitDiffStats, PRApproveResult, TagInfo, StargazerInfo, WatcherInfo, ForkInfo } from "./lib/messages";

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
    chrome.storage.local.get<{ githubToken?: string }>("githubToken", (result) => {
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

interface GraphQLBatchSpec<K extends string | number, V> {
  cachePrefix: string;
  owner: string;
  repo: string;
  keys: K[];
  aliasFor: (k: K) => string;
  buildNodeQuery: (k: K) => string;
  parseNode: (k: K, node: Record<string, unknown>) => V | null;
}

async function fetchGraphQLBatch<K extends string | number, V>(
  spec: GraphQLBatchSpec<K, V>,
): Promise<V[]> {
  if (spec.keys.length === 0) return [];

  const token = await getToken();
  if (!token) return [];

  const cacheKey = `cache:${spec.cachePrefix}:${spec.owner}/${spec.repo}:${spec.keys.join(",")}`;
  return cachedFetch<V[]>(cacheKey, async () => {
    const entries = spec.keys
      .map((k) => `    ${spec.aliasFor(k)}: ${spec.buildNodeQuery(k)}`)
      .join("\n");

    const query = `query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
${entries}
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
        variables: { owner: spec.owner, repo: spec.repo },
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

    const repoData = json.data?.repository as Record<string, Record<string, unknown> | null> | undefined;
    if (!repoData) return [];

    const results: V[] = [];
    for (const k of spec.keys) {
      const node = repoData[spec.aliasFor(k)];
      if (!node) continue;
      const parsed = spec.parseNode(k, node);
      if (parsed !== null) results.push(parsed);
    }
    return results;
  });
}

// Per-PR cap on how many review threads we enumerate, for both the count query
// and the detail query. GraphQL can't filter reviewThreads by isResolved
// server-side, so the detail query over-fetches up to this many and drops the
// resolved ones client-side; `totalCount` keeps the badge count accurate even
// when a PR has more threads than this.
const MAX_REVIEW_THREADS = 100;

async function fetchPRReviewStatuses(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<PRReviewStatus[]> {
  return fetchGraphQLBatch<number, PRReviewStatus>({
    cachePrefix: "reviews",
    owner,
    repo,
    keys: [...prNumbers].sort((a, b) => a - b),
    aliasFor: (n) => `pr_${n}`,
    // List-page badges only need counts, so this batch query stays cheap: just
    // `totalCount` plus a per-thread `isResolved`. The heavy path/author/body
    // details are fetched lazily, one PR at a time, when a badge's popover is
    // actually opened (see fetchPRReviewThreadDetails).
    buildNodeQuery: (n) => `pullRequest(number: ${n}) {
      reviewThreads(first: ${MAX_REVIEW_THREADS}) {
        totalCount
        nodes {
          isResolved
        }
      }
    }`,
    parseNode: (n, pr) => {
      const threads = pr.reviewThreads as {
        totalCount: number;
        nodes: Array<{ isResolved: boolean }>;
      };
      const resolvedThreads = threads.nodes.filter((t) => t.isResolved).length;
      return { number: n, totalThreads: threads.totalCount, resolvedThreads };
    },
  });
}

async function fetchPRReviewThreadDetails(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewThreadDetail[]> {
  const batched = await fetchGraphQLBatch<number, ReviewThreadDetail[]>({
    cachePrefix: "reviewdetails",
    owner,
    repo,
    keys: [prNumber],
    aliasFor: (n) => `pr_${n}`,
    buildNodeQuery: (n) => `pullRequest(number: ${n}) {
      reviewThreads(first: ${MAX_REVIEW_THREADS}) {
        nodes {
          isResolved
          isOutdated
          path
          line
          originalLine
          comments(first: 1) {
            nodes {
              author { login }
              bodyText
              url
            }
          }
        }
      }
    }`,
    parseNode: (_n, pr) => {
      const threads = pr.reviewThreads as {
        nodes: Array<{
          isResolved: boolean;
          isOutdated: boolean;
          path: string | null;
          line: number | null;
          originalLine: number | null;
          comments: { nodes: Array<{ author: { login: string } | null; bodyText: string; url: string }> };
        }>;
      };
      return threads.nodes
        .filter((t) => !t.isResolved)
        .map((t) => {
          const first = t.comments?.nodes?.[0];
          return {
            path: t.path ?? "",
            // Outdated threads carry their position in `originalLine`, not `line`.
            line: t.line ?? t.originalLine ?? null,
            isOutdated: t.isOutdated,
            author: first?.author?.login ?? "",
            snippet: first?.bodyText ?? "",
            url: first?.url ?? "",
          };
        });
    },
  });
  return batched[0] ?? [];
}

async function fetchPRDiffStats(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<PRDiffStats[]> {
  return fetchGraphQLBatch<number, PRDiffStats>({
    cachePrefix: "diffstats",
    owner,
    repo,
    keys: [...prNumbers].sort((a, b) => a - b),
    aliasFor: (n) => `pr_${n}`,
    buildNodeQuery: (n) => `pullRequest(number: ${n}) {
      additions
      deletions
      changedFiles
    }`,
    parseNode: (n, pr) => ({
      number: n,
      additions: pr.additions as number,
      deletions: pr.deletions as number,
      changedFiles: pr.changedFiles as number,
    }),
  });
}

async function fetchCommitDiffStats(
  owner: string,
  repo: string,
  shas: string[],
): Promise<CommitDiffStats[]> {
  const normalized = shas
    .map((s) => s.toLowerCase())
    .filter((s) => /^[0-9a-f]{40}$/.test(s))
    .sort();

  return fetchGraphQLBatch<string, CommitDiffStats>({
    cachePrefix: "commitdiffstats",
    owner,
    repo,
    keys: normalized,
    aliasFor: (sha) => `c_${sha}`,
    buildNodeQuery: (sha) => `object(oid: "${sha}") {
      ... on Commit {
        additions
        deletions
        changedFilesIfAvailable
      }
    }`,
    parseNode: (sha, commit) => ({
      sha,
      additions: commit.additions as number,
      deletions: commit.deletions as number,
      changedFiles: (commit.changedFilesIfAvailable as number | null | undefined) ?? null,
    }),
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

    // Fire-and-forget: invalidate both review caches (counts + detail) for this repo
    chrome.storage.session.get(null).then((all) => {
      const keys = Object.keys(all).filter(
        (k) =>
          k.startsWith(`cache:reviews:${owner}/${repo}:`) ||
          k.startsWith(`cache:reviewdetails:${owner}/${repo}:`),
      );
      if (keys.length > 0) chrome.storage.session.remove(keys);
    }).catch(() => {});

    return { success: true };
  } catch (err) {
    console.error("[Better GitHub] Failed to approve PR:", err);
    return { success: false, error: "Network error" };
  }
}

async function fetchRepoTagsViaRest(
  owner: string,
  repo: string,
  token: string,
): Promise<TagInfo[]> {
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
      console.error(`[Better GitHub] Tags REST error: ${response.status} ${response.statusText}`);
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
}

async function fetchRepoTags(
  owner: string,
  repo: string,
): Promise<TagInfo[]> {
  const cacheKey = `cache:tags:${owner}/${repo}`;
  return cachedFetch<TagInfo[]>(cacheKey, async () => {
    const token = await getToken();

    // GraphQL requires auth — fall back to anonymous REST when no token is set
    if (!token) return fetchRepoTagsViaRest(owner, repo, "");

    const query = `query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    refs(refPrefix: "refs/tags/", first: 100, orderBy: {field: TAG_COMMIT_DATE, direction: DESC}) {
      nodes {
        name
        target {
          ... on Commit { oid }
          ... on Tag {
            target {
              ... on Commit { oid }
            }
          }
        }
      }
    }
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
      console.error(`[Better GitHub] Tags GraphQL error: ${response.status} ${response.statusText}`);
      return fetchRepoTagsViaRest(owner, repo, token);
    }

    const json = await response.json();
    if (json.errors) {
      console.error("[Better GitHub] Tags GraphQL errors:", json.errors);
      return fetchRepoTagsViaRest(owner, repo, token);
    }

    const nodes = json.data?.repository?.refs?.nodes as
      | Array<{ name: string; target: { oid?: string; target?: { oid?: string } } }>
      | undefined;
    if (!nodes) return [];

    const tags: TagInfo[] = [];
    for (const node of nodes) {
      const sha = node.target.oid ?? node.target.target?.oid;
      if (sha) tags.push({ name: node.name, commitSha: sha });
    }
    return tags;
  });
}

async function fetchStargazers(
  owner: string,
  repo: string,
): Promise<StargazerInfo[]> {
  const cacheKey = `cache:stargazers:${owner}/${repo}`;
  return cachedFetch<StargazerInfo[]>(cacheKey, async () => {
    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.star+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/stargazers?per_page=30`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`[Better GitHub] Stargazers API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: Array<{ user: { login: string; avatar_url: string; name?: string | null }; starred_at: string }> = await response.json();
    return data.map((item) => ({
      login: item.user.login,
      avatarUrl: item.user.avatar_url,
      name: item.user.name || null,
      starredAt: item.starred_at,
    }));
  });
}

async function fetchWatchers(
  owner: string,
  repo: string,
): Promise<WatcherInfo[]> {
  const cacheKey = `cache:watchers:${owner}/${repo}`;
  return cachedFetch<WatcherInfo[]>(cacheKey, async () => {
    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/subscribers?per_page=30`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`[Better GitHub] Watchers API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: Array<{ login: string; avatar_url: string; name?: string | null }> = await response.json();
    return data.map((user) => ({
      login: user.login,
      avatarUrl: user.avatar_url,
      name: user.name || null,
    }));
  });
}

async function fetchForks(
  owner: string,
  repo: string,
): Promise<ForkInfo[]> {
  const cacheKey = `cache:forks:${owner}/${repo}`;
  return cachedFetch<ForkInfo[]>(cacheKey, async () => {
    const token = await getToken();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/forks?sort=newest&per_page=30`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.error(`[Better GitHub] Forks API error: ${response.status} ${response.statusText}`);
      return [];
    }

    const data: Array<{ owner: { login: string; avatar_url: string }; full_name: string; description: string | null; stargazers_count: number }> = await response.json();
    return data.map((fork) => ({
      owner: fork.owner.login,
      ownerAvatarUrl: fork.owner.avatar_url,
      fullName: fork.full_name,
      description: fork.description,
      stargazersCount: fork.stargazers_count,
    }));
  });
}

async function handleMessage(request: ServiceWorkerRequest): Promise<ServiceWorkerResponse<unknown>> {
  switch (request.type) {
    case "FETCH_PR_BRANCHES":
      return { ok: true, data: await fetchPRBranches(request.owner, request.repo, request.state, request.page) };
    case "FETCH_PR_REVIEW_STATUSES":
      return { ok: true, data: await fetchPRReviewStatuses(request.owner, request.repo, request.prNumbers) };
    case "FETCH_PR_REVIEW_THREAD_DETAILS":
      return { ok: true, data: await fetchPRReviewThreadDetails(request.owner, request.repo, request.prNumber) };
    case "FETCH_PR_DIFF_STATS":
      return { ok: true, data: await fetchPRDiffStats(request.owner, request.repo, request.prNumbers) };
    case "FETCH_COMMIT_DIFF_STATS":
      return { ok: true, data: await fetchCommitDiffStats(request.owner, request.repo, request.shas) };
    case "APPROVE_PR":
      return { ok: true, data: await approvePR(request.owner, request.repo, request.prNumber, request.body) };
    case "FETCH_REPO_TAGS":
      return { ok: true, data: await fetchRepoTags(request.owner, request.repo) };
    case "FETCH_STARGAZERS":
      return { ok: true, data: await fetchStargazers(request.owner, request.repo) };
    case "FETCH_WATCHERS":
      return { ok: true, data: await fetchWatchers(request.owner, request.repo) };
    case "FETCH_FORKS":
      return { ok: true, data: await fetchForks(request.owner, request.repo) };
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
