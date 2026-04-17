import { getRepoInfo, isPRDetailPage, getPRNumber } from "../lib/page-detect";
import { approvePR } from "../lib/github-api";

const APPROVE_BTN_CLASS = "better-github-approve-now";
const DIALOG_OVERLAY_CLASS = "better-github-approve-dialog-overlay";

export async function injectPRApproveNow(): Promise<void> {
  if (!isPRDetailPage()) return;
  if (document.querySelector(`.${APPROVE_BTN_CLASS}`)) return;

  const repoInfo = getRepoInfo();
  if (!repoInfo) return;
  const prNumber = getPRNumber();
  if (!prNumber) return;

  // GitHub forbids authors from approving their own PRs — hide the button in that case.
  if (isCurrentUserPRAuthor()) return;

  const headingEl = findReviewersHeading();
  if (!headingEl) return;

  const link = document.createElement("a");
  link.className = APPROVE_BTN_CLASS;
  link.textContent = "approve now";
  link.href = "#";
  link.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent toggling the <details> dropdown
    showApproveDialog(repoInfo.owner, repoInfo.repo, prNumber);
  });

  const sep = document.createTextNode(" – ");
  // The heading is a <summary> inside <details>; append inside it so it stays visible
  headingEl.append(sep, link);
}

function isCurrentUserPRAuthor(): boolean {
  const currentUser = document
    .querySelector('meta[name="user-login"]')
    ?.getAttribute("content")
    ?.trim()
    .toLowerCase();
  if (!currentUser) return false;

  const authorEl =
    document.querySelector<HTMLAnchorElement>(".gh-header-meta a.author") ||
    document.querySelector<HTMLAnchorElement>(
      '.gh-header-meta a[data-hovercard-type="user"]',
    );
  const author = authorEl?.textContent?.trim().toLowerCase();
  if (!author) return false;

  return currentUser === author;
}

function findReviewersHeading(): Element | null {
  // Most specific: the reviewers <summary> trigger
  const trigger = document.querySelector('summary[data-menu-trigger="reviewers-select-menu"]');
  if (trigger) return trigger;

  // Fallback: discussion-sidebar-heading with "Reviewers" text
  for (const h of document.querySelectorAll(".discussion-sidebar-heading")) {
    if (h.textContent?.trim() === "Reviewers") return h;
  }

  return null;
}

function showApproveDialog(owner: string, repo: string, prNumber: number): void {
  document.querySelector(`.${DIALOG_OVERLAY_CLASS}`)?.remove();

  const overlay = document.createElement("div");
  overlay.className = DIALOG_OVERLAY_CLASS;

  const dialog = document.createElement("div");
  dialog.className = "better-github-approve-dialog";

  const title = document.createElement("h3");
  title.textContent = "Approve this pull request?";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "better-github-approve-input";
  input.placeholder = "Leave a comment (optional)";

  const actions = document.createElement("div");
  actions.className = "better-github-approve-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "better-github-approve-cancel";
  cancelBtn.textContent = "Cancel";

  const submitBtn = document.createElement("button");
  submitBtn.className = "better-github-approve-submit";
  submitBtn.textContent = "Approve";

  actions.append(cancelBtn, submitBtn);
  dialog.append(title, input, actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();

  const close = () => overlay.remove();

  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  const handleSubmit = async () => {
    const body = input.value.trim();
    submitBtn.disabled = true;
    submitBtn.textContent = "Approving...";

    const result = await approvePR(owner, repo, prNumber, body);
    if (result.success) {
      close();
      location.reload();
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = "Approve";
      alert(`Failed to approve PR: ${result.error}`);
    }
  };

  submitBtn.addEventListener("click", handleSubmit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") close();
  });
}
