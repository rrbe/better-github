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

/** Standing in the current repo, derived from the author's `author_association`
 * (as GitHub reports it on their issues/PRs here). `owner`/`member`/`collaborator`
 * are trust signals; `contributor` has merged here before; `first-time` has not.
 * Null means no usable association (no repo context / nothing authored / unknown)
 * — the card omits the row. */
export type RepoRelation =
  | { kind: "owner" }
  | { kind: "member" }
  | { kind: "collaborator" }
  | { kind: "contributor" }
  | { kind: "first-time" }
  | null;

export function repoRelation(association: string | null): RepoRelation {
  switch (association) {
    case "OWNER":
      return { kind: "owner" };
    case "MEMBER":
      return { kind: "member" };
    case "COLLABORATOR":
      return { kind: "collaborator" };
    case "CONTRIBUTOR":
      return { kind: "contributor" };
    case "FIRST_TIME_CONTRIBUTOR":
    case "FIRST_TIMER":
    case "NONE":
      return { kind: "first-time" };
    default:
      return null;
  }
}
