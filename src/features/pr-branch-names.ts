import { isPRListPage, getRepoInfo, getPRListParams } from "../lib/page-detect";
import { fetchPRBranches } from "../lib/github-api";

const BADGE_CLASS = "better-github-branch-badge";

export async function injectPRBranchNames(): Promise<void> {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  // Skip if already injected for current page state
  const existing = document.querySelectorAll(`.${BADGE_CLASS}`);
  if (existing.length > 0) return;

  const { state, page } = getPRListParams();
  const branches = await fetchPRBranches(info.owner, info.repo, state, page);

  if (branches.length === 0) return;

  const branchMap = new Map(branches.map((b) => [b.number, b.headRef]));

  // Find PR rows — GitHub uses [id^='issue_'] for PR list items
  const prRows = document.querySelectorAll("[id^='issue_']");

  for (const row of prRows) {
    const id = row.getAttribute("id");
    if (!id) continue;

    const prNumber = parseInt(id.replace("issue_", ""), 10);
    const branchName = branchMap.get(prNumber);
    if (!branchName) continue;

    // Find the title link area to append badge
    const titleLink =
      row.querySelector<HTMLElement>("[id^='issue_'][id$='_link']") ||
      row.querySelector<HTMLElement>("a.Link--primary");
    if (!titleLink) continue;

    // Don't inject if already present
    if (titleLink.parentElement?.querySelector(`.${BADGE_CLASS}`)) continue;

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.textContent = branchName;
    badge.title = "Click to copy branch name";

    badge.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(branchName);
        badge.classList.add("better-github-branch-copied");
        badge.setAttribute("data-original-text", branchName);
        badge.textContent = "Copied!";
        setTimeout(() => {
          badge.textContent = badge.getAttribute("data-original-text") || branchName;
          badge.classList.remove("better-github-branch-copied");
        }, 1500);
      } catch {
        // ignore
      }
    });

    titleLink.insertAdjacentElement("afterend", badge);
  }
}
