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
      <div id="issue_10">
        <a id="issue_10_link">Labeled conflict</a>
        <a class="IssueLabel" data-name="cOnFlIcTs">cOnFlIcTs</a>
      </div>
      <div id="issue_11">
        <a id="issue_11_link">Singular labeled conflict</a>
        <a class="IssueLabel">CONFLICT</a>
      </div>
    `;
  });

  afterEach(() => {
    cleanupPRConflictIndicator();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("checks only visible PRs and renders a conflict status without creating a label", async () => {
    vi.mocked(fetchPRConflictStatuses).mockResolvedValue([
      { number: 7, state: "OPEN", mergeable: "CONFLICTING" },
      { number: 8, state: "OPEN", mergeable: "MERGEABLE" },
    ]);

    injectPRConflictIndicator();

    expect(observe).toHaveBeenCalledTimes(5);

    const row7 = document.getElementById("issue_7")!;
    const row8 = document.getElementById("issue_8")!;
    const row10 = document.getElementById("issue_10")!;
    const row11 = document.getElementById("issue_11")!;
    observerCallback(
      [
        { target: row7, isIntersecting: true },
        { target: row8, isIntersecting: true },
        { target: row10, isIntersecting: true },
        { target: row11, isIntersecting: true },
      ] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );

    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(1));
    expect(fetchPRConflictStatuses).toHaveBeenCalledWith("owner", "repo", [7, 8]);

    const indicator = row7.querySelector(".better-github-conflict-indicator");
    expect(indicator?.tagName).toBe("SPAN");
    expect(indicator?.textContent).toBe("Conflicts");
    expect(indicator?.getAttribute("title")).toBe("This PR has merge conflicts");
    expect(indicator?.getAttribute("href")).toBeNull();
    expect(row8.querySelector(".better-github-conflict-indicator")).toBeNull();
    expect(row10.querySelector(".better-github-conflict-indicator")).toBeNull();
    expect(row11.querySelector(".better-github-conflict-indicator")).toBeNull();
    expect(row7.querySelector(".IssueLabel")).toBeNull();
  });

  it("keeps an in-flight check alive when the page handler runs again", async () => {
    let resolveStatuses!: (statuses: Awaited<ReturnType<typeof fetchPRConflictStatuses>>) => void;
    vi.mocked(fetchPRConflictStatuses).mockReturnValue(
      new Promise((resolve) => {
        resolveStatuses = resolve;
      }),
    );

    injectPRConflictIndicator();

    const row7 = document.getElementById("issue_7")!;
    observerCallback(
      [{ target: row7, isIntersecting: true }] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(1));

    injectPRConflictIndicator();
    resolveStatuses([{ number: 7, state: "OPEN", mergeable: "CONFLICTING" }]);

    await vi.waitFor(() =>
      expect(row7.querySelector(".better-github-conflict-indicator")).not.toBeNull(),
    );
  });

  it("retries unknown and missing statuses on the next polling pass", async () => {
    vi.mocked(fetchPRConflictStatuses)
      .mockResolvedValueOnce([{ number: 7, state: "OPEN", mergeable: "UNKNOWN" }])
      .mockResolvedValueOnce([
        { number: 7, state: "OPEN", mergeable: "CONFLICTING" },
        { number: 8, state: "OPEN", mergeable: "MERGEABLE" },
      ]);

    injectPRConflictIndicator();

    const row7 = document.getElementById("issue_7")!;
    const row8 = document.getElementById("issue_8")!;
    const entries = [
      { target: row7, isIntersecting: true },
      { target: row8, isIntersecting: true },
    ] as unknown as IntersectionObserverEntry[];
    observerCallback(entries, {} as IntersectionObserver);
    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    injectPRConflictIndicator();
    expect(observe.mock.calls.filter(([row]) => row === row7)).toHaveLength(2);
    expect(observe.mock.calls.filter(([row]) => row === row8)).toHaveLength(2);

    observerCallback(entries, {} as IntersectionObserver);
    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(2));
    expect(row7.querySelector(".better-github-conflict-indicator")).not.toBeNull();
  });

  it("ignores merged stacked PR conflicts without retrying them", async () => {
    vi.mocked(fetchPRConflictStatuses).mockResolvedValue([
      { number: 7, state: "MERGED", mergeable: "CONFLICTING" },
    ]);

    injectPRConflictIndicator();

    const row7 = document.getElementById("issue_7")!;
    observerCallback(
      [{ target: row7, isIntersecting: true }] as unknown as IntersectionObserverEntry[],
      {} as IntersectionObserver,
    );
    await vi.waitFor(() => expect(fetchPRConflictStatuses).toHaveBeenCalledTimes(1));

    injectPRConflictIndicator();
    expect(observe.mock.calls.filter(([row]) => row === row7)).toHaveLength(1);
    expect(row7.querySelector(".better-github-conflict-indicator")).toBeNull();
  });
});
