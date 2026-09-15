import { collectPRRows, PR_DASHBOARD_SELECTOR } from "./pr-list-dom";
import { isPRListPage, isCommitsListPage, getRepoInfo } from "./page-detect";
import { collectCommitRows, MAIN_CONTENT_INNER_SELECTOR } from "./commit-dom";
import { INFO_ROW_CLASS, insertInfoRowItem } from "./info-row";

export type SkeletonKind = "branch" | "prDiff" | "commitDiff";

const SKELETONS: Record<SkeletonKind, { skeleton: string; real: string }> = {
  branch: { skeleton: "bg-skeleton-pill--branch", real: "better-github-branch-badge" },
  prDiff: { skeleton: "bg-skeleton-pill--pr-diff", real: "better-github-diff-stats" },
  commitDiff: {
    skeleton: "bg-skeleton-pill--commit-diff",
    real: "better-github-commit-diff-stats",
  },
};

const SKELETON_BASE_CLASS = "bg-skeleton-pill";
const SKELETON_TIMEOUT = 5000;
const reservedPRSkeletons = {
  branch: new WeakMap<Element, Set<number>>(),
  prDiff: new WeakMap<Element, Set<number>>(),
};

export interface SkeletonFlags {
  "feature-pr-branch-names"?: boolean;
  "feature-pr-diff-stats"?: boolean;
  "feature-commit-diff-stats"?: boolean;
}

function buildPill(extraClass: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = `${SKELETON_BASE_CLASS} ${extraClass}`;
  span.setAttribute("aria-hidden", "true");
  return span;
}

function hasChild(scope: Element, cls: string): boolean {
  return scope.querySelector(`.${cls}`) !== null;
}

export function reserveInfoRowSkeletons(flags: SkeletonFlags): void {
  if (isPRListPage()) {
    reservePRListSkeletons(flags);
    return;
  }
  if (isCommitsListPage()) {
    reserveCommitsListSkeletons(flags);
  }
}

function reservePRListSkeletons(flags: SkeletonFlags): void {
  const wantBranch = !!flags["feature-pr-branch-names"];
  const wantDiff = !!flags["feature-pr-diff-stats"];
  if (!wantBranch && !wantDiff) return;

  const branch = SKELETONS.branch;
  const prDiff = SKELETONS.prDiff;
  const probeSelector = [branch.real, branch.skeleton, prDiff.real, prDiff.skeleton]
    .map((c) => `.${c}`)
    .join(", ");

  const info = getRepoInfo();
  if (!info) return;

  for (const [number, row] of collectPRRows(info.owner, info.repo)) {
    // Keep the reservation across row replacements within the same React app.
    const scope = row.closest(PR_DASHBOARD_SELECTOR) || row;
    const reservedBranch = reservedPRSkeletons.branch.get(scope) ?? new Set<number>();
    const reservedDiff = reservedPRSkeletons.prDiff.get(scope) ?? new Set<number>();
    const present = new Set(
      [...row.querySelectorAll(probeSelector)].flatMap((el) => [...el.classList]),
    );
    const needBranch =
      wantBranch &&
      !reservedBranch.has(number) &&
      !present.has(branch.real) &&
      !present.has(branch.skeleton);
    const needDiff =
      wantDiff &&
      !reservedDiff.has(number) &&
      !present.has(prDiff.real) &&
      !present.has(prDiff.skeleton);
    if (!needBranch && !needDiff) continue;

    if (needBranch && insertInfoRowItem(row, "branch", buildPill(branch.skeleton))) {
      reservedBranch.add(number);
      reservedPRSkeletons.branch.set(scope, reservedBranch);
      expireSkeleton(row.querySelector(`.${branch.skeleton}`)!);
    }
    if (needDiff && insertInfoRowItem(row, "diff", buildPill(prDiff.skeleton))) {
      reservedDiff.add(number);
      reservedPRSkeletons.prDiff.set(scope, reservedDiff);
      expireSkeleton(row.querySelector(`.${prDiff.skeleton}`)!);
    }
  }
}

function reserveCommitsListSkeletons(flags: SkeletonFlags): void {
  if (!flags["feature-commit-diff-stats"]) return;

  const info = getRepoInfo();
  if (!info) return;

  const { skeleton, real } = SKELETONS.commitDiff;
  for (const container of collectCommitRows(info.owner, info.repo).values()) {
    if (hasChild(container, real) || hasChild(container, skeleton)) continue;

    const mainInner = container.querySelector<HTMLElement>(MAIN_CONTENT_INNER_SELECTOR);
    (mainInner || container).appendChild(buildPill(skeleton));
  }
}

function removeSkeleton(skeleton: Element): void {
  const infoRow = skeleton.closest(`.${INFO_ROW_CLASS}`);
  skeleton.remove();
  if (infoRow?.childElementCount === 0) infoRow.remove();
}

function expireSkeleton(skeleton: Element): void {
  // Remove only this placeholder: a late response may already have replaced it.
  setTimeout(() => removeSkeleton(skeleton), SKELETON_TIMEOUT);
}

export function clearSkeletons(kind: SkeletonKind): void {
  for (const skeleton of document.querySelectorAll(`.${SKELETONS[kind].skeleton}`)) {
    removeSkeleton(skeleton);
  }
}
