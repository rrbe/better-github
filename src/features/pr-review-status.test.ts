import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRReviewStatus } from "./pr-review-status";
import { fetchPRReviewStatuses, fetchReviewThreadDetails } from "../lib/github-api";

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

/** Open a badge's popover and wait for its lazy contents to settle. */
async function openPopover(badge: HTMLElement): Promise<void> {
  badge.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  // The detail fetch resolves on a microtask; let the popover body swap in.
  await vi.waitFor(() =>
    expect(badge.querySelector(".better-github-review-popover-message, .better-github-review-popover-item")).not.toBeNull(),
  );
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
    expect(numbers).toEqual([7, 8]);

    // All resolved → check-marked "All resolved" state, with a simple tooltip
    // (no popover, so no overlap risk).
    const badge7 = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge7).not.toBeNull();
    expect(badge7.classList.contains("better-github-review-resolved")).toBe(true);
    expect(badge7.classList.contains("better-github-review-unresolved")).toBe(false);
    expect(badge7.textContent).toBe("✓ All resolved");
    expect(badge7.title).toBe("4 review thread(s), all resolved");
    expect(badge7.classList.contains("better-github-review-has-popover")).toBe(false);

    // Partially resolved → count of the remaining unresolved threads (5 - 2 = 3),
    // a click popover, and crucially NO native title to overlap that popover.
    const badge8 = document.querySelector("#issue_8 .better-github-review-status") as HTMLElement;
    expect(badge8.classList.contains("better-github-review-unresolved")).toBe(true);
    expect(badge8.classList.contains("better-github-review-resolved")).toBe(false);
    expect(badge8.textContent).toBe("3 unresolved");
    expect(badge8.classList.contains("better-github-review-has-popover")).toBe(true);
    expect(badge8.hasAttribute("title")).toBe(false);
  });

  it("does not fetch thread details until a badge is opened", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 2, resolvedThreads: 0 },
    ]);
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([
      { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
    ]);

    await injectPRReviewStatus();

    // The list query ran, but the heavy per-PR detail query has NOT — it is lazy.
    expect(fetchPRReviewStatuses).toHaveBeenCalledTimes(1);
    expect(fetchReviewThreadDetails).not.toHaveBeenCalled();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    await openPopover(badge);

    // Opening the badge triggers exactly one detail fetch for that single PR.
    expect(fetchReviewThreadDetails).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchReviewThreadDetails).mock.calls[0]).toEqual(["owner", "repo", 7]);
  });

  it("builds a thread-detail popover lazily when the unresolved badge opens", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 2, resolvedThreads: 0 },
    ]);
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([
      { path: "src/lib/github-api.ts", line: 42, isOutdated: false, author: "alice", snippet: "Guard the null case before dereferencing this.", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
      { path: "README.md", line: null, isOutdated: true, author: "bob", snippet: "Stale wording here.", url: "https://github.com/owner/repo/pull/7#discussion_r2" },
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    expect(badge.classList.contains("better-github-review-has-popover")).toBe(true);
    // The popover supersedes the native tooltip — a badge with a popover must not
    // also carry a `title`, or the browser tooltip overlaps the open popover.
    expect(badge.hasAttribute("title")).toBe(false);

    await openPopover(badge);

    const items = badge.querySelectorAll(".better-github-review-popover-item");
    expect(items).toHaveLength(2);

    // First item: anchor to the thread, basename-only location, author-prefixed snippet.
    const first = items[0] as HTMLAnchorElement;
    expect(first.tagName).toBe("A");
    expect(first.getAttribute("href")).toBe("https://github.com/owner/repo/pull/7#discussion_r1");
    const loc = first.querySelector(".better-github-review-popover-loc-text") as HTMLElement;
    expect(loc.textContent).toBe("github-api.ts:42");
    // Full path lives on `aria-label`, NOT `title` — a native tooltip inside the
    // popover is exactly the overlap bug this feature avoids.
    expect(loc.getAttribute("aria-label")).toBe("src/lib/github-api.ts:42");
    expect(loc.hasAttribute("title")).toBe(false);
    expect(first.querySelector(".better-github-review-popover-body")?.textContent).toBe(
      "@alice: Guard the null case before dereferencing this.",
    );
    expect(first.querySelector(".better-github-review-popover-outdated")).toBeNull();

    // Second item: no line number, flagged outdated.
    const second = items[1] as HTMLElement;
    expect(second.querySelector(".better-github-review-popover-loc-text")?.textContent).toBe("README.md");
    expect(second.querySelector(".better-github-review-popover-outdated")?.textContent).toBe("outdated");
  });

  it("shows a retryable message when the detail fetch comes back empty", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 2, resolvedThreads: 0 },
    ]);
    // Empty result (a failed fetch swallows to []) → degraded popover, count intact.
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    await openPopover(badge);

    const message = badge.querySelector(".better-github-review-popover-message");
    expect(message?.textContent).toBe("Couldn't load thread details.");
    expect(badge.querySelector(".better-github-review-popover-item")).toBeNull();
    // The count badge itself is unaffected by the detail failure.
    expect(badge.textContent?.startsWith("2 unresolved")).toBe(true);

    // Re-opening retries the fetch (it stayed in the idle state after failure).
    badge.dispatchEvent(new MouseEvent("click", { bubbles: true })); // close
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([
      { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
    ]);
    await openPopover(badge);

    expect(fetchReviewThreadDetails).toHaveBeenCalledTimes(2);
    await vi.waitFor(() =>
      expect(badge.querySelectorAll(".better-github-review-popover-item")).toHaveLength(1),
    );
  });

  it("toggles the popover on click and dismisses it on an outside click / Escape", async () => {
    twoPRRows();
    vi.mocked(fetchPRReviewStatuses).mockResolvedValue([
      { number: 7, totalThreads: 1, resolvedThreads: 0 },
    ]);
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([
      { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
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
      { number: 7, totalThreads: 1, resolvedThreads: 0 },
    ]);
    vi.mocked(fetchReviewThreadDetails).mockResolvedValue([
      { path: "a.ts", line: 1, isOutdated: false, author: "alice", snippet: "fix", url: "https://github.com/owner/repo/pull/7#discussion_r1" },
    ]);

    await injectPRReviewStatus();

    const badge = document.querySelector("#issue_7 .better-github-review-status") as HTMLElement;
    await openPopover(badge);
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);

    // Clicking the link row must fall through to navigation, leaving the popover open.
    const item = badge.querySelector(".better-github-review-popover-item") as HTMLElement;
    item.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(badge.classList.contains("better-github-review-popover-open")).toBe(true);
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
