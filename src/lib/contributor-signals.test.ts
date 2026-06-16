import { describe, expect, it } from "vitest";
import { accountAge, mergeRatePct, repoRelation } from "./contributor-signals";

const NOW = Date.parse("2026-06-16T00:00:00Z");
const daysAgo = (n: number) => NOW - n * 24 * 60 * 60 * 1000;

describe("accountAge", () => {
  it("reports days for young accounts (< 60 days)", () => {
    expect(accountAge(daysAgo(3), NOW)).toEqual({ days: 3, value: 3, unit: "day" });
    expect(accountAge(daysAgo(59), NOW)).toEqual({ days: 59, value: 59, unit: "day" });
  });

  it("switches to months at 60 days", () => {
    expect(accountAge(daysAgo(60), NOW)).toEqual({ days: 60, value: 2, unit: "month" });
    expect(accountAge(daysAgo(400), NOW)).toMatchObject({ value: 13, unit: "month" });
  });

  it("switches to years at ~2 years", () => {
    expect(accountAge(daysAgo(800), NOW)).toMatchObject({ value: 2, unit: "year" });
  });

  it("clamps a future creation date to 0 days", () => {
    expect(accountAge(daysAgo(-5), NOW)).toEqual({ days: 0, value: 0, unit: "day" });
  });
});

describe("mergeRatePct", () => {
  it("rounds merged ÷ total to a whole percent", () => {
    expect(mergeRatePct(2, 8)).toBe(25);
    expect(mergeRatePct(1, 3)).toBe(33);
    expect(mergeRatePct(5, 5)).toBe(100);
  });

  it("returns null when the author has no PRs", () => {
    expect(mergeRatePct(0, 0)).toBeNull();
  });

  it("is 0 when nothing merged", () => {
    expect(mergeRatePct(0, 7)).toBe(0);
  });
});

describe("repoRelation", () => {
  it("is null without repo context", () => {
    expect(repoRelation(null)).toBeNull();
  });

  it("is first-time when no merged PR to this repo", () => {
    expect(repoRelation(0)).toEqual({ kind: "first-time" });
  });

  it("is returning with the merged count otherwise", () => {
    expect(repoRelation(4)).toEqual({ kind: "returning", mergedCount: 4 });
  });
});
