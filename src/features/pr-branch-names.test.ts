import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRBranchNames } from "./pr-branch-names";
import { fetchPRBranches } from "../lib/github-api";

// Replace the content<->worker bridge with auto-mocked vi.fn()s so the feature
// can be driven with canned data, never touching chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";

function twoPRRows(): void {
  document.body.innerHTML = `
    <div id="issue_7"><a id="issue_7_link">Title 7</a><span class="bg-skeleton-pill--branch"></span></div>
    <div id="issue_8"><a id="issue_8_link">Title 8</a><span class="bg-skeleton-pill--branch"></span></div>
  `;
}

describe("injectPRBranchNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = "";
  });

  it("injects a branch badge per matching PR row and clears the skeletons", async () => {
    twoPRRows();
    vi.mocked(fetchPRBranches).mockResolvedValue([
      { number: 7, headRef: "feature/a" },
      { number: 8, headRef: "fix/b" },
    ]);

    await injectPRBranchNames();

    const badge7 = document.querySelector("#issue_7 .better-github-branch-badge") as HTMLElement;
    const badge8 = document.querySelector("#issue_8 .better-github-branch-badge") as HTMLElement;
    expect(badge7?.textContent).toBe("feature/a");
    expect(badge7?.dataset.branch).toBe("feature/a");
    expect(badge8?.textContent).toBe("fix/b");
    // Skeletons must be cleared once the real badges arrive.
    expect(document.querySelectorAll(".bg-skeleton-pill--branch")).toHaveLength(0);
  });

  it("ignores PR numbers the API did not return", async () => {
    twoPRRows();
    vi.mocked(fetchPRBranches).mockResolvedValue([{ number: 7, headRef: "feature/a" }]);

    await injectPRBranchNames();

    expect(document.querySelector("#issue_7 .better-github-branch-badge")).not.toBeNull();
    expect(document.querySelector("#issue_8 .better-github-branch-badge")).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicate badges and skips the fetch", async () => {
    twoPRRows();
    vi.mocked(fetchPRBranches).mockResolvedValue([
      { number: 7, headRef: "feature/a" },
      { number: 8, headRef: "fix/b" },
    ]);

    await injectPRBranchNames();
    await injectPRBranchNames();

    expect(document.querySelectorAll(".better-github-branch-badge")).toHaveLength(2);
    expect(fetchPRBranches).toHaveBeenCalledTimes(1);
  });

  it("does nothing off the PR list page", async () => {
    setUrl(`${GH}/owner/repo`);
    twoPRRows();

    await injectPRBranchNames();

    expect(document.querySelectorAll(".better-github-branch-badge")).toHaveLength(0);
    expect(fetchPRBranches).not.toHaveBeenCalled();
  });

  it("copies the branch name to the clipboard when a badge is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    twoPRRows();
    vi.mocked(fetchPRBranches).mockResolvedValue([{ number: 7, headRef: "feature/a" }]);
    await injectPRBranchNames();

    const badge = document.querySelector("#issue_7 .better-github-branch-badge") as HTMLElement;
    badge.click();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith("feature/a");
    expect(badge.textContent).toBe("Copied!");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
