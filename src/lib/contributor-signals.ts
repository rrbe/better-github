// Pure derivations for the contributor background card. No DOM, no network —
// these turn the raw ContributorInfo (fetched in the service worker) into the
// values the card displays. Kept separate so the logic is unit-testable and the
// DOM/i18n layer only formats.

/** Account age broken into a human unit. `days` is always the exact age; `value`
 * + `unit` is the coarsened form the card shows ("3 天" / "2 个月" / "5 年"). */
export interface AccountAge {
  days: number;
  value: number;
  unit: "day" | "month" | "year";
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function accountAge(createdAtMs: number, nowMs: number): AccountAge {
  const days = Math.max(0, Math.floor((nowMs - createdAtMs) / DAY_MS));
  if (days < 60) return { days, value: days, unit: "day" };
  const months = Math.floor(days / 30);
  if (months < 24) return { days, value: months, unit: "month" };
  return { days, value: Math.floor(days / 365), unit: "year" };
}

/** Merge rate as a whole-number percentage (merged ÷ authored). Null when the
 * author has no PRs at all (nothing to rate). */
export function mergeRatePct(merged: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((merged / total) * 100);
}

/** Relationship to the current repo, derived from how many of the author's PRs
 * to it have merged. Null means "no repo context" (hovercard fired off a repo
 * page) — the card omits the row. */
export type RepoRelation =
  | { kind: "first-time" }
  | { kind: "returning"; mergedCount: number }
  | null;

export function repoRelation(repoMerged: number | null): RepoRelation {
  if (repoMerged == null) return null;
  return repoMerged === 0 ? { kind: "first-time" } : { kind: "returning", mergedCount: repoMerged };
}
