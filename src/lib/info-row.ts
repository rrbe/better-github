/**
 * Shared "info row" below the meta line in PR/issue list items.
 * Used by pr-label-position, pr-branch-names, and pr-review-status
 * to render their badges on a dedicated third line.
 */

export const INFO_ROW_CLASS = "better-github-info-row";

export function getOrCreateInfoRow(row: Element): HTMLElement | null {
  const existing = row.querySelector<HTMLElement>(`.${INFO_ROW_CLASS}`);
  if (existing) return existing;

  // Find the meta line (contains "opened X ago") using relative-time element
  const relativeTime = row.querySelector("relative-time");
  const metaLine = relativeTime?.closest("div");

  const infoRow = document.createElement("div");
  infoRow.className = INFO_ROW_CLASS;

  if (metaLine && row.contains(metaLine) && metaLine !== row) {
    metaLine.insertAdjacentElement("afterend", infoRow);
    return infoRow;
  }

  // Fallback: insert after title link
  const titleLink =
    row.querySelector<HTMLElement>("[id^='issue_'][id$='_link']") ||
    row.querySelector<HTMLElement>("a.Link--primary");
  if (titleLink) {
    titleLink.insertAdjacentElement("afterend", infoRow);
    return infoRow;
  }

  return null;
}
