import { isPRFilesChangedPage } from "../lib/page-detect";
import { buildDiffStatsBadge, type DiffStats } from "../lib/diff-stats-badge";

const BADGE_CLASS = "better-github-file-tree-diff-stats";
const TREE_SELECTOR = '#pr-file-tree, [class*="PullRequestFileTree-module__sidebar"], file-tree';
const DISPLAYED_LEVELS = ':is([aria-level="1"], [aria-level="2"], [aria-level="3"])';
const HEADER_SELECTOR = ".js-file-header[data-anchor]";
const DATA_SELECTOR = 'script[data-target="react-app.embeddedData"]';
const RELEVANT_SELECTOR = `${TREE_SELECTOR}, ${HEADER_SELECTOR}, ${DATA_SELECTOR}`;

let root: Element | null = null;
let observer: MutationObserver | null = null;
let frame: number | null = null;
let summarySource: Node | null = null;
const directoryTotals = new Map<string, DiffStats>();

export function cleanupPRFileTreeDiffStats(): void {
  observer?.disconnect();
  observer = null;
  root = null;
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  summarySource = null;
  directoryTotals.clear();
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function updateBadge(container: Element, stats?: DiffStats): void {
  const existing = container.querySelector<HTMLElement>(`.${BADGE_CLASS}`);
  if (!stats) {
    existing?.remove();
    return;
  }
  const key = `${stats.additions}:${stats.deletions}`;
  if (existing?.dataset.stats === key) return;
  const badge = buildDiffStatsBadge(stats, BADGE_CLASS);
  badge.dataset.stats = key;
  if (existing) existing.replaceWith(badge);
  else container.append(badge);
}

function readDirectoryTotals(tree: Element): void {
  const app = tree.closest("react-app");
  const currentView = location.pathname + location.search;
  const source =
    app?.getAttribute("initial-path") === currentView
      ? (app.querySelector(DATA_SELECTOR)?.firstChild ?? null)
      : null;
  if (source === summarySource) return;
  summarySource = source;
  directoryTotals.clear();
  if (!source?.textContent) return;

  let entries;
  try {
    const { payload } = JSON.parse(source.textContent);
    const route = payload?.pullRequestsChangesWithRangeRoute ?? payload?.pullRequestsChangesRoute;
    entries = route?.diffSummaries;
  } catch {
    return;
  }
  if (!Array.isArray(entries)) return;
  for (const entry of entries) {
    if (
      typeof entry?.path !== "string" ||
      !Number.isInteger(entry.linesAdded) ||
      !Number.isInteger(entry.linesDeleted) ||
      entry.linesAdded < 0 ||
      entry.linesDeleted < 0
    )
      return;
  }
  for (const { path, linesAdded, linesDeleted } of entries) {
    for (let slash = path.indexOf("/"); slash >= 0; slash = path.indexOf("/", slash + 1)) {
      const directory = path.slice(0, slash);
      const total = directoryTotals.get(directory) ?? {
        additions: 0,
        deletions: 0,
        changedFiles: null,
      };
      total.additions += linesAdded;
      total.deletions += linesDeleted;
      directoryTotals.set(directory, total);
    }
  }
}

function updateClassicTree(tree: Element): void {
  const files = new Map<string, DiffStats>();
  for (const header of document.querySelectorAll(HEADER_SELECTOR)) {
    const match = header
      .querySelector(".file-info .sr-only")
      ?.textContent?.match(/([\d,]+) additions?\s*&\s*([\d,]+) deletions?/);
    if (match)
      files.set(`#${header.getAttribute("data-anchor")}`, {
        additions: Number(match[1].replaceAll(",", "")),
        deletions: Number(match[2].replaceAll(",", "")),
        changedFiles: null,
      });
  }
  for (const folder of tree.querySelectorAll(
    `[data-tree-entry-type="directory"]${DISPLAYED_LEVELS}`,
  )) {
    const button = folder.querySelector(":scope > button.ActionList-content");
    if (!button) continue;
    const links = folder.querySelectorAll('[data-tree-entry-type="file"] > a[href^="#diff-"]');
    const total = { additions: 0, deletions: 0, changedFiles: null };
    let counted = 0;
    for (const link of links) {
      const stats = files.get(link.getAttribute("href")!);
      if (!stats) break;
      total.additions += stats.additions;
      total.deletions += stats.deletions;
      counted++;
    }
    updateBadge(button, counted && counted === links.length ? total : undefined);
  }
}

function updateStats(): void {
  if (!isPRFilesChangedPage()) {
    cleanupPRFileTreeDiffStats();
    return;
  }
  const tree = document.querySelector(TREE_SELECTOR);
  if (!tree) return;
  if (tree.matches("file-tree")) {
    updateClassicTree(tree);
    return;
  }
  readDirectoryTotals(tree);
  for (const folder of tree.querySelectorAll(
    `li[role="treeitem"][aria-expanded]${DISPLAYED_LEVELS}`,
  )) {
    const label = folder.firstElementChild?.querySelector('[class*="TreeViewItemContentText"]');
    if (label) updateBadge(label, directoryTotals.get(folder.id));
  }
}

export function injectPRFileTreeDiffStats(): void {
  if (!isPRFilesChangedPage()) {
    cleanupPRFileTreeDiffStats();
    return;
  }
  const nextRoot = document.querySelector("main");
  if (root !== nextRoot) {
    cleanupPRFileTreeDiffStats();
    root = nextRoot;
    if (!root) return;
    observer = new MutationObserver((mutations) => {
      if (frame !== null) return;
      const relevant = mutations.some((mutation) => {
        const target =
          mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;
        if (target?.closest(`.${BADGE_CLASS}`)) return false;
        const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
        if (
          nodes.length &&
          nodes.every((node) => node instanceof Element && node.matches(`.${BADGE_CLASS}`))
        )
          return false;
        return (
          target?.closest(RELEVANT_SELECTOR) ||
          nodes.some(
            (node) =>
              node instanceof Element &&
              (node.matches(RELEVANT_SELECTOR) || node.querySelector(RELEVANT_SELECTOR)),
          )
        );
      });
      if (!relevant) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        updateStats();
      });
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }
  updateStats();
}
