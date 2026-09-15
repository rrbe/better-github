import { isPRListPage } from "./page-detect";
import { PR_DASHBOARD_SELECTOR, PR_TITLE_SELECTOR } from "./pr-list-dom";
import { watchPRListReady } from "./pr-list-ready";

type PageHandler = () => void;

const handlers: PageHandler[] = [];

export function onPageReady(handler: PageHandler): void {
  handlers.push(handler);
}

function runHandlers(): void {
  if (isPRListPage()) watchPRListReady(scheduleHandlers);
  for (const handler of handlers) {
    try {
      handler();
    } catch (e) {
      console.error("[Better GitHub] Handler error:", e);
    }
  }
}

// Debounce: collapse rapid-fire events (e.g. turbo:load + turbo:render on
// the same navigation) into a single handler run per microtask.
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleHandlers(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(runHandlers, 0);
}

// GitHub uses Turbo for SPA navigation
// Always run handlers on turbo:load — GitHub may re-render the nav after
// document_idle, so URL-based deduplication is not sufficient here.
document.addEventListener("turbo:load", scheduleHandlers);

// turbo:render fires on both full and partial (Turbo Frame) renders.
// GitHub sometimes re-renders the nav bar via frames without turbo:load,
// which destroys injected elements. Re-run handlers to recover them.
document.addEventListener("turbo:render", scheduleHandlers);

// Fallback for popstate (back/forward)
window.addEventListener("popstate", () => {
  setTimeout(runHandlers, 0);
});

// Polling fallback — GitHub's SPA doesn't always fire Turbo events reliably.
// Always re-run handlers because GitHub may re-render the nav (destroying
// injected elements) without changing the URL. All inject functions are
// idempotent (they check for existing elements first), so this is safe.
let pollInterval: ReturnType<typeof setInterval> | null = null;
let rowObserver: MutationObserver | null = null;
let rowFrame: number | null = null;

function observePRRows(): void {
  if (rowObserver) return;
  const selector = `[id^="issue_"]:not([id$="_link"]), ${PR_DASHBOARD_SELECTOR} ${PR_TITLE_SELECTOR}`;
  rowObserver = new MutationObserver((mutations) => {
    if (!isPRListPage() || rowFrame !== null) return;
    // Inspect only added subtrees. Our badges contain no PR title links, so
    // injecting them does not schedule another pass.
    const hasRows = mutations.some((mutation) =>
      [...mutation.addedNodes].some(
        (node) =>
          node instanceof Element && (node.matches(selector) || node.querySelector(selector)),
      ),
    );
    if (!hasRows) return;
    rowFrame = requestAnimationFrame(() => {
      rowFrame = null;
      if (isPRListPage()) runHandlers();
    });
  });
  rowObserver.observe(document.body, { childList: true, subtree: true });
}

export function startNavigation(): void {
  observePRRows();
  runHandlers();

  if (!pollInterval) {
    pollInterval = setInterval(runHandlers, 2000);
  }
}
