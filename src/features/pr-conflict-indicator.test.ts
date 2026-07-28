import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchPRConflictStatuses } from "../lib/github-api";
import { setUrl } from "../test-utils/url";
import { cleanupPRConflictIndicator, injectPRConflictIndicator } from "./pr-conflict-indicator";

vi.mock("../lib/github-api");

let observerCallback: IntersectionObserverCallback;
const observe = vi.fn();
const unobserve = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback;
  }

  observe = observe;
  unobserve = unobserve;
  disconnect = disconnect;
}

describe("injectPRConflictIndicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    setUrl("https://github.com/owner/repo/pulls");
    document.body.innerHTML = `
      <div id="issue_7"><a id="issue_7_link">Conflict</a></div>
      <div id="issue_8"><a id="issue_8_link">Clean</a></div>
      <div id="issue_9"><a id="issue_9_link">Off screen</a></div>
    `;
  });

  afterEach(() => {
    cleanupPRConflictIndicator();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("checks only visible PRs and renders a conflict status without creating a label", async () => {
    vi.mocked(fetchPRConflictStatuses).mockResolvedValue([
      { number: 7, mergeable: "CONFLICTING" },
      { number: 8, mergeable: "MERGEABLE" },
    ]);

    injectPRConflictIndicator();

    expect(observe).toHaveBeenCalledTimes(3);

    const row7 = document.getElementById("issue_7")!;
    const row8 = document.getElementById("issue_8")!;
    observerCallback(
      [
        { target: row7, isIntersecting: true },
        { target: row8, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );

    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(1));
    expect(fetchPRConflictStatuses).toHaveBeenCalledWith("owner", "repo", [7, 8]);

    const indicator = row7.querySelector(".better-github-conflict-indicator");
    expect(indicator?.tagName).toBe("SPAN");
    expect(indicator?.textContent).toBe("⚠ Conflicts");
    expect(indicator?.getAttribute("title")).toBe("This PR has merge conflicts");
    expect(row8.querySelector(".better-github-conflict-indicator")).toBeNull();
    expect(document.querySelector(".IssueLabel")).toBeNull();
  });
});
