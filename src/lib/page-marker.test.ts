import { describe, it, expect } from "vitest";
import { detectPageMarker, restoreListLayout, syncListLayout } from "./page-marker";

describe("detectPageMarker", () => {
  it("marks the PR list page", () => {
    expect(detectPageMarker("/owner/repo/pulls")).toBe("pr-list");
    expect(detectPageMarker("/owner/repo/pulls/")).toBe("pr-list");
  });

  it("marks the commits list page", () => {
    expect(detectPageMarker("/owner/repo/commits")).toBe("commits-list");
    expect(detectPageMarker("/owner/repo/commits/main")).toBe("commits-list");
  });

  it("does not mark a single PR or unrelated pages", () => {
    expect(detectPageMarker("/owner/repo/pulls/3")).toBeNull();
    expect(detectPageMarker("/owner/repo/issues")).toBeNull();
    expect(detectPageMarker("/owner/repo")).toBeNull();
    expect(detectPageMarker("/")).toBeNull();
  });
});

describe("first-paint list layout", () => {
  it("restores enabled and fully disabled layouts across document loads", () => {
    localStorage.clear();
    restoreListLayout();
    expect(document.documentElement.dataset.bgLayout).toBe("pr-row labels commit-row");
    for (const [flags, expected] of [
      [{ "feature-pr-label-position": true }, "labels"],
      [{ "feature-pr-branch-names": true, "feature-commit-diff-stats": true }, "pr-row commit-row"],
      [{}, ""],
    ] as const) {
      syncListLayout(flags);
      delete document.documentElement.dataset.bgLayout;
      restoreListLayout();
      expect(document.documentElement.dataset.bgLayout).toBe(expected);
    }
  });
});
