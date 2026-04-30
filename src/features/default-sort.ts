/**
 * Rewrites <a> links pointing to PR/issue list pages to include
 * sort:updated-desc, so the first navigation already carries the param.
 * Modelled after refined-github's approach — no redirect, no flicker.
 */

const CONVERSATION_LINK_RE =
  /^\/[^/]+\/[^/]+\/(pulls|issues)\/?(\?.*)?$/;

function shouldRewrite(link: HTMLAnchorElement): boolean {
  if (link.host !== location.host) return false;
  if (!CONVERSATION_LINK_RE.test(link.pathname + link.search)) return false;
  // Already has a sort qualifier
  if (link.href.includes("sort%3A") || link.href.includes("sort:")) return false;
  return true;
}

function rewriteLink(link: HTMLAnchorElement): void {
  if (!shouldRewrite(link)) return;

  const url = new URL(link.href);
  const q = url.searchParams.get("q");

  if (!q) {
    const isIssues = /\/issues\/?$/.test(url.pathname);
    const base = isIssues ? "is:issue is:open" : "is:pr is:open";
    url.searchParams.set("q", `${base} sort:updated-desc `);
  } else {
    url.searchParams.set("q", `${q} sort:updated-desc `);
  }

  // Preserve relative vs absolute href
  const wasRelative = link.getAttribute("href")?.startsWith("/");
  link.href = wasRelative
    ? url.pathname + url.search + url.hash
    : url.href;
}

function rewriteAll(): void {
  document.querySelectorAll<HTMLAnchorElement>(
    'a[href*="/issues"], a[href*="/pulls"]',
  ).forEach(rewriteLink);
}

let observer: MutationObserver | null = null;

export function applyDefaultSort(): void {
  // Rewrite existing links
  rewriteAll();

  // Watch for new links added by GitHub's SPA (Turbo)
  if (!observer) {
    observer = new MutationObserver(() => rewriteAll());
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
