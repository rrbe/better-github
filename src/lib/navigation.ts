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

function onNavigation(): void {
  const currentUrl = location.href;
  if (currentUrl === lastUrl) return;
  lastUrl = currentUrl;
  runHandlers();
}

// GitHub uses Turbo for SPA navigation
// Always run handlers on turbo:load — GitHub may re-render the nav after
// document_idle, so URL-based deduplication is not sufficient here.
document.addEventListener("turbo:load", () => {
  const currentUrl = location.href;
  lastUrl = currentUrl;
  runHandlers();
});

// Fallback for popstate (back/forward)
window.addEventListener("popstate", () => {
  setTimeout(onNavigation, 0);
});

// URL polling fallback — GitHub's SPA doesn't always fire events reliably
let pollInterval: ReturnType<typeof setInterval> | null = null;

export function startNavigation(): void {
  lastUrl = location.href;
  runHandlers();

  if (!pollInterval) {
    pollInterval = setInterval(() => {
      onNavigation();
    }, 1000);
  }
}
