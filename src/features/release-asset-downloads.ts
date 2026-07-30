import { isReleasesPage, getRepoInfo, type RepoInfo } from "../lib/page-detect";
import { fetchReleaseDownloads } from "../lib/github-api";
import { escapeHtml } from "../lib/utils";
import { t } from "../lib/i18n";

const BADGE_CLASS = "better-github-asset-downloads";

// Octicon download-16 — matches GitHub's own icon set.
const DOWNLOAD_ICON = `<svg aria-hidden="true" height="14" viewBox="0 0 16 16" width="14" fill="currentColor" class="octicon"><path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"></path><path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z"></path></svg>`;

interface ParsedAsset {
  tag: string;
  name: string;
}

export function parseAssetHref(
  href: string | null,
  owner: string,
  repo: string,
): ParsedAsset | null {
  if (!href) return null;
  const path = href.split(/[?#]/)[0];

  const marker = "/releases/download/";
  const ownerPrefix = `/${owner}/${repo}${marker}`;
  let rest: string;
  if (path.startsWith(ownerPrefix)) {
    rest = path.slice(ownerPrefix.length);
  } else {
    const idx = path.indexOf(marker);
    if (idx === -1) return null;
    rest = path.slice(idx + marker.length);
  }

  const segments = rest.split("/");
  if (segments.length < 2) return null;
  const nameSeg = segments.pop();
  if (!nameSeg) return null;

  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  return { tag: decode(segments.join("/")), name: decode(nameSeg) };
}

function findNameColumn(link: Element, row: Element): HTMLElement | null {
  for (const child of Array.from(row.children)) {
    if (child.contains(link)) return child as HTMLElement;
  }
  return null;
}

const DOWNLOAD_HEAT_THRESHOLDS = [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000];

export function getDownloadHeat(count: number): number {
  let level = 1;
  for (const threshold of DOWNLOAD_HEAT_THRESHOLDS) {
    if (count >= threshold) level++;
  }
  return level;
}

function buildBadge(count: number, href: string): HTMLAnchorElement {
  const formatted = count.toLocaleString();
  const badge = document.createElement("a");
  badge.className = BADGE_CLASS;
  badge.href = href;
  badge.rel = "nofollow";
  badge.setAttribute("data-turbo", "false");
  badge.dataset.betterGithubDlHeat = String(getDownloadHeat(count));
  badge.title = t("assetDownloadsTitle", formatted);
  badge.innerHTML = `${escapeHtml(formatted)}<span>${DOWNLOAD_ICON}</span>`;
  return badge;
}

interface PendingAsset {
  link: HTMLAnchorElement;
  name: string;
  href: string;
}

let observer: MutationObserver | null = null;
let rafId: number | null = null;
let runId = 0;

async function injectTag(
  info: RepoInfo,
  tag: string,
  items: PendingAsset[],
  activeRun: number,
): Promise<void> {
  const downloads = await fetchReleaseDownloads(info.owner, info.repo, tag);
  if (activeRun !== runId || downloads.length === 0) return;

  const counts = new Map<string, number>();
  for (const download of downloads) counts.set(download.name, download.downloadCount);

  for (const { link, name, href } of items) {
    const count = counts.get(name);
    if (count === undefined) continue;

    const row = link.closest("li");
    if (!row || row.querySelector(`.${BADGE_CLASS}`)) continue;

    const nameColumn = findNameColumn(link, row);
    if (nameColumn) nameColumn.appendChild(buildBadge(count, href));
  }
}

async function processVisibleAssets(info: RepoInfo, activeRun: number): Promise<void> {
  const links = document.querySelectorAll<HTMLAnchorElement>(
    `a[href*="/releases/download/"]:not(.${BADGE_CLASS}):not([data-bg-dl-seen])`,
  );
  if (links.length === 0) return;

  const byTag = new Map<string, PendingAsset[]>();
  for (const link of links) {
    link.dataset.bgDlSeen = "1";
    const href = link.getAttribute("href");
    const parsed = parseAssetHref(href, info.owner, info.repo);
    if (!href || !parsed) continue;
    const item: PendingAsset = { link, name: parsed.name, href };
    const group = byTag.get(parsed.tag);
    if (group) group.push(item);
    else byTag.set(parsed.tag, [item]);
  }

  await Promise.all([...byTag].map(([tag, items]) => injectTag(info, tag, items, activeRun)));
}

export async function injectReleaseAssetDownloads(): Promise<void> {
  cleanupReleaseAssetDownloads();
  const activeRun = runId;
  if (!isReleasesPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  observer = new MutationObserver(() => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      void processVisibleAssets(info, activeRun);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  await processVisibleAssets(info, activeRun);
}

export function cleanupReleaseAssetDownloads(): void {
  runId++;
  observer?.disconnect();
  observer = null;
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  document.querySelectorAll<HTMLElement>("[data-bg-dl-seen]").forEach((element) => {
    delete element.dataset.bgDlSeen;
  });
}
