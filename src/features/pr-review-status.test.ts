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

  it("builds a thread-detail popover on the unresolved badge", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      {
        number: 7,
        totalThreads: 2,
        resolvedThreads: 0,
        unresolved: [
          { path: "src/lib/github-api.ts", line: 42, isOutdated: false, author: "alice", snippet: "Guard the null case before dereferencing this.", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
          { path: "README.md", line: null, isOutdated: true, author: "bob", snippet: "Stale wording here.", url: "https://github.com/owner/repo/pull/7#discussion_r2" },
        ],
      },
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge.classList.contains("better-github-review-has-popover")).toBe(true);

    // The popover supersedes the native tooltip — a badge with a popover must not
    // also carry a `title`, or the browser tooltip overlaps the open popover.
    expect(badge.hasAttribute("title")).toBe(false);

    const items = badge.querySelectorAll(".better-github-review-popover-item");
    expect(items).toHaveLength(2);

    // First item: anchor to the thread, basename-only location, author-prefixed snippet.
    const first = items[0] as HTMLAnchorElement;
    expect(first.tagName).toBe("A");
    expect(first.getAttribute("href")).toBe("https://github.com/owner/repo/pull/7#discussion_r1");
    const loc = first.querySelector(".better-github-review-popover-loc-text") as HTMLElement;
    expect(loc.textContent).toBe("github-api.ts:42");
    expect(loc.title).toBe("src/lib/github-api.ts:42"); // full path preserved in tooltip
    expect(first.querySelector(".better-github-review-popover-body")?.textContent).toBe(
      "@alice: Guard the null case before dereferencing this.",
    );
    expect(first.querySelector(".better-github-review-popover-outdated")).toBeNull();

    // Second item: no line number, flagged outdated.
    const second = items[1] as HTMLElement;
    expect(second.querySelector(".better-github-review-popover-loc-text")?.textContent).toBe("README.md");
    expect(second.querySelector(".better-github-review-popover-outdated")?.textContent).toBe("outdated");
  });

  it("toggles the popover on click and dismisses it on an outside click / Escape", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      {
        number: 7,
        totalThreads: 1,
        resolvedThreads: 0,
        unresolved: [
          { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
        ],
      },
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge.getAttribute("role")).toBe("button");
    expect(badge.getAttribute("aria-expanded")).toBe("false");

    // Click the badge → opens.
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);
    expect(badge.getAttribute("aria-expanded")).toBe("true");

    // Click the badge again → closes (toggle).
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(false);

    // Open again, then an outside click dismisses it.
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(false);

    // Open again, then Escape dismisses it.
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(false);
  });

  it("does not toggle the popover when a thread row inside it is clicked", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      {
        number: 7,
        totalThreads: 1,
        resolvedThreads: 0,
        unresolved: [
          { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
        ],
      },
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);

    // Clicking the link row must fall through to navigation, leaving the popover open.
    const item = badge.querySelector(".better-github-review-popover-item") as HTMLElement;
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);
  });

  it("omits the popover when the API returned no unresolved details", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 3, resolvedThreads: 1 }, // legacy payload, no `unresolved`
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge.textContent).toBe("2 unresolved");
    expect(badge.classList.contains("better-github-review-has-popover")).toBe(false);
    expect(badge.querySelector(".better-github-review-popover")).toBeNull();
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
