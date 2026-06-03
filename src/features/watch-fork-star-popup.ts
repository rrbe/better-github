import { getRepoInfo } from "../lib/page-detect";
import { fetchStargazers, fetchWatchers, fetchForks } from "../lib/github-api";
import { escapeHtml } from "../lib/utils";
import { t } from "../lib/i18n";
import type { ForkInfo } from "../lib/github-api";

const WRAP_CLASS = "bg-wfs-counter-wrap";
const POPUP_CLASS = "bg-wfs-popup";

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

  function show() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
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
    openTimer = setTimeout(show, HOVER_OPEN_DELAY);
  });

  wrap.addEventListener("mouseleave", () => {
    // mouseleave only fires once the pointer leaves the counter *and* the popup
    // (a descendant), so by here the popup is dismissed and the title is safe.
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

function attachPopup(
  counter: HTMLElement,
  config: PopupConfig,
  loadData: (list: HTMLElement) => Promise<void>,
): void {
  if (counter.classList.contains(WRAP_CLASS)) return;

  counter.classList.add(WRAP_CLASS);

  const popup = createPopupElement(config);
  counter.appendChild(popup);

  // GitHub's own JS rewrites the stargazer counter's children after
  // hydration (e.g. setting textContent on `.js-social-count`), which
  // wipes our popup. Re-attach if that happens.
  const observer = new MutationObserver(() => {
    if (!counter.classList.contains(WRAP_CLASS)) {
      observer.disconnect();
      return;
    }
    if (popup.parentElement !== counter) counter.appendChild(popup);
  });
  observer.observe(counter, { childList: true });

  setupHover(counter, popup, async () => {
    const list = popup.querySelector(".bg-wfs-popup-list") as HTMLElement;
    await loadData(list);
  });
}

export function injectWatchForkStarPopup(): void {
  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  const { owner, repo } = repoInfo;

  // Check that pagehead-actions exist (repo page)
  const actions = document.querySelector("ul.pagehead-actions");
  if (!actions) return;

  // Watch counter (Primer React component — don't move it, attach in-place)
  const watchCounter = actions.querySelector('[class*="CounterLabel"]') as HTMLElement | null;
  if (watchCounter) {
    const countText = watchCounter.textContent?.trim() || "0";
    attachPopup(watchCounter, {
      title: t("watchers"),
      countText,
      viewAllUrl: `/${owner}/${repo}/watchers`,
    }, async (list) => {
      const data = await fetchWatchers(owner, repo);
      renderUserList(list, data, t("noWatchers"));
    });
  }

  // Fork counter
  const forkCounter = actions.querySelector("#fork-button .Counter") as HTMLElement | null;
  if (forkCounter) {
    const countText = forkCounter.textContent?.trim() || "0";
    attachPopup(forkCounter, {
      title: t("forks"),
      countText,
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
  const starCounters = actions.querySelectorAll(".Counter.js-social-count");
  for (const starCounter of starCounters) {
    const countText = starCounter.textContent?.trim() || "0";
    attachPopup(starCounter as HTMLElement, {
      title: t("stargazers"),
      countText,
      viewAllUrl: `/${owner}/${repo}/stargazers`,
    }, async (list) => {
      if (!starData) starData = await fetchStargazers(owner, repo);
      renderUserList(list, starData, t("noStargazers"));
    });
  }
}

export function cleanupWatchForkStarPopup(): void {
  for (const counter of document.querySelectorAll<HTMLElement>(`.${WRAP_CLASS}`)) {
    counter.classList.remove(WRAP_CLASS);
    // If we tear down mid-hover, give the counter its native title back.
    restoreNativeTitle(counter);
    counter.querySelectorAll(`.${POPUP_CLASS}`).forEach((popup) => popup.remove());
  }
}
