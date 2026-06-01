import { getRepoInfo } from "../lib/page-detect";
import { fetchStargazers, fetchWatchers, fetchForks } from "../lib/github-api";
import { escapeHtml } from "../lib/utils";
import type { ForkInfo } from "../lib/github-api";

const WRAP_CLASS = "bg-wfs-counter-wrap";
const POPUP_CLASS = "bg-wfs-popup";

const HOVER_OPEN_DELAY = 300;
const HOVER_CLOSE_DELAY = 200;

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
      <a href="${config.viewAllUrl}">View all</a>
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
    list.innerHTML = `<div class="bg-wfs-popup-empty">No forks yet</div>`;
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
        if (list) list.innerHTML = `<div class="bg-wfs-popup-empty">Failed to load</div>`;
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
    openTimer = setTimeout(show, HOVER_OPEN_DELAY);
  });

  wrap.addEventListener("mouseleave", () => {
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
      title: "Watchers",
      countText,
      viewAllUrl: `/${owner}/${repo}/watchers`,
    }, async (list) => {
      const data = await fetchWatchers(owner, repo);
      renderUserList(list, data, "No watchers yet");
    });
  }

  // Fork counter
  const forkCounter = actions.querySelector("#fork-button .Counter") as HTMLElement | null;
  if (forkCounter) {
    const countText = forkCounter.textContent?.trim() || "0";
    attachPopup(forkCounter, {
      title: "Forks",
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
      title: "Stargazers",
      countText,
      viewAllUrl: `/${owner}/${repo}/stargazers`,
    }, async (list) => {
      if (!starData) starData = await fetchStargazers(owner, repo);
      renderUserList(list, starData, "No stargazers yet");
    });
  }
}

export function cleanupWatchForkStarPopup(): void {
  for (const counter of document.querySelectorAll<HTMLElement>(`.${WRAP_CLASS}`)) {
    counter.classList.remove(WRAP_CLASS);
    counter.querySelectorAll(`.${POPUP_CLASS}`).forEach((popup) => popup.remove());
  }
}
