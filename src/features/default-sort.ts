/**
 * Rewrites <a> links pointing to PR/issue list pages to include
 * sort:updated-desc, so the first navigation already carries the param.
 * Modelled after refined-github's approach — no redirect, no flicker.
 */
import { isIssueOrPRListPage } from "../lib/page-detect";

const CONVERSATION_LINK_RE =
  /^\/[^/]+\/[^/]+\/(pulls|issues)\/?(\?.*)?$/;

const inputValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value",
)?.set;
const textareaValueSetter = Object.getOwnPropertyDescriptor(
  HTMLTextAreaElement.prototype,
  "value",
)?.set;

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

// GitHub's new issues page (React-based) canonicalises trailing whitespace
// out of the `q` URL param, so the input ends up tight against `sort:...`
// even though we set a trailing space in the URL. Patch the input itself
// when the user focuses it: if it ends with `sort:<value>` (no space),
// append one and place the cursor at the end so typing is clean.
function ensureTrailingSpaceOnFocus(target: EventTarget | null): void {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  if (!isIssueOrPRListPage()) return;
  if (
    !target.matches('[name="q"], [name="query"]') &&
    !target.closest("query-builder")
  ) {
    return;
  }

  const value = target.value;
  if (!/sort:\S+$/i.test(value)) return;

  const setter =
    target instanceof HTMLInputElement ? inputValueSetter : textareaValueSetter;
  if (!setter) return;

  const newValue = `${value} `;
  setter.call(target, newValue);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  target.setSelectionRange(newValue.length, newValue.length);
}

let observer: MutationObserver | null = null;
let focusListenerAdded = false;

export function applyDefaultSort(): void {
  // Rewrite existing links
  rewriteAll();

  // Watch for new links added by GitHub's SPA (Turbo)
  if (!observer) {
    observer = new MutationObserver(() => rewriteAll());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Search-input fallback: GitHub may strip trailing whitespace from `q`,
  // and direct navigation to a URL with `sort:` already set bypasses the
  // URL rewrite. Patch the input on focus instead.
  if (!focusListenerAdded) {
    document.addEventListener("focusin", (e) =>
      ensureTrailingSpaceOnFocus(e.target),
    );
    focusListenerAdded = true;
  }
}
