import { isPRFilesChangedPage } from "../lib/page-detect";
import { buildDiffStatsBadge, type DiffStats } from "../lib/diff-stats-badge";

const BADGE_CLASS = "better-github-file-tree-diff-stats";
const TREE_SELECTOR = '#pr-file-tree, [class*="PullRequestFileTree-module__sidebar"], file-tree';
const HEADER_SELECTOR = '.js-file-header, [class*="diff-file-header"]';
const DATA_SELECTOR = 'script[data-target="react-app.embeddedData"]';
const RELEVANT_SELECTOR = `${TREE_SELECTOR}, ${HEADER_SELECTOR}, ${DATA_SELECTOR}`;

let root: Element | null = null;
let observer: MutationObserver | null = null;
let frame: number | null = null;
let view = "";
let source = "";
let summariesValid = false;
const summaries = new Map<string, DiffStats>();
const renderedStats = new Map<string, DiffStats>();

export function cleanupPRFileTreeDiffStats(): void {
  observer?.disconnect();
  observer = null;
  root = null;
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
  view = "";
  source = "";
  summariesValid = false;
  summaries.clear();
  renderedStats.clear();
  document.querySelectorAll(`.${BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function readSummaries(): void {
  const script = document.querySelector(DATA_SELECTOR);
  const text = script?.textContent ?? "";
  if (text === source) return;
  source = text;
  summaries.clear();
  summariesValid = false;
  if (!text) return;
  const initialPath = script?.closest("react-app")?.getAttribute("initial-path");
  if (initialPath !== view) return;
  try {
    const entries = JSON.parse(text).payload?.pullRequestsChangesRoute?.diffSummaries;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (
        typeof entry.pathDigest !== "string" ||
        !Number.isInteger(entry.linesAdded) ||
        entry.linesAdded < 0 ||
        !Number.isInteger(entry.linesDeleted) ||
        entry.linesDeleted < 0
      )
        continue;
      summaries.set(`#diff-${entry.pathDigest}`, {
        additions: entry.linesAdded,
        deletions: entry.linesDeleted,
        changedFiles: null,
      });
    }
    summariesValid = true;
  } catch {
    // GitHub's embedded JSON is an external input; headers remain usable.
  }
}

function updateStats(): void {
  if (!isPRFilesChangedPage()) {
    cleanupPRFileTreeDiffStats();
    return;
  }
  const currentView = location.pathname + location.search;
  if (view !== currentView) {
    view = currentView;
    summariesValid = false;
    renderedStats.clear();
  }
  readSummaries();

  const headers = new Map<string, DiffStats>();
  for (const header of document.querySelectorAll(HEADER_SELECTOR)) {
    const anchor = header.getAttribute("data-anchor");
    const href = anchor
      ? `#${anchor}`
      : header.querySelector('a[href^="#diff-"]')?.getAttribute("href");
    if (!href) continue;
    const match = [...header.querySelectorAll(".sr-only")]
      .map((el) => el.textContent?.match(/([\d,]+) additions?\s*&\s*([\d,]+) deletions?/))
      .find(Boolean);
    if (!match) continue;
    const stats = {
      additions: Number(match[1].replaceAll(",", "")),
      deletions: Number(match[2].replaceAll(",", "")),
      changedFiles: null,
    };
    const initial = summaries.get(href);
    if (
      summariesValid &&
      initial &&
      (initial.additions !== stats.additions || initial.deletions !== stats.deletions)
    ) {
      summariesValid = false;
      renderedStats.clear();
    }
    headers.set(href, stats);
  }
  for (const [href, stats] of headers) renderedStats.set(href, stats);

  for (const tree of document.querySelectorAll(TREE_SELECTOR)) {
    for (const link of tree.querySelectorAll<HTMLAnchorElement>('a[href^="#diff-"]')) {
      const href = link.getAttribute("href")!;
      const stats = renderedStats.get(href) ?? (summariesValid ? summaries.get(href) : undefined);
      const container =
        link.closest(".PRIVATE_TreeView-item-content") ??
        link.querySelector(".ActionList-item-visual--trailing") ??
        link;
      const existing = container.querySelector<HTMLElement>(`.${BADGE_CLASS}`);
      if (!stats) {
        existing?.remove();
        continue;
      }
      const key = `${stats.additions}:${stats.deletions}`;
      if (existing?.dataset.stats === key) continue;
      existing?.remove();
      const badge = buildDiffStatsBadge(stats, BADGE_CLASS);
      badge.dataset.stats = key;
      if (container.matches(".ActionList-item-visual--trailing")) container.prepend(badge);
      else container.appendChild(badge);
    }
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
