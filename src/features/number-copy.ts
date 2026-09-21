import { getRepoInfo, isIssueOrPRListPage, isPRListPage, type RepoInfo } from "../lib/page-detect";
import { collectPRRows } from "../lib/pr-list-dom";
import { isPRListReady } from "../lib/pr-list-ready";
import { t } from "../lib/i18n";

const COPY_CLASS = "better-github-number-copy";

function collectIssueRows({ owner, repo }: RepoInfo): Map<number, Element> {
  const rows = new Map<number, Element>();
  const issuePath = `/${owner}/${repo}/issues/`.toLowerCase();
  for (const title of document.querySelectorAll<HTMLAnchorElement>(
    'react-app[app-name="issues-react"] a[data-testid="issue-pr-title-link"], [id^="issue_"]:not([id$="_link"]) a[id$="_link"]',
  )) {
    if (title.origin !== location.origin || !title.pathname.toLowerCase().startsWith(issuePath))
      continue;
    const suffix = title.pathname.slice(issuePath.length);
    if (!/^\d+\/?$/.test(suffix)) continue;
    const row =
      title.closest("li") ?? title.parentElement?.closest('[id^="issue_"]:not([id$="_link"])');
    if (row) rows.set(Number(suffix.replace(/\/$/, "")), row);
  }
  return rows;
}

export function injectNumberCopy(): void {
  if (!isIssueOrPRListPage()) return;
  const info = getRepoInfo();
  if (!info) return;
  const isPR = isPRListPage();
  const rows = isPR ? collectPRRows(info.owner, info.repo) : collectIssueRows(info);
  const titleKey = isPR ? "prNumberCopyTitle" : "issueNumberCopyTitle";

  for (const [number, row] of rows) {
    if (!isPRListReady(row) || row.querySelector(`.${COPY_CLASS}`)) continue;
    const numberSpan = [...row.querySelectorAll("span")].find(
      (span) =>
        span.textContent === `#${number}` &&
        span.children.length === 0 &&
        !span.closest("a, button, h3"),
    );
    const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = numberSpan || walker.nextNode())) {
      // Match metadata only, never a number mentioned in the title or a label.
      if (node.parentElement?.closest("a, button, h3")) continue;
      const match = node.textContent?.match(new RegExp(`^\\s*(#${number})(?=\\s|$)`));
      if (!match) continue;

      const button = document.createElement("button");
      button.type = "button";
      button.className = COPY_CLASS;
      if (!numberSpan) button.textContent = `#${number}`;
      button.title = t(titleKey);
      button.setAttribute("aria-label", `${t(titleKey)}: ${number}`);
      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(String(number));
          button.classList.add("better-github-number-copied");
          button.title = t("copied");
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            button.classList.remove("better-github-number-copied");
            button.title = t(titleKey);
          }, 1500);
        } catch {
          // Keep the original appearance if clipboard access is denied.
        }
      });

      // Wrap only the number, preserving the surrounding metadata and spacing.
      if (numberSpan) {
        // React renders # and the number as separate text nodes. Keep both intact.
        numberSpan.classList.add("better-github-number-host");
        numberSpan.append(button);
      } else {
        const text = node as Text;
        const numberText = text.splitText(match[0].length - match[1].length);
        numberText.splitText(match[1].length);
        numberText.replaceWith(button);
      }
      break;
    }
  }
}
