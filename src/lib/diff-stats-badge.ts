import { pluralize } from "./utils";

export interface DiffStats {
  additions: number;
  deletions: number;
  changedFiles: number | null;
}

export function buildDiffStatsBadge(stats: DiffStats, wrapperClass: string): HTMLSpanElement {
  const addStr = stats.additions.toLocaleString();
  const delStr = stats.deletions.toLocaleString();
  const filesStr =
    stats.changedFiles !== null
      ? `${stats.changedFiles.toLocaleString()} ${pluralize(stats.changedFiles, "file")}`
      : null;

  const badge = document.createElement("span");
  badge.className = wrapperClass;
  badge.title = filesStr
    ? `${addStr} additions, ${delStr} deletions across ${filesStr}`
    : `${addStr} additions, ${delStr} deletions`;

  const add = document.createElement("span");
  add.className = "better-github-diff-stats-add";
  add.textContent = `+${addStr}`;

  const del = document.createElement("span");
  del.className = "better-github-diff-stats-del";
  del.textContent = `−${delStr}`;

  badge.appendChild(add);
  badge.appendChild(del);

  if (filesStr) {
    const files = document.createElement("span");
    files.className = "better-github-diff-stats-files";
    files.textContent = filesStr;
    badge.appendChild(files);
  }

  return badge;
}
