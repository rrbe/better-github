import { describe, expect, it } from "vitest";
import { buildDiffStatsBadge } from "./diff-stats-badge";

describe("buildDiffStatsBadge", () => {
  it("renders localized additions, deletions, and changed files", () => {
    const badge = buildDiffStatsBadge(
      { additions: 1234, deletions: 56, changedFiles: 1 },
      "test-badge",
    );

    expect(badge.className).toBe("test-badge");
    expect(badge.textContent).toBe("+1,234−561 file");
    expect(badge.title).toBe("1,234 additions, 56 deletions across 1 file");
  });

  it("omits file count when it is unavailable", () => {
    const badge = buildDiffStatsBadge(
      { additions: 1, deletions: 2, changedFiles: null },
      "test-badge",
    );

    expect(badge.textContent).toBe("+1−2");
    expect(badge.querySelector(".better-github-diff-stats-files")).toBeNull();
    expect(badge.title).toBe("1 additions, 2 deletions");
  });
});
