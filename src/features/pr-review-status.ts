import { isPRListPage, getRepoInfo } from "../lib/page-detect";
import { fetchPRReviewStatuses, fetchReviewThreadDetails } from "../lib/github-api";
import type { ReviewThreadDetail } from "../lib/messages";
import { insertInfoRowItem } from "../lib/info-row";
import { collectPRRows } from "../lib/pr-list-dom";
// Aliased to `i18n` because this module already uses `t` as a thread loop var.
import { t as i18n } from "../lib/i18n";

const STATUS_CLASS = "better-github-review-status";
const POPOVER_CLASS = "better-github-review-popover";
const OPEN_CLASS = "better-github-review-popover-open";

/** Cap the list so a PR with dozens of threads can't grow an unwieldy popover. */
const MAX_POPOVER_ITEMS = 8;

/** Collapse every open popover (used by the outside-click / Escape handlers). */
function closeAllPopovers(): void {
  for (const open of document.querySelectorAll(`.${OPEN_CLASS}`)) {
    open.classList.remove(OPEN_CLASS);
    open.setAttribute("aria-expanded", "false");
  }
}

// A single pair of document-level listeners dismisses popovers on an outside
// click or Escape — attached once, no matter how often the feature re-injects.
let globalListenersAttached = false;
function ensureGlobalListeners(): void {
  if (globalListenersAttached) return;
  globalListenersAttached = true;
  // Badge clicks call stopPropagation, so this only fires for clicks elsewhere.
  document.addEventListener("click", closeAllPopovers);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllPopovers();
  });
}

/**
 * Wire a badge to open/close its popover on click (and keyboard). `onOpen` runs
 * every time the popover transitions to open, so the caller can lazily load and
 * cache its contents (and retry after a failed load).
 */
function makeBadgeInteractive(badge: HTMLElement, onOpen: () => void): void {
  badge.setAttribute("role", "button");
  badge.setAttribute("tabindex", "0");
  // "dialog" rather than "true"/"menu": the popover is a list of links, not a menu.
  badge.setAttribute("aria-haspopup", "dialog");
  badge.setAttribute("aria-expanded", "false");

  const toggle = () => {
    const willOpen = !badge.classList.contains(OPEN_CLASS);
    closeAllPopovers();
    badge.classList.toggle(OPEN_CLASS, willOpen);
    badge.setAttribute("aria-expanded", String(willOpen));
    if (willOpen) onOpen();
  };

  // Only react to events on the badge itself; events bubbling up from inside the
  // popover (a thread row click, Enter on a focused link) are left to navigate.
  badge.addEventListener("click", (e) => {
    if (e.target !== badge) return;
    e.stopPropagation(); // don't let the document handler immediately re-close it
    toggle();
  });
  badge.addEventListener("keydown", (e) => {
    if (e.target !== badge) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  });

  ensureGlobalListeners();
}

/** Octicon `comment` (16px) — GitHub's own glyph for review conversations. */
const COMMENT_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"></path>' +
  "</svg>";

