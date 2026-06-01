import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
