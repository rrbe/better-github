import type {
  ServiceWorkerRequest,
  PRBranchInfo,
  PRReviewStatus,
  ReviewThreadDetail,
  PRDiffStats,
  CommitDiffStats,
  PRApproveResult,
  TagInfo,
  StargazerInfo,
  WatcherInfo,
  ForkInfo,
  ContributorInfo,
} from "./messages";

function sendMessage<T>(request: ServiceWorkerRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      if (!chrome.runtime?.id) {
        reject(new Error("Extension context invalidated"));
        return;
      }
    } catch {
      reject(new Error("Extension context invalidated"));
      return;
    }
    chrome.runtime.sendMessage(request, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error(response?.error || "Unknown error"));
        return;
      }
      resolve(response.data as T);
    });
  });
}

export type {
  PRReviewStatus,
  ReviewThreadDetail,
  PRDiffStats,
  CommitDiffStats,
  PRApproveResult,
  TagInfo,
  StargazerInfo,
  WatcherInfo,
  ForkInfo,
  ContributorInfo,
};

/** Fetch objective facts about an account for the contributor card. Returns null
 * for an unknown user, a rate-limited request, or any failure (the caller then
 * renders nothing). owner/repo add the repo-relation row when on a repo page. */
export async function fetchContributorInfo(
  login: string,
  owner?: string,
  repo?: string,
): Promise<ContributorInfo | null> {
  try {
    return await sendMessage<ContributorInfo | null>({
      type: "FETCH_CONTRIBUTOR_INFO",
      login,
      owner,
      repo,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch contributor info:", err);
    return null;
  }
}

export async function fetchPRBranches(
  owner: string,
  repo: string,
  state: string = "open",
  page: number = 1,
): Promise<PRBranchInfo[]> {
  try {
    return await sendMessage<PRBranchInfo[]>({
      type: "FETCH_PR_BRANCHES",
      owner,
      repo,
      state,
      page,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch PR branches:", err);
    return [];
  }
}

export async function fetchPRReviewStatuses(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<PRReviewStatus[]> {
  try {
    return await sendMessage<PRReviewStatus[]>({
      type: "FETCH_PR_REVIEW_STATUSES",
      owner,
      repo,
      prNumbers,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch review statuses:", err);
    return [];
  }
}

export async function fetchReviewThreadDetails(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewThreadDetail[]> {
  // Unlike the list-level fetchers above, this one lets errors propagate so the
  // popover can surface a "couldn't load" state and retry on the next open,
  // rather than swallowing the failure into an empty list that reads as
  // "no threads". The count badge already stands on its own.
  return sendMessage<ReviewThreadDetail[]>({
    type: "FETCH_PR_REVIEW_THREAD_DETAILS",
    owner,
    repo,
    prNumber,
  });
}

export async function fetchPRDiffStats(
  owner: string,
  repo: string,
  prNumbers: number[],
): Promise<PRDiffStats[]> {
  try {
    return await sendMessage<PRDiffStats[]>({
      type: "FETCH_PR_DIFF_STATS",
      owner,
      repo,
      prNumbers,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch diff stats:", err);
    return [];
  }
}

export async function fetchCommitDiffStats(
  owner: string,
  repo: string,
  shas: string[],
): Promise<CommitDiffStats[]> {
  try {
    return await sendMessage<CommitDiffStats[]>({
      type: "FETCH_COMMIT_DIFF_STATS",
      owner,
      repo,
      shas,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch commit diff stats:", err);
    return [];
  }
}

export async function fetchRepoTags(owner: string, repo: string): Promise<TagInfo[]> {
  try {
    return await sendMessage<TagInfo[]>({
      type: "FETCH_REPO_TAGS",
      owner,
      repo,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch repo tags:", err);
    return [];
  }
}

export async function approvePR(
  owner: string,
  repo: string,
  prNumber: number,
  body?: string,
): Promise<PRApproveResult> {
  try {
    return await sendMessage<PRApproveResult>({
      type: "APPROVE_PR",
      owner,
      repo,
      prNumber,
      body,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to approve PR:", err);
    const message = err instanceof Error ? err.message : "Service worker unavailable";
    return { success: false, error: message };
  }
}

export async function fetchStargazers(owner: string, repo: string): Promise<StargazerInfo[]> {
  try {
    return await sendMessage<StargazerInfo[]>({
      type: "FETCH_STARGAZERS",
      owner,
      repo,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch stargazers:", err);
    return [];
  }
}

export async function fetchWatchers(owner: string, repo: string): Promise<WatcherInfo[]> {
  try {
    return await sendMessage<WatcherInfo[]>({
      type: "FETCH_WATCHERS",
      owner,
      repo,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch watchers:", err);
    return [];
  }
}

export async function fetchForks(owner: string, repo: string): Promise<ForkInfo[]> {
  try {
    return await sendMessage<ForkInfo[]>({
      type: "FETCH_FORKS",
      owner,
      repo,
    });
  } catch (err) {
    console.error("[Better GitHub] Failed to fetch forks:", err);
    return [];
  }
}
