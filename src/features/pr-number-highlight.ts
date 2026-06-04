import { isIssueOrPRListPage } from "../lib/page-detect";

const NUMBER_CLASS = "better-github-pr-number";

/**
 * Highlight the leading "#1234" issue/PR number in each list row, the same way
 * the commit-age heat map tints recent timestamps.
 *
 * Old Turbo DOM only: the number lives as a bare text node at the start of
 * `.opened-by` ("#1234 opened <relative-time> by …"), fused with the "opened "
 * text — so we split that text node and wrap just the "#1234" run in our own
 * span. (Every number-keyed list feature in this codebase targets the Turbo
 * DOM via `[id^='issue_']`/`.opened-by`.)
 */
function highlightOpenedBy(openedBy: HTMLElement): void {
  if (openedBy.querySelector(`.${NUMBER_CLASS}`)) return;

  for (const node of openedBy.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) continue;
    const text = node.textContent ?? "";
    const match = text.match(/#\d+/);
    if (!match || match.index === undefined) continue;

    const start = match.index;
    const end = start + match[0].length;

    const span = document.createElement("span");
    span.className = NUMBER_CLASS;
    span.textContent = match[0];

    // splitText(start) → `node` keeps the text before "#1234", `rest` begins
    // with it; trim "#1234" off `rest`, then drop our span in between.
    const rest = (node as Text).splitText(start);
    rest.textContent = text.slice(end);
    openedBy.insertBefore(span, rest);
    return;
  }
}

export function injectPRNumberHighlight(): void {
  if (!isIssueOrPRListPage()) return;

  document.querySelectorAll<HTMLElement>(".opened-by").forEach(highlightOpenedBy);
}
