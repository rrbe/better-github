import { isPRListPage, getRepoInfo } from "../lib/page-detect";
import { fetchPRReviewStatuses } from "../lib/github-api";

const STATUS_CLASS = "better-github-review-status";

export async function injectPRReviewStatus(): Promise<void> {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  // Skip if already injected
  if (document.querySelectorAll(`.${STATUS_CLASS}`).length > 0) return;

  // Collect PR numbers from the page
  const prRows = document.querySelectorAll("[id^='issue_']");
  const prNumbers: number[] = [];
  for (const row of prRows) {
    const id = row.getAttribute("id");
    if (!id) continue;
    prNumbers.push(parseInt(id.replace("issue_", ""), 10));
  }

  if (prNumbers.length === 0) return;

  const statuses = await fetchPRReviewStatuses(
    info.owner,
    info.repo,
    prNumbers
  );

  if (statuses.length === 0) return;

  const statusMap = new Map(statuses.map((s) => [s.number, s]));

  for (const row of prRows) {
    const id = row.getAttribute("id");
    if (!id) continue;

    const prNumber = parseInt(id.replace("issue_", ""), 10);
    const status = statusMap.get(prNumber);
    if (!status || status.totalThreads === 0) continue;

    const titleLink =
      row.querySelector<HTMLElement>("[id^='issue_'][id$='_link']") ||
      row.querySelector<HTMLElement>("a.Link--primary");
    if (!titleLink) continue;

    if (titleLink.parentElement?.querySelector(`.${STATUS_CLASS}`)) continue;

    const badge = document.createElement("span");
    badge.className = STATUS_CLASS;

    const allResolved = status.resolvedThreads === status.totalThreads;
    const unresolved = status.totalThreads - status.resolvedThreads;

    if (allResolved) {
      badge.classList.add("better-github-review-resolved");
      badge.textContent = `✓ All resolved`;
      badge.title = `${status.totalThreads} review thread(s), all resolved`;
    } else {
      badge.classList.add("better-github-review-unresolved");
      badge.textContent = `${unresolved} unresolved`;
      badge.title = `${status.resolvedThreads}/${status.totalThreads} review thread(s) resolved`;
    }

    // Insert after the last badge (branch name badge or title link)
    const branchBadge = titleLink.parentElement?.querySelector(
      ".better-github-branch-badge"
    );
    const insertAfter = branchBadge || titleLink;
    insertAfter.insertAdjacentElement("afterend", badge);
  }
}
