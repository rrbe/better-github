import {
  isReleasesPage,
  isReleaseDetailPage,
  getReleaseTag,
  getRepoInfo,
} from "../lib/page-detect";
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

/**
 * Parse a release-asset download URL into its tag + file name.
 * URLs look like `/{owner}/{repo}/releases/download/{tag}/{name}`; both the tag
 * and name are URL-encoded, and tags may themselves contain encoded slashes.
 */
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

  const decode = (s: string): string => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };

  return { tag: decode(segments.join("/")), name: decode(nameSeg) };
}

// The badge lives at the right edge of the asset-name column (pushed there with
// margin-left:auto in CSS), deliberately decoupled from the digest / size / date
// columns so the variable-width count never shifts their alignment. Return the
// top-level row child that contains the download link.
function findNameColumn(link: Element, row: Element): HTMLElement | null {
  for (const child of Array.from(row.children)) {
    if (child.contains(link)) return child as HTMLElement;
  }
  return null;
}

// Download counts span orders of magnitude, so bucket them on a roughly log
// scale: every threshold crossed bumps the heat one level. 1 = quietest (few
// downloads, stays muted), 10 = hottest (most-downloaded, full accent color).
const DOWNLOAD_HEAT_THRESHOLDS = [100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000];

export function getDownloadHeat(count: number): number {
  let level = 1;
  for (const threshold of DOWNLOAD_HEAT_THRESHOLDS) {
    if (count >= threshold) level++;
  }
  return level;
}

function buildBadge(count: number): HTMLSpanElement {
  const formatted = count.toLocaleString();
  const badge = document.createElement("span");
  badge.className = BADGE_CLASS;
  badge.dataset.betterGithubDlHeat = String(getDownloadHeat(count));
  badge.title = t("assetDownloadsTitle", formatted);
  badge.innerHTML = `${DOWNLOAD_ICON}<span>${escapeHtml(formatted)}</span>`;
  return badge;
}

export async function injectReleaseAssetDownloads(): Promise<void> {
  if (!isReleasesPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="/releases/download/"]');
  if (links.length === 0) return;

  // Single release page → fetch just that release (accurate for any age);
  // the index → fetch the newest page of releases in one request.
  const tag = isReleaseDetailPage() ? (getReleaseTag() ?? undefined) : undefined;
  const downloads = await fetchReleaseDownloads(info.owner, info.repo, tag);
  if (downloads.length === 0) return;

  const counts = new Map<string, number>();
  for (const d of downloads) {
    counts.set(`${d.tag}/${d.name}`, d.downloadCount);
  }

  for (const link of links) {
    const parsed = parseAssetHref(link.getAttribute("href"), info.owner, info.repo);
    if (!parsed) continue;

    const count = counts.get(`${parsed.tag}/${parsed.name}`);
    if (count === undefined) continue;

    const row = link.closest("li");
    if (!row || row.querySelector(`.${BADGE_CLASS}`)) continue;

    const nameCol = findNameColumn(link, row);
    if (!nameCol) continue;

    nameCol.appendChild(buildBadge(count));
  }
}
