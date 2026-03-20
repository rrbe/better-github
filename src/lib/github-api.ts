interface PRBranchInfo {
  number: number;
  headRef: string;
}

export interface PRReviewStatus {
  number: number;
  totalThreads: number;
  resolvedThreads: number;
}

const cache = new Map<string, { data: PRBranchInfo[]; timestamp: number }>();
const reviewCache = new Map<
  string,
  { data: PRReviewStatus[]; timestamp: number }
>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getToken(): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) return resolve("");
    } catch {
      return resolve("");
    }
    chrome.storage.local.get("githubToken", (result) => {
      resolve(result.githubToken || "");
    });
  });
}

export async function fetchPRBranches(
  owner: string,
  repo: string,
  state: string = "open",
  page: number = 1
): Promise<PRBranchInfo[]> {
  const cacheKey = `${owner}/${repo}:${state}:${page}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

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
    console.error(
      `[Better GitHub] API error: ${response.status} ${response.statusText}`
    );
    return [];
  }

  const pulls: Array<{ number: number; head: { ref: string } }> =
    await response.json();
  const data = pulls.map((pr) => ({
    number: pr.number,
    headRef: pr.head.ref,
  }));

  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export async function fetchPRReviewStatuses(
  owner: string,
  repo: string,
  prNumbers: number[]
): Promise<PRReviewStatus[]> {
  if (prNumbers.length === 0) return [];

  const token = await getToken();
  if (!token) return []; // GraphQL API requires authentication

  const cacheKey = `review:${owner}/${repo}:${prNumbers.sort().join(",")}`;
  const cached = reviewCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Build aliased queries for each PR number
  const prQueries = prNumbers
    .map(
      (n) => `    pr_${n}: pullRequest(number: ${n}) {
      reviewThreads(first: 100) {
        totalCount
        nodes { isResolved }
      }
    }`
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
      console.error(
        `[Better GitHub] GraphQL error: ${response.status} ${response.statusText}`
      );
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
        const resolvedThreads = (
          threads.nodes as Array<{ isResolved: boolean }>
        ).filter((t) => t.isResolved).length;
        return { number: n, totalThreads, resolvedThreads };
      })
      .filter((s): s is PRReviewStatus => s !== null);

    reviewCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch review statuses:", err);
    return [];
  }
}
