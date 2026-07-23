import { getRepoInfo } from "../lib/page-detect";
import { fetchStargazers, fetchWatchers, fetchForks } from "../lib/github-api";
import { escapeHtml } from "../lib/utils";
import { t } from "../lib/i18n";
import type { ForkInfo } from "../lib/github-api";

const WRAP_CLASS = "bg-wfs-counter-wrap";
const POPUP_CLASS = "bg-wfs-popup";
const ACCESS_RESTRICTIONS_URL =
  "https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/";

// Must match `.bg-wfs-popup { width }` in content.css — the popup is portaled to
// <body> and positioned with fixed coordinates, so JS needs the width to right-
// align it under the counter.
const POPUP_WIDTH = 280;
// Gap between the counter's bottom edge and the popup (matches the hover bridge).
const POPUP_GAP = 8;

// The popup lives in <body>, detached from its counter (see `attachPopup`), so we
// can't rely on DOM ancestry to tie the two together. Track ownership here to
// reap orphaned popups when their counter leaves the page on SPA navigation.
const popupOwner = new WeakMap<HTMLElement, HTMLElement>();

// GitHub puts the exact count in a native `title` on the counter span (e.g.
// title="1,234" behind a visible "1.2k"). Our popup attaches to that same span,
// so the browser tooltip would otherwise overlap it. We stash the title here
// while the pointer is over the counter and restore it on leave / cleanup.
const STASH_ATTR = "data-bg-wfs-title";

const HOVER_OPEN_DELAY = 300;
const HOVER_CLOSE_DELAY = 200;

/** Hide the counter's native `title` tooltip so it can't overlap our popup. */
function suppressNativeTitle(wrap: HTMLElement): void {
  const title = wrap.getAttribute("title");
  if (title === null) return;
  wrap.setAttribute(STASH_ATTR, title);
  wrap.removeAttribute("title");
}

/** Put the stashed native `title` back once the popup is no longer in play. */
function restoreNativeTitle(wrap: HTMLElement): void {
  const stashed = wrap.getAttribute(STASH_ATTR);
  if (stashed === null) return;
  wrap.setAttribute("title", stashed);
  wrap.removeAttribute(STASH_ATTR);
}

interface PopupConfig {
  title: string;
  countText: string;
  viewAllUrl: string;
}

function createSkeletonRows(): string {
  return Array.from({ length: 4 }, () =>
    `<div class="bg-wfs-skeleton-row">
      <div class="bg-wfs-skeleton-avatar"></div>
      <div class="bg-wfs-skeleton-lines">
        <div class="bg-wfs-skeleton-line bg-wfs-skeleton-line-long"></div>
        <div class="bg-wfs-skeleton-line bg-wfs-skeleton-line-short"></div>
      </div>
    </div>`
  ).join("");
}

function createPopupElement(config: PopupConfig): HTMLDivElement {
  const popup = document.createElement("div");
  popup.className = POPUP_CLASS;
  popup.innerHTML = `
    <div class="bg-wfs-popup-header">
      <span>${config.title}</span>
      <span>${config.countText}</span>
    </div>
    <div class="bg-wfs-popup-list">
      ${createSkeletonRows()}
    </div>
    <div class="bg-wfs-popup-footer">
      <a href="${config.viewAllUrl}">${t("viewAll")}</a>
    </div>
  `;
  return popup;
}

function renderUserList(
  list: HTMLElement,
  items: Array<{ login: string; avatarUrl: string; name: string | null }>,
  emptyMsg: string,
): void {
  if (items.length === 0) {
    list.innerHTML = `<div class="bg-wfs-popup-empty">${emptyMsg}</div>`;
    return;
  }
  list.innerHTML = items.map((user) => `
    <a class="bg-wfs-popup-item" href="https://github.com/${escapeHtml(user.login)}">
      <img src="${escapeHtml(user.avatarUrl)}&s=56" alt="${escapeHtml(user.login)}" loading="lazy">
      <div class="bg-wfs-popup-user-info">
        <span class="bg-wfs-popup-username">${escapeHtml(user.login)}</span>
        ${user.name ? `<span class="bg-wfs-popup-sub">${escapeHtml(user.name)}</span>` : ""}
      </div>
    </a>
  `).join("");
}

