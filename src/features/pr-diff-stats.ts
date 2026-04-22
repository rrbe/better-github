import { isPRListPage, getRepoInfo } from "../lib/page-detect";
import { fetchPRDiffStats } from "../lib/github-api";
import { getOrCreateInfoRow } from "../lib/info-row";

const BADGE_CLASS = "better-github-diff-stats";

export async function injectPRDiffStats(): Promise<void> {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  if (document.querySelectorAll(`.${BADGE_CLASS}`).length > 0) return;

  const prRows = document.querySelectorAll("[id^='issue_']");
  const prNumbers: number[] = [];
  for (const row of prRows) {
    const id = row.getAttribute("id");
    if (!id) continue;
    prNumbers.push(parseInt(id.replace("issue_", ""), 10));
  }

  if (prNumbers.length === 0) return;

  const stats = await fetchPRDiffStats(info.owner, info.repo, prNumbers);
  if (stats.length === 0) return;

  const statsMap = new Map(stats.map((s) => [s.number, s]));

  for (const row of prRows) {
    const id = row.getAttribute("id");
    if (!id) continue;

    const prNumber = parseInt(id.replace("issue_", ""), 10);
    const stat = statsMap.get(prNumber);
    if (!stat) continue;

    if (row.querySelector(`.${BADGE_CLASS}`)) continue;

    const infoRow = getOrCreateInfoRow(row);
    if (!infoRow) continue;

    const badge = document.createElement("span");
    badge.className = BADGE_CLASS;
    badge.title = `${stat.additions} additions, ${stat.deletions} deletions across ${stat.changedFiles} file${stat.changedFiles === 1 ? "" : "s"}`;

    const add = document.createElement("span");
    add.className = `${BADGE_CLASS}-add`;
    add.textContent = `+${stat.additions.toLocaleString()}`;

    const del = document.createElement("span");
    del.className = `${BADGE_CLASS}-del`;
    del.textContent = `−${stat.deletions.toLocaleString()}`;

    const files = document.createElement("span");
    files.className = `${BADGE_CLASS}-files`;
    files.textContent = `${stat.changedFiles} file${stat.changedFiles === 1 ? "" : "s"}`;

    badge.appendChild(add);
    badge.appendChild(del);
    badge.appendChild(files);

    infoRow.appendChild(badge);
  }
}
