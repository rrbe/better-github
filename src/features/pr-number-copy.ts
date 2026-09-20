import { getRepoInfo, isPRListPage } from "../lib/page-detect";
import { collectPRRows } from "../lib/pr-list-dom";
import { isPRListReady } from "../lib/pr-list-ready";
import { t } from "../lib/i18n";

const COPY_CLASS = "better-github-pr-number-copy";

export function injectPRNumberCopy(): void {
  if (!isPRListPage()) return;
  const info = getRepoInfo();
  if (!info) return;

  for (const [number, row] of collectPRRows(info.owner, info.repo)) {
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
      button.title = t("prNumberCopyTitle");
      button.setAttribute("aria-label", `${t("prNumberCopyTitle")}: ${number}`);
      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(String(number));
          button.classList.add("better-github-pr-number-copied");
          button.title = t("copied");
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            button.classList.remove("better-github-pr-number-copied");
            button.title = t("prNumberCopyTitle");
          }, 1500);
        } catch {
          // Keep the original appearance if clipboard access is denied.
        }
      });

      // Wrap only the number, preserving the surrounding metadata and spacing.
      if (numberSpan) {
        // React renders # and the number as separate text nodes. Keep both intact.
        numberSpan.classList.add("better-github-pr-number-host");
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
