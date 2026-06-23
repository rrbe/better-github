import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { cleanupWatchForkStarPopup, injectWatchForkStarPopup } from "./watch-fork-star-popup";
import { fetchWatchers, fetchStargazers } from "../lib/github-api";

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

  it("keeps a clicked stargazer's link pointing at their profile and out of the stargazers anchor", async () => {
    vi.useFakeTimers();
    // GitHub nests the star counter inside an `<a href=".../stargazers">`.
    // Reproduce that so the popup's user links live inside the outer anchor.
    const star = document.getElementById("star-counter")!;
    const outer = document.createElement("a");
    outer.href = `${GH}/owner/repo/stargazers`;
    star.replaceWith(outer);
    outer.appendChild(star);

    vi.mocked(fetchStargazers).mockResolvedValue([
      { login: "CodyTseng", avatarUrl: "https://a/cody.png", name: "Cody", starredAt: "2024-01-01T00:00:00Z" },
    ]);

    injectWatchForkStarPopup();
    star.dispatchEvent(new Event("mouseenter"));
    await vi.advanceTimersByTimeAsync(300);

    const item = star.querySelector<HTMLAnchorElement>(".bg-wfs-popup-item")!;
    // The link is a real anchor to the profile — the browser navigates it
    // natively (so new-tab modifiers keep working); we only stop the click
    // from reaching the outer stargazers anchor / GitHub's handlers.
    expect(item.getAttribute("href")).toBe(`${GH}/CodyTseng`);

    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    const onOuter = vi.fn();
    outer.addEventListener("click", onOuter);
    item.dispatchEvent(click);

    expect(onOuter).not.toHaveBeenCalled();
    // We don't preventDefault — native anchor navigation is left intact.
    expect(click.defaultPrevented).toBe(false);

    vi.useRealTimers();
  });

  it("swallows blank-area clicks so they don't fall through to the stargazers anchor", () => {
    const star = document.getElementById("star-counter")!;
    const outer = document.createElement("a");
    outer.href = `${GH}/owner/repo/stargazers`;
    star.replaceWith(outer);
    outer.appendChild(star);

    injectWatchForkStarPopup();
    const onOuter = vi.fn();
    outer.addEventListener("click", onOuter);

    // Click the popup header (no link) — must not bubble to the outer anchor.
    const header = star.querySelector(".bg-wfs-popup-header")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    header.dispatchEvent(click);

    expect(onOuter).not.toHaveBeenCalled();
  });

  it("hides the counter's native title on hover and restores it on leave", () => {
    injectWatchForkStarPopup();
    const star = document.getElementById("star-counter")!;
    // GitHub ships the exact count as a native `title` on the counter span.
    star.setAttribute("title", "1,234");

    // Hover → native tooltip suppressed so it can't overlap our popup.
    star.dispatchEvent(new Event("mouseenter"));
    expect(star.hasAttribute("title")).toBe(false);

    // Leave → the native title comes back untouched.
    star.dispatchEvent(new Event("mouseleave"));
    expect(star.getAttribute("title")).toBe("1,234");
  });

  it("restores a mid-hover stashed title on cleanup", () => {
    injectWatchForkStarPopup();
    const star = document.getElementById("star-counter")!;
    star.setAttribute("title", "1,234");

    star.dispatchEvent(new Event("mouseenter"));
    expect(star.hasAttribute("title")).toBe(false);

    // Tear down while still hovered — the title must not be lost.
    cleanupWatchForkStarPopup();
    expect(star.getAttribute("title")).toBe("1,234");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
