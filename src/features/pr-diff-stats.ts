import { collectPRRows } from "../lib/pr-list-dom";
import { isPRListPage, getRepoInfo } from "../lib/page-detect";
import { fetchPRDiffStats } from "../lib/github-api";
import { insertInfoRowItem } from "../lib/info-row";
import { buildDiffStatsBadge } from "../lib/diff-stats-badge";
import { clearSkeletons } from "../lib/info-row-skeleton";

const BADGE_CLASS = "better-github-diff-stats";

export async function injectPRDiffStats(): Promise<void> {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  const prRows = new Map(
    [...collectPRRows(info.owner, info.repo)].filter(([, row]) => !row.querySelector(`.${BADGE_CLASS}`)),
  );
  const prNumbers = [...prRows.keys()];
  if (prNumbers.length === 0) return;

  try {
    const stats = await fetchPRDiffStats(info.owner, info.repo, prNumbers);
    if (stats.length === 0) return;

    const statsMap = new Map(stats.map((s) => [s.number, s]));

    for (const [prNumber, row] of prRows) {
      if (!row.isConnected) continue;
      const stat = statsMap.get(prNumber);
      if (!stat) continue;

      if (row.querySelector(`.${BADGE_CLASS}`)) continue;

      insertInfoRowItem(row, "diff", buildDiffStatsBadge(stat, BADGE_CLASS));
    }
  } finally {
    clearSkeletons("prDiff");
  }
}
