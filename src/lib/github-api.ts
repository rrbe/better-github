import type { ServiceWorkerRequest, PRBranchInfo, PRReviewStatus, PRApproveResult, TagInfo } from "./messages";

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

export type { PRReviewStatus, PRApproveResult, TagInfo };

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

export async function fetchRepoTags(
  owner: string,
  repo: string,
): Promise<TagInfo[]> {
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
    return { success: false, error: "Service worker unavailable" };
  }
}
