import { fetchActionsInProgressCount } from "../lib/github-api";
import { createNavCounter } from "../lib/nav-counter";
import { getRepoInfo, isRepoPage } from "../lib/page-detect";

const COUNTER_CLASS = "better-github-actions-in-progress-count";
const REFRESH_INTERVAL = 61 * 1000; // Longer than the service worker's 60-second cache.
const processedLinks = new WeakSet<HTMLAnchorElement>();
const pendingRequests = new WeakMap<HTMLAnchorElement, object>();
let activeLink: HTMLAnchorElement | null = null;
let activeRepo: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function stopRefreshing(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  if (activeLink) {
    processedLinks.delete(activeLink);
    pendingRequests.delete(activeLink);
  }
  activeLink = null;
  activeRepo = null;
}

function findActionsLink(owner: string, repo: string): HTMLAnchorElement | null {
  const nav =
    document.querySelector<HTMLElement>(".UnderlineNav-body") ||
    document.querySelector<HTMLElement>("nav[aria-label='Repository'] ul");
  if (!nav) return null;

  const path = `/${owner}/${repo}/actions`;
  return (
    Array.from(nav.querySelectorAll<HTMLAnchorElement>("a")).find(
      (link) => new URL(link.href, location.href).pathname === path,
    ) ?? null
  );
}

export function injectActionsInProgressCount(): void {
  if (!isRepoPage()) {
    stopRefreshing();
    return;
  }

  const info = getRepoInfo();
  if (!info) return;

  const link = findActionsLink(info.owner, info.repo);
  if (!link) {
    stopRefreshing();
    return;
  }
  const repo = `${info.owner}/${info.repo}`;
  if (activeLink !== link || activeRepo !== repo) stopRefreshing();
  if (processedLinks.has(link)) return;

  activeLink = link;
  activeRepo = repo;
  processedLinks.add(link);
  const request = {};
  pendingRequests.set(link, request);
  void appendCount(link, request, info.owner, info.repo);
}

async function appendCount(
  link: HTMLAnchorElement,
  request: object,
  owner: string,
  repo: string,
): Promise<void> {
  const count = await fetchActionsInProgressCount(owner, repo);
  if (pendingRequests.get(link) !== request) return;
  pendingRequests.delete(link);

  const currentRepo = getRepoInfo();
  if (!link.isConnected || currentRepo?.owner !== owner || currentRepo.repo !== repo) {
    stopRefreshing();
    return;
  }

  const existingCounter = link.querySelector<HTMLElement>(`.${COUNTER_CLASS}`);
  if (count === null || count === 0) {
    existingCounter?.remove();
  } else if (existingCounter) {
    const label = existingCounter.querySelector<HTMLElement>('[data-component="CounterLabel"]');
    if (label) label.textContent = String(count);
    const hiddenLabel = existingCounter.querySelector<HTMLElement>(
      '[class*="VisuallyHidden"], .sr-only',
    );
    if (hiddenLabel) hiddenLabel.textContent = `\u00a0(${count})`;
  } else {
    const nav = link.closest<HTMLElement>(".UnderlineNav-body, nav[aria-label='Repository'] ul");
    const nativeCounterTemplate = nav
      ?.querySelector<HTMLElement>('[data-component="counter"]')
      ?.cloneNode(true) as HTMLElement | undefined;
    const counter = createNavCounter(nativeCounterTemplate, count);
    counter.classList.add(COUNTER_CLASS);
    link.appendChild(counter);
  }

  refreshTimer = setTimeout(() => {
    const nextRequest = {};
    pendingRequests.set(link, nextRequest);
    void appendCount(link, nextRequest, owner, repo);
  }, REFRESH_INTERVAL);
}

export function cleanupActionsInProgressCount(): void {
  stopRefreshing();
  document.querySelectorAll<HTMLElement>(`.${COUNTER_CLASS}`).forEach((counter) => {
    counter.remove();
  });
}