/** Last path segment, so a long `a/b/c/file.ts` shows as just `file.ts`. */
function basename(path: string): string {
  if (!path) return "";
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Empty popover shell: just the caret and the click-trap. Its body is filled in
 * later (loading message → thread rows, or an error message) so the actual
 * thread details can be fetched lazily on first open.
 */
function createPopoverShell(): HTMLElement {
  const popover = document.createElement("div");
  popover.className = POPOVER_CLASS;

  // Keep clicks inside the popover from reaching the document dismiss handler, so
  // it stays open while a thread link navigates (and selecting text won't close it).
  popover.addEventListener("click", (e) => e.stopPropagation());

  // Upward caret pointing back at the badge — stays put across content swaps.
  const caret = document.createElement("span");
  caret.className = "better-github-review-popover-caret";
  popover.appendChild(caret);

  return popover;
}

/** Swap the popover body, preserving the caret (its first child). */
function setPopoverBody(popover: HTMLElement, ...nodes: Node[]): void {
  while (popover.childNodes.length > 1) {
    popover.removeChild(popover.lastChild as ChildNode);
  }
  popover.append(...nodes);
}

/** A single muted status line (loading / load-failed) inside the popover. */
function buildMessage(text: string): HTMLElement {
  const message = document.createElement("div");
  message.className = "better-github-review-popover-message";
  message.textContent = text;
  return message;
}

/**
 * Build the rows listing each unresolved thread. Styled after GitHub's own
 * hovercard / checks dropdown: a bordered header and tidy rows. Long text is
 * tamed entirely in CSS (path → basename + ellipsis, body → 2-line clamp), so
 * the popover keeps a fixed width no matter how verbose a comment is. Each row
 * links to its first comment's `#discussion_r…` anchor.
 */
function buildThreadRows(threads: ReviewThreadDetail[]): Node[] {
  const nodes: Node[] = [];

  // Header row, like "3 unresolved threads" with a comment glyph.
  const header = document.createElement("div");
  header.className = "better-github-review-popover-header";
  const icon = document.createElement("span");
  icon.className = "better-github-review-popover-header-icon";
  icon.innerHTML = COMMENT_ICON;
  const headerLabel = document.createElement("span");
  headerLabel.textContent = i18n(
    threads.length === 1 ? "reviewHeaderOne" : "reviewHeaderOther",
    String(threads.length),
  );
  header.append(icon, headerLabel);
  nodes.push(header);

  for (const t of threads.slice(0, MAX_POPOVER_ITEMS)) {
    // An <a> so clicking jumps straight to the thread; falls back to a div when
    // the API gave us no permalink.
    const item = document.createElement(t.url ? "a" : "div");
    item.className = "better-github-review-popover-item";
    if (t.url && item instanceof HTMLAnchorElement) {
      item.href = t.url;
    }

    const head = document.createElement("div");
    head.className = "better-github-review-popover-loc";
    const file = t.path ? basename(t.path) : i18n("reviewGeneralComment");
    const locText = document.createElement("span");
    locText.className = "better-github-review-popover-loc-text";
    locText.textContent = t.line != null ? `${file}:${t.line}` : file;
    // Full path goes on `aria-label`, not `title`: a native tooltip here would
    // hover-overlap the very popover this feature is meant to keep clean.
    if (t.path) locText.setAttribute("aria-label", t.line != null ? `${t.path}:${t.line}` : t.path);
    head.appendChild(locText);
    if (t.isOutdated) {
      const tag = document.createElement("span");
      tag.className = "better-github-review-popover-outdated";
      tag.textContent = i18n("reviewOutdated");
      head.appendChild(tag);
    }

    const body = document.createElement("div");
    body.className = "better-github-review-popover-body";
    const author = t.author ? `@${t.author}` : "";
    const snippet = t.snippet.trim();
    body.textContent =
      author && snippet ? `${author}: ${snippet}` : author || snippet || i18n("reviewNoComment");

    item.appendChild(head);
    item.appendChild(body);
    nodes.push(item);
  }

  if (threads.length > MAX_POPOVER_ITEMS) {
    const more = document.createElement("div");
    more.className = "better-github-review-popover-more";
    more.textContent = i18n("reviewMore", String(threads.length - MAX_POPOVER_ITEMS));
    nodes.push(more);
  }

  return nodes;
}

/**
 * Attach a lazily-loaded thread popover to an unresolved badge. The heavy
 * detail query runs only when the badge is first opened; a failed or empty
 * load shows a "couldn't load" message and is retried on the next open (the
 * count on the badge itself never depended on this fetch).
 */
function setupPopover(
  badge: HTMLElement,
  owner: string,
  repo: string,
  prNumber: number,
): void {
  badge.classList.add("better-github-review-has-popover");

  const popover = createPopoverShell();
  badge.appendChild(popover);

  let state: "idle" | "loading" | "loaded" = "idle";
  const load = async () => {
    if (state !== "idle") return; // in flight or already populated
    state = "loading";
    setPopoverBody(popover, buildMessage(i18n("loading")));

    let details: ReviewThreadDetail[] = [];
    try {
      details = (await fetchReviewThreadDetails(owner, repo, prNumber)) ?? [];
    } catch {
      details = [];
    }

    // We only attach popovers to badges that already counted ≥1 unresolved
    // thread, so an empty result means the detail fetch failed (or the threads
    // were resolved since the list query). Either way, let a later click retry.
    if (details.length === 0) {
      setPopoverBody(popover, buildMessage(i18n("reviewLoadFailed")));
      state = "idle";
      return;
    }

    setPopoverBody(popover, ...buildThreadRows(details));
    state = "loaded";
  };

  makeBadgeInteractive(badge, load);
}

export async function injectPRReviewStatus(): Promise<void> {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  // Skip if already injected
  if (document.querySelectorAll(`.${STATUS_CLASS}`).length > 0) return;

  const prRows = collectPRRows();
  const prNumbers = [...prRows.keys()];
  if (prNumbers.length === 0) return;

  const statuses = await fetchPRReviewStatuses(info.owner, info.repo, prNumbers);

  if (statuses.length === 0) return;

  const statusMap = new Map(statuses.map((s) => [s.number, s]));

  for (const [prNumber, row] of prRows) {
    const status = statusMap.get(prNumber);
    if (!status || status.totalThreads === 0) continue;

    if (row.querySelector(`.${STATUS_CLASS}`)) continue;

    const badge = document.createElement("span");
    badge.className = STATUS_CLASS;

    const allResolved = status.resolvedThreads === status.totalThreads;
    const unresolved = status.totalThreads - status.resolvedThreads;

    if (allResolved) {
      badge.classList.add("better-github-review-resolved");
      badge.textContent = i18n("reviewAllResolved");
      badge.title = i18n("reviewAllResolvedTitle", String(status.totalThreads));
    } else {
      badge.classList.add("better-github-review-unresolved");
      badge.textContent = i18n("reviewUnresolved", String(unresolved));
      // The click popover is the richer summary and is loaded lazily on open;
      // we deliberately set no native `title` here, as it would hover-overlap
      // the open popover.
      setupPopover(badge, info.owner, info.repo, prNumber);
    }

    insertInfoRowItem(row, "review", badge);
  }
}
