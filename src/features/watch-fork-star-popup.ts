import { getRepoInfo } from "../lib/page-detect";
import { fetchStargazers, fetchWatchers, fetchForks } from "../lib/github-api";
import type { StargazerInfo, WatcherInfo, ForkInfo } from "../lib/github-api";

const WRAP_CLASS = "bg-wfs-counter-wrap";
const POPUP_CLASS = "bg-wfs-popup";

const HOVER_OPEN_DELAY = 300;
const HOVER_CLOSE_DELAY = 200;

interface PopupConfig {
  type: "stargazers" | "watchers" | "forks";
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

function renderStargazers(list: HTMLElement, items: StargazerInfo[]): void {
  if (items.length === 0) {
    list.innerHTML = `<div class="bg-wfs-popup-empty">No stargazers yet</div>`;
    return;
  }
  list.innerHTML = items.map((user) => `
    <a class="bg-wfs-popup-item" href="https://github.com/${user.login}">
      <img src="${user.avatarUrl}&s=56" alt="${user.login}" loading="lazy">
      <div class="bg-wfs-popup-user-info">
        <span class="bg-wfs-popup-username">${user.login}</span>
        ${user.name ? `<span class="bg-wfs-popup-sub">${escapeHtml(user.name)}</span>` : ""}
      </div>
    </a>
  `).join("");
}

function renderWatchers(list: HTMLElement, items: WatcherInfo[]): void {
  if (items.length === 0) {
    list.innerHTML = `<div class="bg-wfs-popup-empty">No watchers yet</div>`;
    return;
  }
  list.innerHTML = items.map((user) => `
    <a class="bg-wfs-popup-item" href="https://github.com/${user.login}">
      <img src="${user.avatarUrl}&s=56" alt="${user.login}" loading="lazy">
      <div class="bg-wfs-popup-user-info">
        <span class="bg-wfs-popup-username">${user.login}</span>
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
    <a class="bg-wfs-popup-item" href="https://github.com/${fork.fullName}">
      <img src="${fork.ownerAvatarUrl}&s=56" alt="${fork.owner}" loading="lazy">
      <div class="bg-wfs-popup-user-info">
        <span class="bg-wfs-popup-username">${escapeHtml(fork.fullName)}</span>
        ${fork.description ? `<span class="bg-wfs-popup-sub">${escapeHtml(fork.description)}</span>` : ""}
      </div>
    </a>
  `).join("");
}

function escapeHtml(text: string): string {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
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
}

function wrapCounter(
  counter: Element,
  config: PopupConfig,
  loadData: (list: HTMLElement) => Promise<void>,
): void {
  if (counter.closest(`.${WRAP_CLASS}`)) return;

  const wrap = document.createElement("span");
  wrap.className = WRAP_CLASS;
  counter.parentNode!.insertBefore(wrap, counter);
  wrap.appendChild(counter);

  const popup = createPopupElement(config);
  wrap.appendChild(popup);

  setupHover(wrap, popup, async () => {
    const list = popup.querySelector(".bg-wfs-popup-list") as HTMLElement;
    await loadData(list);
  });
}

export function injectWatchForkStarPopup(): void {
  const repoInfo = getRepoInfo();
  if (!repoInfo) return;

  // Already injected
  if (document.querySelector(`.${WRAP_CLASS}`)) return;

  const { owner, repo } = repoInfo;

  // Check that pagehead-actions exist (repo page)
  const actions = document.querySelector("ul.pagehead-actions");
  if (!actions) return;

  // Watch counter (Primer React component)
  const watchCounter = actions.querySelector('[class*="CounterLabel"]');
  if (watchCounter) {
    const countText = watchCounter.textContent?.trim() || "0";
    wrapCounter(watchCounter, {
      type: "watchers",
      title: "Watchers",
      countText,
      viewAllUrl: `/${owner}/${repo}/watchers`,
    }, async (list) => {
      const data = await fetchWatchers(owner, repo);
      renderWatchers(list, data);
    });
  }

  // Fork counter
  const forkButton = actions.querySelector("#fork-button");
  const forkCounter = forkButton?.querySelector(".Counter");
  if (forkCounter) {
    const countText = forkCounter.textContent?.trim() || "0";
    wrapCounter(forkCounter, {
      type: "forks",
      title: "Forks",
      countText,
      viewAllUrl: `/${owner}/${repo}/forks`,
    }, async (list) => {
      const data = await fetchForks(owner, repo);
      renderForks(list, data);
    });
  }

  // Star counter — there can be multiple .Counter.js-social-count, pick the visible one
  const starCounters = actions.querySelectorAll(".Counter.js-social-count");
  for (const starCounter of starCounters) {
    const rect = (starCounter as HTMLElement).getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    const countText = starCounter.textContent?.trim() || "0";
    wrapCounter(starCounter, {
      type: "stargazers",
      title: "Stargazers",
      countText,
      viewAllUrl: `/${owner}/${repo}/stargazers`,
    }, async (list) => {
      const data = await fetchStargazers(owner, repo);
      renderStargazers(list, data);
    });
    break;
  }
}
