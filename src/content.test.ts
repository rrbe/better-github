import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { injectPRBranchNames } from "./features/pr-branch-names";

vi.mock("./features/pr-branch-names", () => ({ injectPRBranchNames: vi.fn() }));

let removeFeatureElements: typeof import("./content").removeFeatureElements;

describe("removeFeatureElements", () => {
  beforeEach(async () => {
    // Importing content.ts runs startNavigation(), which registers a polling
    // setInterval — keep it inert so it never fires mid-test.
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";
    ({ removeFeatureElements } = await import("./content"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Guards the original bug: FEATURE_CLASSES for watch-fork-star once listed
  // "bg-wfs-counter-wrap" — the class we add to GitHub's *own* counters — so
  // disabling the feature ran el.remove() on GitHub's native watch/fork/star
  // counts. The removal list must only target our injected popups.
  it("removes our watch/fork/star popups without deleting GitHub's native counters", () => {
    document.body.innerHTML = `
      <ul class="pagehead-actions">
        <li><span class="CounterLabel bg-wfs-counter-wrap" id="watch-counter">4<div class="bg-wfs-popup"></div></span></li>
        <li><a id="fork-button"><span class="Counter bg-wfs-counter-wrap" id="fork-counter">2<div class="bg-wfs-popup"></div></span></a></li>
      </ul>
    `;

    removeFeatureElements("feature-watch-fork-star-popup");

    expect(document.getElementById("watch-counter")).not.toBeNull();
    expect(document.getElementById("fork-counter")).not.toBeNull();
    expect(document.querySelectorAll(".bg-wfs-popup")).toHaveLength(0);
  });
});

describe("content preferences", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("reuses preferences during polling and keeps toggle changes effective", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = "";
    const get = vi.fn((keys: string[], callback: (value: Record<string, unknown>) => void) => {
      callback(Object.fromEntries(keys.map((key) => [key, key === "locale" ? "en" : false])));
    });
    const addListener = vi.fn();
    vi.stubGlobal("chrome", {
      runtime: { id: "test" },
      storage: { local: { get }, onChanged: { addListener } },
    });
    await import("./content");
    await vi.advanceTimersByTimeAsync(0);
    expect(get).toHaveBeenCalledTimes(2);
    expect(injectPRBranchNames).not.toHaveBeenCalled();

    const onChanged = addListener.mock.calls[0][0];
    await onChanged({ "feature-pr-branch-names": { newValue: true } }, "local");
    expect(injectPRBranchNames).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    expect(injectPRBranchNames).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);

    await onChanged({ "feature-pr-branch-names": { newValue: false } }, "local");
    await vi.advanceTimersByTimeAsync(2000);
    expect(injectPRBranchNames).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledTimes(2);
  });
});
