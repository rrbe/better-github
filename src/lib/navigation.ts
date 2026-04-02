type PageHandler = () => void;

const handlers: PageHandler[] = [];
let lastUrl = "";

export function onPageReady(handler: PageHandler): void {
  handlers.push(handler);
}

function runHandlers(): void {
  for (const handler of handlers) {
    try {
      handler();
    } catch (e) {
      console.error("[Better GitHub] Handler error:", e);
    }
  }
}

// GitHub uses Turbo for SPA navigation
// Always run handlers on turbo:load — GitHub may re-render the nav after
// document_idle, so URL-based deduplication is not sufficient here.
document.addEventListener("turbo:load", () => {
  const currentUrl = location.href;
  lastUrl = currentUrl;
  runHandlers();
});

// turbo:render fires on both full and partial (Turbo Frame) renders.
// GitHub sometimes re-renders the nav bar via frames without turbo:load,
// which destroys injected elements. Re-run handlers to recover them.
document.addEventListener("turbo:render", () => {
  lastUrl = location.href;
  runHandlers();
});

// Fallback for popstate (back/forward)
window.addEventListener("popstate", () => {
  setTimeout(() => {
    lastUrl = location.href;
    runHandlers();
  }, 0);
});

// Polling fallback — GitHub's SPA doesn't always fire Turbo events reliably.
// Always re-run handlers because GitHub may re-render the nav (destroying
// injected elements) without changing the URL.  All inject functions are
// idempotent (they check for existing elements first), so this is safe.
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startNavigation(): void {
  lastUrl = location.href;
  runHandlers();

  if (!pollInterval) {
    pollInterval = setInterval(() => {
      lastUrl = location.href;
      runHandlers();
    }, 1000);
  }
}
