// The repository dashboard preview renders a pull-requests React app. Detect
// the rendered DOM, since client-env feature flags can outlive SPA navigation.
export const PR_DASHBOARD_SELECTOR = 'react-app[app-name="pull-requests"]';
const TITLE_SELECTOR = 'a[data-testid="listitem-title-link"]';
export const TRAILING_LABELS_SELECTOR = '[class*="trailingBadgesContainer"]';

export function isCompactPRRow(row: Element): boolean {
  return row.closest(`${PR_DASHBOARD_SELECTOR} [data-density="compact"]`) !== null;
}

export function getPRRowNumber(row: Element): number | null {
  const classic = row.id.match(/^issue_(\d+)$/);
  if (classic) return Number(classic[1]);

  const title = row.querySelector<HTMLAnchorElement>(TITLE_SELECTOR);
  const match = title?.pathname.match(/^\/[^/]+\/[^/]+\/pull\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export function collectPRRows(
  owner: string,
  repo: string,
  { includeCompact = false }: { includeCompact?: boolean } = {},
): Map<number, Element> {
  const rows = new Map<number, Element>();
  for (const row of document.querySelectorAll('[id^="issue_"]:not([id$="_link"])')) {
    const number = getPRRowNumber(row);
    if (number !== null) rows.set(number, row);
  }

  const pullPath = `/${owner}/${repo}/pull/`.toLowerCase();
  for (const title of document.querySelectorAll<HTMLAnchorElement>(
    `${PR_DASHBOARD_SELECTOR} ${TITLE_SELECTOR}`,
  )) {
    const row = title.closest("li");
    if (!row || (!includeCompact && isCompactPRRow(row)) || title.origin !== location.origin)
      continue;
    const number = getPRRowNumber(row);
    if (number !== null && title.pathname.toLowerCase() === `${pullPath}${number}`) {
      rows.set(number, row);
    }
  }
  return rows;
}
