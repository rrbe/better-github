export interface PRBranchInfo {
  number: number;
  headRef: string;
}

export interface ReviewThreadDetail {
  /** File path the thread is anchored to (empty for file-level / outdated threads). */
  path: string;
  /** Line number in the diff, or null when the thread is outdated / not line-anchored. */
  line: number | null;
  /** Whether the diff the thread was left on has since changed. */
  isOutdated: boolean;
  /** Login of the author of the first comment in the thread. */
  author: string;
  /** Plain-text body of the first comment (already stripped of Markdown by the API). */
  snippet: string;
  /** Permalink to the first comment, for jumping straight to the thread. */
  url: string;
}

export interface PRReviewStatus {
  number: number;
  totalThreads: number;
  resolvedThreads: number;
}

export interface PRDiffStats {
  number: number;
  additions: number;
  deletions: number;
  changedFiles: number;
}

export interface CommitDiffStats {
  sha: string;
  additions: number;
  deletions: number;
  changedFiles: number | null;
}

export interface PRApproveResult {
  success: boolean;
  error?: string;
}

export interface TagInfo {
  name: string;
  commitSha: string;
}

export interface StargazerInfo {
  login: string;
  avatarUrl: string;
  name: string | null;
  starredAt: string;
}

export interface WatcherInfo {
  login: string;
  avatarUrl: string;
  name: string | null;
}

export interface ForkInfo {
  owner: string;
  ownerAvatarUrl: string;
  fullName: string;
  description: string | null;
  stargazersCount: number;
}

export type ServiceWorkerRequest =
  | { type: "FETCH_PR_BRANCHES"; owner: string; repo: string; state: string; page: number }
  | { type: "FETCH_PR_REVIEW_STATUSES"; owner: string; repo: string; prNumbers: number[] }
  | { type: "FETCH_PR_REVIEW_THREAD_DETAILS"; owner: string; repo: string; prNumber: number }
  | { type: "FETCH_PR_DIFF_STATS"; owner: string; repo: string; prNumbers: number[] }
  | { type: "FETCH_COMMIT_DIFF_STATS"; owner: string; repo: string; shas: string[] }
  | { type: "APPROVE_PR"; owner: string; repo: string; prNumber: number; body?: string }
  | { type: "FETCH_REPO_TAGS"; owner: string; repo: string }
  | { type: "FETCH_STARGAZERS"; owner: string; repo: string }
  | { type: "FETCH_WATCHERS"; owner: string; repo: string }
  | { type: "FETCH_FORKS"; owner: string; repo: string };

export type ServiceWorkerResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
