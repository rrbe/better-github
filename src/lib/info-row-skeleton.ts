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
const reservedPRSkeletons = {
  branch: new WeakSet<Element>(),
  prDiff: new WeakSet<Element>(),
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

  for (const row of document.querySelectorAll("[id^='issue_']:not([id$='_link'])")) {
    const present = new Set(
      [...row.querySelectorAll(probeSelector)].flatMap((el) => [...el.classList]),
    );
    const needBranch =
      wantBranch &&
      !reservedPRSkeletons.branch.has(row) &&
      !present.has(branch.real) &&
      !present.has(branch.skeleton);
    const needDiff =
      wantDiff &&
      !reservedPRSkeletons.prDiff.has(row) &&
      !present.has(prDiff.real) &&
      !present.has(prDiff.skeleton);
    if (!needBranch && !needDiff) continue;

    if (needBranch && insertInfoRowItem(row, "branch", buildPill(branch.skeleton))) {
      reservedPRSkeletons.branch.add(row);
    }
    if (needDiff && insertInfoRowItem(row, "diff", buildPill(prDiff.skeleton))) {
      reservedPRSkeletons.prDiff.add(row);
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

export function clearSkeletons(kind: SkeletonKind): void {
  for (const skeleton of document.querySelectorAll(`.${SKELETONS[kind].skeleton}`)) {
    const infoRow = skeleton.closest(`.${INFO_ROW_CLASS}`);
    skeleton.remove();
    if (infoRow?.childElementCount === 0) infoRow.remove();
  }
}
