import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRReviewStatus } from "./pr-review-status";
import { fetchPRReviewStatuses } from "../lib/github-api";

// Replace the content<->worker bridge with auto-mocked vi.fn()s so the feature
// can be driven with canned data, never touching chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";

function twoPRRows(): void {
  document.body.innerHTML = `
    <div id="issue_7"><a id="issue_7_link">Title 7</a></div>
    <div id="issue_8"><a id="issue_8_link">Title 8</a></div>
  `;
}

describe("injectPRReviewStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders distinct badges for all-resolved vs partially-resolved rows", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 4, resolvedThreads: 4 },
      { number: 8, totalThreads: 5, resolvedThreads: 2 },
    ]);

    await injectPRReviewStatus();

    expect(fetchPRReviewStatuses).toHaveBeenCalledTimes(1);
    const [owner, repo, numbers] = vi.mocked(fetchPRReviewStatuses).mock.calls[0];
    expect(owner).toBe("owner");
    expect(repo).toBe("repo");
    expect(numbers).toContain(7);
    expect(numbers).toContain(8);

    // All resolved → check-marked "All resolved" state.
    const badge7 = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge7).not.toBeNull();
    expect(badge7.classList.contains("better-github-review-resolved")).toBe(true);
    expect(badge7.classList.contains("better-github-review-unresolved")).toBe(false);
    expect(badge7.textContent).toBe("✓ All resolved");
    expect(badge7.title).toBe("4 review thread(s), all resolved");

    // Partially resolved → count of the remaining unresolved threads (5 - 2 = 3).
    const badge8 = document.querySelector("#issue_8 .better-github-review-status") as HTMLElement;
    expect(badge8.classList.contains("better-github-review-unresolved")).toBe(true);
    expect(badge8.classList.contains("better-github-review-resolved")).toBe(false);
    expect(badge8.textContent).toBe("3 unresolved");
    expect(badge8.title).toBe("2/5 review thread(s) resolved");
  });

  it("renders no badge for a PR with zero review threads", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 0, resolvedThreads: 0 },
      { number: 8, totalThreads: 2, resolvedThreads: 1 },
    ]);

    await injectPRReviewStatus();

    // totalThreads === 0 is skipped entirely.
    expect(document.querySelector("#issue_7 .better-github-review-status")).toBeNull();
    // ...but the threaded PR still gets its badge.
    expect(document.querySelector("#issue_8 .better-github-review-status")?.textContent).toBe(
      "1 unresolved",
    );
  });

  it("leaves rows the API did not return without a badge", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 3, resolvedThreads: 1 },
    ]);

    await injectPRReviewStatus();

    expect(document.querySelector("#issue_7 .better-github-review-status")).not.toBeNull();
    expect(document.querySelector("#issue_8 .better-github-review-status")).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicates and skips the fetch", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 3, resolvedThreads: 1 },
      { number: 8, totalThreads: 2, resolvedThreads: 2 },
    ]);

    await injectPRReviewStatus();
    await injectPRReviewStatus();

    expect(document.querySelectorAll(".better-github-review-status")).toHaveLength(2);
    // The module bails as soon as one badge already exists, so no refetch.
    expect(fetchPRReviewStatuses).toHaveBeenCalledTimes(1);
  });

  it("does nothing off the PR list page", async () => {
    setUrl(`${GH}/owner/repo`);
    twoPRRows();

    await injectPRReviewStatus();

    expect(document.querySelectorAll(".better-github-review-status")).toHaveLength(0);
    expect(fetchPRReviewStatuses).not.toHaveBeenCalled();
  });
});
