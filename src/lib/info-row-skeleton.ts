import { isPRListPage, isCommitsListPage, getRepoInfo } from "./page-detect";
import { collectCommitRows, MAIN_CONTENT_INNER_SELECTOR } from "./commit-dom";
import { getOrCreateInfoRow } from "./info-row";

export const SKELETON_BASE_CLASS = "bg-skeleton-pill";
export const SKELETON_BRANCH_CLASS = "bg-skeleton-pill--branch";
export const SKELETON_PR_DIFF_CLASS = "bg-skeleton-pill--pr-diff";
export const SKELETON_COMMIT_DIFF_CLASS = "bg-skeleton-pill--commit-diff";

const REAL_BRANCH_CLASS = "better-github-branch-badge";
const REAL_PR_DIFF_CLASS = "better-github-diff-stats";
const REAL_COMMIT_DIFF_CLASS = "better-github-commit-diff-stats";

export interface SkeletonFlags {
  "feature-pr-branch-names"?: boolean;
  "feature-pr-diff-stats"?: boolean;
  "feature-commit-diff-stats"?: boolean;
}

function buildPill(...extraClasses: string[]): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = [SKELETON_BASE_CLASS, ...extraClasses].join(" ");
  span.setAttribute("aria-hidden", "true");
  return span;
}

export function reserveInfoRowSkeletons(flags: SkeletonFlags): void {
  if (!getRepoInfo()) return;

  if (isPRListPage()) {
    reservePRListSkeletons(flags);
    return;
  }

  if (isCommitsListPage()) {
    reserveCommitsListSkeletons(flags);
    return;
  }
}

function reservePRListSkeletons(flags: SkeletonFlags): void {
  const wantBranch = flags["feature-pr-branch-names"] === true;
  const wantDiff = flags["feature-pr-diff-stats"] === true;
  if (!wantBranch && !wantDiff) return;

  const prRows = document.querySelectorAll("[id^='issue_']");
  for (const row of prRows) {
    if (wantBranch && !hasReal(row, REAL_BRANCH_CLASS) && !hasSkeleton(row, SKELETON_BRANCH_CLASS)) {
      const infoRow = getOrCreateInfoRow(row);
      if (infoRow) infoRow.appendChild(buildPill(SKELETON_BRANCH_CLASS));
    }
    if (wantDiff && !hasReal(row, REAL_PR_DIFF_CLASS) && !hasSkeleton(row, SKELETON_PR_DIFF_CLASS)) {
      const infoRow = getOrCreateInfoRow(row);
      if (infoRow) infoRow.appendChild(buildPill(SKELETON_PR_DIFF_CLASS));
    }
  }
}

function reserveCommitsListSkeletons(flags: SkeletonFlags): void {
  if (flags["feature-commit-diff-stats"] !== true) return;

  const info = getRepoInfo();
  if (!info) return;

  const shaToContainer = collectCommitRows(info.owner, info.repo);
  for (const container of shaToContainer.values()) {
    if (hasReal(container, REAL_COMMIT_DIFF_CLASS)) continue;
    if (hasSkeleton(container, SKELETON_COMMIT_DIFF_CLASS)) continue;

    const mainInner = container.querySelector<HTMLElement>(MAIN_CONTENT_INNER_SELECTOR);
    const parent = mainInner || container;
    parent.appendChild(buildPill(SKELETON_COMMIT_DIFF_CLASS));
  }
}

function hasReal(scope: Element, realClass: string): boolean {
  return scope.querySelector(`.${realClass}`) !== null;
}

function hasSkeleton(scope: Element, skeletonClass: string): boolean {
  return scope.querySelector(`.${skeletonClass}`) !== null;
}

export function clearSkeletonsByClass(skeletonClass: string): void {
  document.querySelectorAll(`.${skeletonClass}`).forEach((el) => el.remove());
}
