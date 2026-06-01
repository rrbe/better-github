import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRDiffStats } from "./pr-diff-stats";
import { fetchPRDiffStats } from "../lib/github-api";

// Replace the content<->worker bridge with auto-mocked vi.fn()s so the feature
// can be driven with canned data, never touching chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";

function twoPRRows(): void {
  document.body.innerHTML = `
    <div id="issue_7"><a id="issue_7_link">Title 7</a><span class="bg-skeleton-pill bg-skeleton-pill--pr-diff"></span></div>
    <div id="issue_8"><a id="issue_8_link">Title 8</a><span class="bg-skeleton-pill bg-skeleton-pill--pr-diff"></span></div>
  `;
}

describe("injectPRDiffStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the diff-stats badge for each matching row and clears the skeletons", async () => {
    twoPRRows();
    vi.mocked(fetchPRDiffStats).mockResolvedValue([
      { number: 7, additions: 1234, deletions: 56, changedFiles: 3 },
      { number: 8, additions: 0, deletions: 9, changedFiles: 1 },
    ]);

    await injectPRDiffStats();

    // owner/repo and the parsed PR numbers must reach the bridge.
    expect(fetchPRDiffStats).toHaveBeenCalledTimes(1);
    const [owner, repo, numbers] = vi.mocked(fetchPRDiffStats).mock.calls[0];
    expect(owner).toBe("owner");
    expect(repo).toBe("repo");
    expect(numbers).toContain(7);
    expect(numbers).toContain(8);

    const badge7 = document.querySelector("#issue_7 .better-github-diff-stats") as HTMLElement;
    expect(badge7).not.toBeNull();
    // toLocaleString inserts a thousands separator; pluralize → "files".
    expect(badge7.querySelector(".better-github-diff-stats-add")?.textContent).toBe("+1,234");
    expect(badge7.querySelector(".better-github-diff-stats-del")?.textContent).toBe("−56");
    expect(badge7.querySelector(".better-github-diff-stats-files")?.textContent).toBe("3 files");
    expect(badge7.title).toBe("1,234 additions, 56 deletions across 3 files");

    // changedFiles === 1 → singular "file".
    const badge8 = document.querySelector("#issue_8 .better-github-diff-stats") as HTMLElement;
    expect(badge8.querySelector(".better-github-diff-stats-files")?.textContent).toBe("1 file");

    // Skeletons are cleared once the real badges arrive.
    expect(document.querySelectorAll(".bg-skeleton-pill--pr-diff")).toHaveLength(0);
  });

  it("leaves rows the API did not return without a badge", async () => {
    twoPRRows();
    vi.mocked(fetchPRDiffStats).mockResolvedValue([
      { number: 7, additions: 5, deletions: 5, changedFiles: 2 },
    ]);

    await injectPRDiffStats();

    expect(document.querySelector("#issue_7 .better-github-diff-stats")).not.toBeNull();
    expect(document.querySelector("#issue_8 .better-github-diff-stats")).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicate badges", async () => {
    twoPRRows();
    vi.mocked(fetchPRDiffStats).mockResolvedValue([
      { number: 7, additions: 5, deletions: 5, changedFiles: 2 },
      { number: 8, additions: 1, deletions: 1, changedFiles: 1 },
    ]);

    await injectPRDiffStats();
    await injectPRDiffStats();

    expect(document.querySelectorAll(".better-github-diff-stats")).toHaveLength(2);
  });

  it("does nothing off the PR list page", async () => {
    setUrl(`${GH}/owner/repo`);
    twoPRRows();

    await injectPRDiffStats();

    expect(document.querySelectorAll(".better-github-diff-stats")).toHaveLength(0);
    expect(fetchPRDiffStats).not.toHaveBeenCalled();
    // The early return runs before clearSkeletons, so skeletons stay put.
    expect(document.querySelectorAll(".bg-skeleton-pill--pr-diff")).toHaveLength(2);
  });

  it("still clears skeletons when the API returns no stats", async () => {
    twoPRRows();
    vi.mocked(fetchPRDiffStats).mockResolvedValue([]);

    await injectPRDiffStats();

    expect(document.querySelectorAll(".better-github-diff-stats")).toHaveLength(0);
    // clearSkeletons lives in a finally, so it runs even on the empty-result path.
    expect(document.querySelectorAll(".bg-skeleton-pill--pr-diff")).toHaveLength(0);
  });
});
