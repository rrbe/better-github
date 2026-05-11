import { isCommitsListPage, getRepoInfo } from "../lib/page-detect";
import { fetchCommitDiffStats } from "../lib/github-api";
import { collectCommitRows, MAIN_CONTENT_INNER_SELECTOR } from "../lib/commit-dom";
import { buildDiffStatsBadge } from "../lib/diff-stats-badge";
import { clearSkeletons } from "../lib/info-row-skeleton";

const BADGE_CLASS = "better-github-commit-diff-stats";

export async function injectCommitDiffStats(): Promise<void> {
  if (!isCommitsListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  const shaToContainer = collectCommitRows(info.owner, info.repo);
  if (shaToContainer.size === 0) return;

  try {
    const stats = await fetchCommitDiffStats(info.owner, info.repo, [...shaToContainer.keys()]);
    if (stats.length === 0) return;

    const statsMap = new Map(stats.map((s) => [s.sha, s]));

    for (const [sha, container] of shaToContainer) {
      const stat = statsMap.get(sha);
      if (!stat) continue;
      if (container.querySelector(`.${BADGE_CLASS}`)) continue;

      const mainInner = container.querySelector<HTMLElement>(MAIN_CONTENT_INNER_SELECTOR);
      const parent = mainInner || container;
      parent.appendChild(buildDiffStatsBadge(stat, BADGE_CLASS));
    }
  } finally {
    clearSkeletons("commitDiff");
  }
}
