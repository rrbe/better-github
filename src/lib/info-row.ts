/**
 * Shared "info row" below the meta line in PR/issue list items.
 * Used by pr-label-position, pr-branch-names, and pr-review-status
 * to render their badges on a dedicated third line.
 *
 * Supports both old GitHub DOM ([id^='issue_']) and new React DOM (li[role='listitem']).
 */

export const INFO_ROW_CLASS = "better-github-info-row";

export function getOrCreateInfoRow(row: Element): HTMLElement | null {
  const existing = row.querySelector<HTMLElement>(`.${INFO_ROW_CLASS}`);
  if (existing) return existing;

  const infoRow = document.createElement("div");
  infoRow.className = INFO_ROW_CLASS;

  // New GitHub DOM: append inside MainContent inner container
  const mainInner = row.querySelector<HTMLElement>("[class*='MainContent-module__inner']");
  if (mainInner) {
    mainInner.appendChild(infoRow);
    return infoRow;
  }

  // Old GitHub DOM: insert after the meta line containing relative-time
  const relativeTime = row.querySelector("relative-time");
  const metaLine = relativeTime?.closest("div");
  if (metaLine && row.contains(metaLine) && metaLine !== row) {
    metaLine.insertAdjacentElement("afterend", infoRow);
    return infoRow;
  }

  // Fallback: insert after title link
  const titleLink =
    row.querySelector<HTMLElement>("[id^='issue_'][id$='_link']") ||
    row.querySelector<HTMLElement>("a.Link--primary") ||
    row.querySelector<HTMLElement>("a[data-testid='issue-pr-title-link']");
  if (titleLink) {
    titleLink.insertAdjacentElement("afterend", infoRow);
    return infoRow;
  }

  return null;
}
