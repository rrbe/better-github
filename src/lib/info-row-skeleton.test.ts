import { beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { reserveInfoRowSkeletons, clearSkeletons } from "./info-row-skeleton";
import { insertInfoRowItem } from "./info-row";
import { repoDashboard, dashboardRow } from "../test-utils/pr-dashboard";

const GH = "https://github.com";
const SHA = "0123456789abcdef0123456789abcdef01234567";

describe("reserveInfoRowSkeletons", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    setUrl(`${GH}/`);
  });

  it("reserves PR list skeletons only for enabled async badges", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = `
      <li id="issue_1">
        <a id="issue_1_link">Title</a>
        <div><relative-time datetime="2026-01-01T00:00:00Z"></relative-time></div>
      </li>
    `;

    reserveInfoRowSkeletons({
      "feature-pr-branch-names": true,
      "feature-pr-diff-stats": true,
    });
    reserveInfoRowSkeletons({
      "feature-pr-branch-names": true,
      "feature-pr-diff-stats": true,
    });

    expect(document.querySelectorAll(".bg-skeleton-pill--branch")).toHaveLength(1);
    expect(document.querySelectorAll(".bg-skeleton-pill--pr-diff")).toHaveLength(1);
    expect(
      [...document.querySelector(".better-github-info-row")!.children].map(
        (el) => (el as HTMLElement).dataset.bgInfoRowItem,
      ),
    ).toEqual(["branch", "diff"]);

    clearSkeletons("branch");
    expect(document.querySelector(".bg-skeleton-pill--branch")).toBeNull();
    expect(document.querySelector(".bg-skeleton-pill--pr-diff")).not.toBeNull();

    clearSkeletons("prDiff");
    expect(document.querySelector(".better-github-info-row")).toBeNull();
    reserveInfoRowSkeletons({
      "feature-pr-branch-names": true,
      "feature-pr-diff-stats": true,
    });
    expect(document.querySelector(".bg-skeleton-pill--branch")).toBeNull();
    expect(document.querySelector(".bg-skeleton-pill--pr-diff")).toBeNull();
  });

  it("reserves commit diff skeletons on commits list pages", () => {
    setUrl(`${GH}/owner/repo/commits/main`);
    document.body.innerHTML = `
      <div class="TimelineItem-body" id="row">
        <div class="MainContent-module__inner__abc">
          <a href="/owner/repo/commit/${SHA}">commit</a>
        </div>
      </div>
    `;

    reserveInfoRowSkeletons({ "feature-commit-diff-stats": true });
    reserveInfoRowSkeletons({ "feature-commit-diff-stats": true });

    expect(document.querySelectorAll(".bg-skeleton-pill--commit-diff")).toHaveLength(1);
    expect(
      document
        .querySelector("[class*='MainContent-module__inner']")
        ?.lastElementChild?.classList.contains("bg-skeleton-pill--commit-diff"),
    ).toBe(true);
  });

  it("expires a stalled badge placeholder without removing completed or late data", () => {
    vi.useFakeTimers();
    try {
      setUrl(`${GH}/owner/repo/pulls`);
      document.body.innerHTML = repoDashboard(dashboardRow(7));
      const flags = { "feature-pr-branch-names": true, "feature-pr-diff-stats": true };
      reserveInfoRowSkeletons(flags);
      const row = document.querySelector("li")!;
      const branch = document.createElement("span");
      branch.className = "better-github-branch-badge";
      insertInfoRowItem(row, "branch", branch);
      vi.advanceTimersByTime(5000);
      expect(branch.isConnected).toBe(true);
      expect(document.querySelector(".bg-skeleton-pill")).toBeNull();
      reserveInfoRowSkeletons(flags);
      expect(document.querySelector(".bg-skeleton-pill")).toBeNull();
      const diff = document.createElement("span");
      expect(insertInfoRowItem(row, "diff", diff)).toBe(true);
      expect(diff.isConnected).toBe(true);
      document.querySelector("ul")!.innerHTML = dashboardRow(7);
      reserveInfoRowSkeletons(flags);
      expect(document.querySelector(".bg-skeleton-pill")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
