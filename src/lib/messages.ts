export interface PRBranchInfo {
  number: number;
  headRef: string;
}

export interface PRConflictStatus {
  number: number;
  mergeable: "CONFLICTING" | "MERGEABLE" | "UNKNOWN";
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

export type SocialList<T> = T[] | { restricted: true };

export interface ForkInfo {
  owner: string;
  ownerAvatarUrl: string;
  fullName: string;
  description: string | null;
  stargazersCount: number;
}

/** Objective facts about a GitHub account, for the contributor profile card.
 * Pure-fact only — no scoring. See docs/contributor-profile-card.md. */
export interface ContributorInfo {
  login: string;
  /** ISO timestamp of account creation (REST `created_at`). */
  createdAt: string;
  followers: number;
  publicRepos: number;
  /** Total PRs authored across GitHub (Search `type:pr author:X`). */
  prTotal: number;
  /** ...of which merged (Search `is:merged`). */
  prMerged: number;
  /** ...and closed without merging (Search `is:closed is:unmerged`) — the
   * rejection signal. (total = merged + closed + still-open.) */
  prClosed: number;
  /** The author's `author_association` to the *current* repo — `OWNER`,
   * `MEMBER`, `COLLABORATOR`, `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, … — or
   * null when the card fired off a repo page, or the user has authored nothing
   * here, or the lookup failed. */
  repoAssociation: string | null;
  /** Contribution-calendar total for the last year (GraphQL); null without a token. */
  contributionsLastYear: number | null;
  /** Whether a token was configured — lets the card show the right degraded state. */
  hasToken: boolean;
}

export type ServiceWorkerRequest =
  | { type: "FETCH_PR_BRANCHES"; owner: string; repo: string; state: string; page: number }
  | { type: "FETCH_PR_CONFLICT_STATUSES"; owner: string; repo: string; prNumbers: number[] }
  | { type: "FETCH_PR_REVIEW_STATUSES"; owner: string; repo: string; prNumbers: number[] }
  | { type: "FETCH_PR_REVIEW_THREAD_DETAILS"; owner: string; repo: string; prNumber: number }
  | { type: "FETCH_PR_DIFF_STATS"; owner: string; repo: string; prNumbers: number[] }
  | { type: "FETCH_COMMIT_DIFF_STATS"; owner: string; repo: string; shas: string[] }
  | { type: "APPROVE_PR"; owner: string; repo: string; prNumber: number; body?: string }
  | { type: "FETCH_REPO_TAGS"; owner: string; repo: string }
  | { type: "FETCH_STARGAZERS"; owner: string; repo: string }
  | { type: "FETCH_WATCHERS"; owner: string; repo: string }
  | { type: "FETCH_FORKS"; owner: string; repo: string }
  | { type: "FETCH_CONTRIBUTOR_INFO"; login: string; owner?: string; repo?: string };

export type ServiceWorkerResponse<T> = { ok: true; data: T } | { ok: false; error: string };
