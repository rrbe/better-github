import { isRepoTree } from "../lib/page-detect";

const HEAT_WINDOW_MS = 2_000_000_000; // ~23.1 days
const HEAT_STEPS = 10;

function getHeatIndex(dateMs: number): number {
  const ageMs = Date.now() - dateMs;
  if (ageMs <= 0) return 1;
  if (ageMs >= HEAT_WINDOW_MS) return HEAT_STEPS;
  return Math.ceil((ageMs / HEAT_WINDOW_MS) * HEAT_STEPS) || 1;
}

function colorizeElement(el: HTMLElement): void {
  if (el.dataset.betterGithubHeat) return;

  const datetime =
    el.getAttribute("datetime") || el.getAttribute("title") || "";
  const dateMs = new Date(datetime).getTime();
  if (isNaN(dateMs)) return;

  el.dataset.betterGithubHeat = String(getHeatIndex(dateMs));
}

function colorizeAll(): void {
  document
    .querySelectorAll<HTMLElement>(
      ".react-directory-commit-age relative-time"
    )
    .forEach(colorizeElement);
}

let observer: MutationObserver | null = null;

export function injectFileAgeColor(): void {
  // Disconnect previous observer on navigation
  observer?.disconnect();
  observer = null;

  if (!isRepoTree()) return;

  // Colorize anything already in the DOM
  colorizeAll();

  // Watch for async-rendered elements
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;

        // The added node itself might be a relative-time
        if (
          node.tagName === "RELATIVE-TIME" &&
          node.closest(".react-directory-commit-age")
        ) {
          colorizeElement(node);
          continue;
        }

        // Or it might contain relative-time descendants
        node
          .querySelectorAll<HTMLElement>(
            ".react-directory-commit-age relative-time"
          )
          .forEach(colorizeElement);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
