import { isPRListPage, getRepoInfo } from "../lib/page-detect";
import { fetchPRConflictStatuses } from "../lib/github-api";
import { insertInfoRowItem } from "../lib/info-row";
import { collectPRRows, getPRNumber } from "../lib/pr-list-dom";
import { t } from "../lib/i18n";

const INDICATOR_CLASS = "better-github-conflict-indicator";

let observer: IntersectionObserver | null = null;
let observedRepo: string | null = null;
let checkedRows = new WeakSet<Element>();
let generation = 0;

function hasConflictLabel(row: Element): boolean {
  return [...row.querySelectorAll(".IssueLabel")].some((label) =>
    /^conflicts?$/i.test(
      label.getAttribute("data-name")?.trim() || label.textContent?.trim() || "",
    ),
  );
}

async function checkRows(
  rows: Element[],
  owner: string,
  repo: string,
  currentGeneration: number,
): Promise<void> {
  const rowByNumber = new Map<number, Element>();
  for (const row of rows) {
    const number = getPRNumber(row);
    if (number !== null && !hasConflictLabel(row)) rowByNumber.set(number, row);
  }
  if (rowByNumber.size === 0) return;

  const statuses = await fetchPRConflictStatuses(owner, repo, [...rowByNumber.keys()]);
  if (currentGeneration !== generation) return;

  const statusByNumber = new Map(statuses.map(({ number, mergeable }) => [number, mergeable]));
  for (const [number, row] of rowByNumber) {
    const mergeable = statusByNumber.get(number);
    if (mergeable !== "MERGEABLE" && mergeable !== "CONFLICTING") {
      checkedRows.delete(row);
      continue;
    }
    if (mergeable !== "CONFLICTING") continue;

    if (!row?.isConnected || row.querySelector(`.${INDICATOR_CLASS}`) || hasConflictLabel(row)) {
      continue;
    }

    const indicator = document.createElement("span");
    indicator.className = INDICATOR_CLASS;
    indicator.textContent = t("prConflicts");
    indicator.title = t("prConflictsTitle");
    indicator.setAttribute("role", "status");
    insertInfoRowItem(row, "conflict", indicator);
  }
}

export function cleanupPRConflictIndicator(): void {
  generation++;
  observer?.disconnect();
  observer = null;
  observedRepo = null;
  checkedRows = new WeakSet<Element>();
}

export function injectPRConflictIndicator(): void {
  if (!isPRListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  const repoKey = `${info.owner}/${info.repo}`;
  if (!observer || observedRepo !== repoKey) {
    const currentGeneration = ++generation;
    observer?.disconnect();
    checkedRows = new WeakSet<Element>();
    observedRepo = repoKey;

    const currentObserver = new IntersectionObserver((entries) => {
      const visibleRows: Element[] = [];
      for (const entry of entries) {
        if (!entry.isIntersecting || checkedRows.has(entry.target)) continue;
        checkedRows.add(entry.target);
        currentObserver.unobserve(entry.target);
        visibleRows.push(entry.target);
      }
      if (visibleRows.length > 0) {
        void checkRows(visibleRows, info.owner, info.repo, currentGeneration);
      }
    });
    observer = currentObserver;
  }

  for (const row of collectPRRows().values()) {
    if (!checkedRows.has(row) && !row.querySelector(`.${INDICATOR_CLASS}`)) {
      observer.observe(row);
    }
  }
}
