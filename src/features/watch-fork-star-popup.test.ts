import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { cleanupWatchForkStarPopup, injectWatchForkStarPopup } from "./watch-fork-star-popup";
import { fetchWatchers } from "../lib/github-api";

vi.mock("../lib/github-api");

const GH = "https://github.com";

describe("watch/fork/star popup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = `
      <ul class="pagehead-actions">
        <li><span class="CounterLabel" id="watch-counter">4</span></li>
        <li><a id="fork-button"><span class="Counter" id="fork-counter">2</span></a></li>
        <li><span class="Counter js-social-count" id="star-counter">9</span></li>
      </ul>
    `;
  });

  it("injects popups idempotently and cleans up without deleting GitHub counters", async () => {
    injectWatchForkStarPopup();
    injectWatchForkStarPopup();

    expect(document.querySelectorAll(".bg-wfs-counter-wrap")).toHaveLength(3);
    expect(document.querySelectorAll(".bg-wfs-popup")).toHaveLength(3);

    const watchCounter = document.getElementById("watch-counter")!;
    cleanupWatchForkStarPopup();

    expect(document.getElementById("watch-counter")).toBe(watchCounter);
    expect(watchCounter.classList.contains("bg-wfs-counter-wrap")).toBe(false);
    expect(document.querySelector(".bg-wfs-popup")).toBeNull();

    watchCounter.textContent = "5";
    await Promise.resolve();

    expect(document.querySelector(".bg-wfs-popup")).toBeNull();
  });

  it("loads and renders the user list when a counter is hovered", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchWatchers).mockResolvedValue([
      { login: "alice", avatarUrl: "https://a/alice.png", name: "Alice A" },
      { login: "bob", avatarUrl: "https://a/bob.png", name: null },
    ]);

    injectWatchForkStarPopup();
    const watchCounter = document.getElementById("watch-counter")!;

    // Hover opens after HOVER_OPEN_DELAY, which triggers the (mocked) fetch.
    watchCounter.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchWatchers).toHaveBeenCalledWith("owner", "repo");
    const items = watchCounter.querySelectorAll(".bg-wfs-popup-item");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector(".bg-wfs-popup-username")?.textContent).toBe("alice");
    expect(items[0].querySelector("img")?.getAttribute("alt")).toBe("alice");

    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