function renderSocialList(
  list: HTMLElement,
  data: Awaited<ReturnType<typeof fetchStargazers | typeof fetchWatchers>>,
  emptyMsg: string,
): void {
  if (Array.isArray(data)) {
    renderUserList(list, data, emptyMsg);
    return;
  }

  list.innerHTML = `<div class="bg-wfs-popup-empty">
    <a href="${ACCESS_RESTRICTIONS_URL}" target="_blank" rel="noopener noreferrer">
      ${t("githubAccessRestrictions")}
    </a>
  </div>`;
}

function renderForks(list: HTMLElement, items: ForkInfo[]): void {
  if (items.length === 0) {
    list.innerHTML = `<div class="bg-wfs-popup-empty">${t("noForks")}</div>`;
    return;
  }
  list.innerHTML = items.map((fork) => `
    <a class="bg-wfs-popup-item" href="https://github.com/${escapeHtml(fork.fullName)}">
      <img src="${escapeHtml(fork.ownerAvatarUrl)}&s=56" alt="${escapeHtml(fork.owner)}" loading="lazy">
      <div class="bg-wfs-popup-user-info">
        <span class="bg-wfs-popup-username">${escapeHtml(fork.fullName)}</span>
        ${fork.description ? `<span class="bg-wfs-popup-sub">${escapeHtml(fork.description)}</span>` : ""}
      </div>
    </a>
  `).join("");
}

function setupHover(
  wrap: HTMLElement,
  popup: HTMLDivElement,
  loadData: () => Promise<void>,
): void {
  let openTimer: ReturnType<typeof setTimeout> | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let loaded = false;

  function positionPopup() {
    // The popup is `position: fixed` in <body>, so place it in viewport coords
    // right-aligned under the counter — matching the old in-anchor `right: 0`.
    const rect = wrap.getBoundingClientRect();
    popup.style.top = `${rect.bottom + POPUP_GAP}px`;
    popup.style.left = `${Math.max(POPUP_GAP, rect.right - POPUP_WIDTH)}px`;
  }

  function show() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    positionPopup();
    popup.style.display = "block";
    if (!loaded) {
      loaded = true;
      loadData().catch(() => {
        const list = popup.querySelector(".bg-wfs-popup-list");
        if (list) list.innerHTML = `<div class="bg-wfs-popup-empty">${t("failedToLoad")}</div>`;
      });
    }
  }

  function hide() {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    closeTimer = setTimeout(() => {
      popup.style.display = "none";
    }, HOVER_CLOSE_DELAY);
  }

  wrap.addEventListener("mouseenter", () => {
    // Drop the native tooltip up front — our popup opens at HOVER_OPEN_DELAY,
    // which beats the browser's title delay, so it never gets a chance to show.
    suppressNativeTitle(wrap);
    // Re-entering the counter (e.g. moving back up from the popup) cancels a
    // pending close so the open popup doesn't flicker shut.
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    openTimer = setTimeout(show, HOVER_OPEN_DELAY);
  });

  wrap.addEventListener("mouseleave", () => {
    // The popup is portaled to <body>, so leaving the counter fires this even
    // while heading into the popup. Restoring the title here is safe — the
    // tooltip only shows over the counter, which the pointer has left; moving
    // onto the popup cancels the close below, and re-entering re-suppresses.
    restoreNativeTitle(wrap);
    hide();
  });

  // Keep popup open when hovering directly over it
  popup.addEventListener("mouseenter", () => {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  });

  popup.addEventListener("mouseleave", () => {
    hide();
  });
}

/** Remove popups whose owning counter has left the page (e.g. SPA navigation). */
function reapOrphanedPopups(): void {
  for (const popup of document.querySelectorAll<HTMLElement>(`.${POPUP_CLASS}`)) {
    const owner = popupOwner.get(popup);
    if (!owner || !owner.isConnected) popup.remove();
  }
}

