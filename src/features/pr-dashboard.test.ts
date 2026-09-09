import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, dashboardRow } from "../test-utils/pr-dashboard";
import { setUrl } from "../test-utils/url";
import { collectPRRows } from "../lib/pr-list-dom";
import { reserveInfoRowSkeletons } from "../lib/info-row-skeleton";
import {
  fetchPRBranches,
  fetchPRDiffStats,
  fetchPRReviewStatuses,
  fetchPRConflictStatuses,
} from "../lib/github-api";
import { injectPRBranchNames } from "./pr-branch-names";
import { injectPRDiffStats } from "./pr-diff-stats";
import { injectPRReviewStatus } from "./pr-review-status";
import { cleanupPRConflictIndicator, injectPRConflictIndicator } from "./pr-conflict-indicator";
import { cleanupPRLabelPosition, injectPRLabelPosition } from "./pr-label-position";

vi.mock("../lib/github-api");

async function injectBadges(): Promise<void> {
  reserveInfoRowSkeletons({ "feature-pr-branch-names": true, "feature-pr-diff-stats": true });
  injectPRLabelPosition();
  await Promise.all([injectPRBranchNames(), injectPRDiffStats(), injectPRReviewStatus()]);
}

describe("repository PR dashboard preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl("https://github.com/owner/repo/pulls");
    document.body.innerHTML = dashboard(dashboardRow(7));
    vi.mocked(fetchPRBranches).mockImplementation(async (_owner, _repo, numbers) =>
      numbers.map((number) => ({ number, headRef: `feature/${number}` })),
    );
    vi.mocked(fetchPRDiffStats).mockImplementation(async (_owner, _repo, numbers) =>
      numbers.map((number) => ({ number, additions: 12, deletions: 3, changedFiles: 2 })),
    );
    vi.mocked(fetchPRReviewStatuses).mockImplementation(async (_owner, _repo, numbers) =>
      numbers.map((number) => ({ number, totalThreads: 3, resolvedThreads: 1 })),
    );
  });

  afterEach(() => {
    cleanupPRLabelPosition();
    cleanupPRConflictIndicator();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("replaces skeletons with ordered badges below the native metadata", async () => {
    reserveInfoRowSkeletons({ "feature-pr-branch-names": true, "feature-pr-diff-stats": true });
    expect(document.querySelectorAll(".bg-skeleton-pill")).toHaveLength(2);
    await injectBadges();
    const info = document.querySelector(".better-github-info-row")!;
    expect(info.previousElementSibling?.className).toContain("Description-module__container");
    expect([...info.children].map((el) => (el as HTMLElement).dataset.bgInfoRowItem)).toEqual([
      "branch",
      "diff",
      "labels",
      "review",
    ]);
    expect(info.querySelector(".better-github-branch-badge")?.textContent).toBe("feature/7");
    expect(info.querySelector(".better-github-diff-stats-add")?.textContent).toBe("+12");
    expect(info.querySelector(".better-github-review-status")?.textContent).toBe("2 unresolved");
    expect(document.querySelectorAll(".bg-skeleton-pill")).toHaveLength(0);
    expect(fetchPRBranches).toHaveBeenCalledWith("owner", "repo", [7], "open", 1);
  });

  it("enhances added and replaced React rows while keeping existing rows idempotent", async () => {
    await injectBadges();
    document.querySelector("ul")!.insertAdjacentHTML("beforeend", dashboardRow(8));
    await injectBadges();
    expect(fetchPRBranches).toHaveBeenLastCalledWith("owner", "repo", [8], "open", 1);
    expect(fetchPRDiffStats).toHaveBeenLastCalledWith("owner", "repo", [8]);
    expect(fetchPRReviewStatuses).toHaveBeenLastCalledWith("owner", "repo", [8]);
    document.querySelector("li")!.outerHTML = dashboardRow(7);
    await injectBadges();
    await injectBadges();
    expect(fetchPRBranches).toHaveBeenCalledTimes(3);
    for (const row of collectPRRows("owner", "repo").values()) {
      expect(row.querySelectorAll(".better-github-info-row")).toHaveLength(1);
      expect(row.querySelectorAll(".better-github-branch-badge")).toHaveLength(1);
      expect(row.querySelectorAll(".better-github-review-status")).toHaveLength(1);
    }
  });

  it("preserves React label filtering by forwarding cloned button clicks", () => {
    const original = document.querySelector<HTMLButtonElement>("button")!;
    const filter = vi.fn();
    original.addEventListener("click", filter);
    injectPRLabelPosition();
    const clone = document.querySelector<HTMLButtonElement>(".better-github-label-prefix button")!;
    expect(clone.tabIndex).toBe(0);
    clone.click();
    expect(filter).toHaveBeenCalledTimes(1);
    expect(original.parentElement?.classList.contains("better-github-labels-hidden")).toBe(true);
    expect(original.isConnected).toBe(true);
  });

  it("stops animation injection on disable and restores it on re-enable", () => {
    injectPRLabelPosition();
    cleanupPRLabelPosition();
    document.querySelector(".better-github-label-prefix")!.remove();
    const original = document.querySelector("[class*='trailingBadgesContainer']")!;
    original.dispatchEvent(
      new AnimationEvent("animationstart", {
        bubbles: true,
        animationName: "better-github-detect-labels",
      }),
    );
    expect(document.querySelector(".better-github-label-prefix")).toBeNull();
    expect(original.classList.contains("better-github-labels-hidden")).toBe(false);
    injectPRLabelPosition();
    expect(document.querySelectorAll(".better-github-label-prefix")).toHaveLength(1);
  });

  it("checks visible dashboard rows and avoids duplicating native conflict labels", async () => {
    let callback!: IntersectionObserverCallback;
    const observe = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb;
        }
        observe = observe;
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    document.body.innerHTML = dashboard(
      dashboardRow(7),
      dashboardRow(8, "Conflicts"),
      dashboardRow(9),
    );
    vi.mocked(fetchPRConflictStatuses).mockResolvedValue([
      { number: 7, state: "OPEN", mergeable: "CONFLICTING" },
    ]);
    injectPRLabelPosition();
    injectPRConflictIndicator();
    expect(observe).toHaveBeenCalledTimes(3);
    const rows = [...collectPRRows("owner", "repo").values()];
    callback(
      rows.map((target, i) => ({ target, isIntersecting: i < 2 })) as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    await vi.waitFor(() =>
      expect(rows[0].querySelector(".better-github-conflict-indicator")).not.toBeNull(),
    );
    expect(fetchPRConflictStatuses).toHaveBeenCalledWith("owner", "repo", [7]);
    expect(document.querySelectorAll(".better-github-conflict-indicator")).toHaveLength(1);
  });
});
