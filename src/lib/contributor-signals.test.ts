import { describe, expect, it } from "vitest";
import { accountAge, repoRelation } from "./contributor-signals";

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

describe("repoRelation", () => {
  it("is null without a usable association", () => {
    expect(repoRelation(null)).toBeNull();
    expect(repoRelation("MANNEQUIN")).toBeNull();
  });

  it("maps elevated associations to a trust identity", () => {
    expect(repoRelation("OWNER")).toEqual({ kind: "owner" });
    expect(repoRelation("MEMBER")).toEqual({ kind: "member" });
    expect(repoRelation("COLLABORATOR")).toEqual({ kind: "collaborator" });
  });

  it("distinguishes returning vs first-time contributors", () => {
    expect(repoRelation("CONTRIBUTOR")).toEqual({ kind: "contributor" });
    expect(repoRelation("FIRST_TIME_CONTRIBUTOR")).toEqual({ kind: "first-time" });
    expect(repoRelation("NONE")).toEqual({ kind: "first-time" });
  });
});
