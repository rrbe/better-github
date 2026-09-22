import { fetchActionsInProgressCount } from "../lib/github-api";
import { createNavCounter } from "../lib/nav-counter";
import { getRepoInfo, isRepoPage } from "../lib/page-detect";

const COUNTER_CLASS = "better-github-actions-in-progress-count";
const processedLinks = new WeakSet<HTMLAnchorElement>();
const pendingRequests = new WeakMap<HTMLAnchorElement, object>();

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
  if (!isRepoPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  const link = findActionsLink(info.owner, info.repo);
  if (!link || processedLinks.has(link)) return;

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

  if (count === null || count === 0 || !link.isConnected) return;

  const currentRepo = getRepoInfo();
  if (currentRepo?.owner !== owner || currentRepo.repo !== repo) return;

  const nav = link.closest<HTMLElement>(".UnderlineNav-body, nav[aria-label='Repository'] ul");
  const nativeCounterTemplate = nav
    ?.querySelector<HTMLElement>('[data-component="counter"]')
    ?.cloneNode(true) as HTMLElement | undefined;
  const counter = createNavCounter(nativeCounterTemplate, count);
  counter.classList.add(COUNTER_CLASS);
  link.appendChild(counter);
}

export function cleanupActionsInProgressCount(): void {
  document.querySelectorAll<HTMLElement>(`.${COUNTER_CLASS}`).forEach((counter) => {
    const link = counter.closest<HTMLAnchorElement>("a");
    if (link) {
      processedLinks.delete(link);
      pendingRequests.delete(link);
    }
    counter.remove();
  });

  const info = getRepoInfo();
  if (!info) return;
  const link = findActionsLink(info.owner, info.repo);
  if (!link) return;
  processedLinks.delete(link);
  pendingRequests.delete(link);
}