function attachPopup(
  counter: HTMLElement,
  config: PopupConfig,
  loadData: (list: HTMLElement) => Promise<void>,
): void {
  if (counter.classList.contains(WRAP_CLASS)) return;

  counter.classList.add(WRAP_CLASS);

  // GitHub nests the star/fork counters inside their own `<a>`/`<button>`
  // (e.g. `<a href=".../stargazers">`). Appending the popup there traps its
  // user links inside that anchor, so clicking a stargazer resolves to the
  // wrapping anchor and navigates to the stargazers list instead of the user.
  // `stopPropagation` can't fix this reliably (GitHub binds clicks in the
  // capture phase, and nested anchors are invalid HTML with no spec'd target).
  // Portal the popup to <body> and position it with `position: fixed` so it
  // lives outside any anchor — user links then navigate natively, keeping
  // Cmd/Ctrl/middle-click "open in new tab" for free.
  const popup = createPopupElement(config);
  popupOwner.set(popup, counter);
  document.body.appendChild(popup);

  setupHover(counter, popup, async () => {
    const list = popup.querySelector(".bg-wfs-popup-list") as HTMLElement;
    await loadData(list);
  });
}

export function injectWatchForkStarPopup(): void {
  // Popups are portaled to <body>, so a prior page's popups don't get removed
  // with their counter on SPA navigation — sweep them before re-injecting.
  reapOrphanedPopups();

  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  const { owner, repo } = repoInfo;

  const watchTargets = document.querySelectorAll<HTMLElement>(
    'ul.pagehead-actions [class*="CounterLabel"], ' +
      '[data-testid="notifications-subscriptions-menu-button"] [data-component="CounterLabel"]',
  );
  for (const watchTarget of watchTargets) {
    attachPopup(watchTarget, {
      title: t("watchers"),
      countText: watchTarget.textContent?.trim() || "0",
      viewAllUrl: `/${owner}/${repo}/watchers`,
    }, async (list) => {
      const data = await fetchWatchers(owner, repo);
      renderSocialList(list, data, t("noWatchers"));
    });
  }

  const forkTargets = document.querySelectorAll<HTMLElement>(
    'ul.pagehead-actions #fork-button .Counter, ' +
      '[data-testid="fork-button"] [data-component="CounterLabel"]',
  );
  for (const forkTarget of forkTargets) {
    attachPopup(forkTarget, {
      title: t("forks"),
      countText: forkTarget.textContent?.trim() || "0",
      viewAllUrl: `/${owner}/${repo}/forks`,
    }, async (list) => {
      const data = await fetchForks(owner, repo);
      renderForks(list, data);
    });
  }

  // Star counter — attach to ALL counters (both starred/unstarred forms)
  // so the popup works regardless of toggle state.
  // Share fetched data so toggling star state doesn't re-fetch.
  let starData: Awaited<ReturnType<typeof fetchStargazers>> | null = null;
  const starTargets = document.querySelectorAll<HTMLElement>(
    'ul.pagehead-actions .Counter.js-social-count, ' +
      '[data-testid="star-button"] [data-component="CounterLabel"]',
  );
  for (const starTarget of starTargets) {
    attachPopup(starTarget, {
      title: t("stargazers"),
      countText: starTarget.textContent?.trim() || "0",
      viewAllUrl: `/${owner}/${repo}/stargazers`,
    }, async (list) => {
      if (!starData) starData = await fetchStargazers(owner, repo);
      renderSocialList(list, starData, t("noStargazers"));
    });
  }
}

export function cleanupWatchForkStarPopup(): void {
  for (const counter of document.querySelectorAll<HTMLElement>(`.${WRAP_CLASS}`)) {
    counter.classList.remove(WRAP_CLASS);
    // If we tear down mid-hover, give the counter its native title back.
    restoreNativeTitle(counter);
  }
  // Popups live in <body> (portaled out of the counter), so remove them by class.
  document.querySelectorAll<HTMLElement>(`.${POPUP_CLASS}`).forEach((popup) => popup.remove());
}
