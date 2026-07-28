import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { reserveInfoRowSkeletons, clearSkeletons } from "./info-row-skeleton";

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
      document.querySelector("[class*='MainContent-module__inner']")?.lastElementChild?.classList
        .contains("bg-skeleton-pill--commit-diff"),
    ).toBe(true);
  });
});
