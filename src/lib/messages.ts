export interface PRBranchInfo {
  number: number;
  headRef: string;
}

export interface PRReviewStatus {
  number: number;
  totalThreads: number;
  resolvedThreads: number;
}

export interface PRApproveResult {
  success: boolean;
  error?: string;
}

export type ServiceWorkerRequest =
  | { type: "FETCH_PR_BRANCHES"; owner: string; repo: string; state: string; page: number }
  | { type: "FETCH_PR_REVIEW_STATUSES"; owner: string; repo: string; prNumbers: number[] }
  | { type: "APPROVE_PR"; owner: string; repo: string; prNumber: number; body?: string };

export type ServiceWorkerResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
