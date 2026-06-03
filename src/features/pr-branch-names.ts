import { isPRListPage, getRepoInfo, getPRListParams } from "../lib/page-detect";
import { fetchPRBranches } from "../lib/github-api";
import { getOrCreateInfoRow } from "../lib/info-row";
import { clearSkeletons } from "../lib/info-row-skeleton";
import { t } from "../lib/i18n";

const BADGE_CLASS = "better-github-branch-badge";
const COPIED_CLASS = "better-github-branch-copied";

let delegatedHandlerAttached = false;

function attachDelegatedClickHandler(): void {
  if (delegatedHandlerAttached) return;
  delegatedHandlerAttached = true;

  document.addEventListener("click", async (e) => {
    const target = e.target as Element | null;
    const badge = target?.closest?.(`.${BADGE_CLASS}`) as HTMLElement | null;
    if (!badge) return;

    e.preventDefault();
    e.stopPropagation();

    const branchName = badge.dataset.branch || badge.textContent || "";
    if (!branchName) return;

    try {
      await navigator.clipboard.writeText(branchName);
      badge.classList.add(COPIED_CLASS);
      badge.textContent = t("copied");
      setTimeout(() => {
        badge.textContent = badge.dataset.branch || branchName;
        badge.classList.remove(COPIED_CLASS);
      }, 1500);
    } catch {
      // ignore
    }
  });
}

export async function injectPRBranchNames(): Promise<void> {
  attachDelegatedClickHandler();

  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  // Skip if already injected for current page state
  const existing = document.querySelectorAll(`.${BADGE_CLASS}`);
  if (existing.length > 0) return;

  try {
    const { state, page } = getPRListParams();
    const branches = await fetchPRBranches(info.owner, info.repo, state, page);

    if (branches.length === 0) return;

    const branchMap = new Map(branches.map((b) => [b.number, b.headRef]));
    const prRows = document.querySelectorAll("[id^='issue_']");

    for (const row of prRows) {
      const id = row.getAttribute("id");
      if (!id) continue;

      const prNumber = parseInt(id.replace("issue_", ""), 10);
      const branchName = branchMap.get(prNumber);
      if (!branchName) continue;

      if (row.querySelector(`.${BADGE_CLASS}`)) continue;

      const infoRow = getOrCreateInfoRow(row);
      if (!infoRow) continue;

      const badge = document.createElement("span");
      badge.className = BADGE_CLASS;
      badge.textContent = branchName;
      badge.dataset.branch = branchName;
      badge.title = t("branchCopyTitle");

      infoRow.appendChild(badge);
    }
  } finally {
    clearSkeletons("branch");
  }
}
