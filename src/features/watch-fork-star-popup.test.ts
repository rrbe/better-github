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
    // The popup is portaled to <body>, so query the document, not the counter.
    const items = document.querySelectorAll(".bg-wfs-popup-item");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector(".bg-wfs-popup-username")?.textContent).toBe("alice");
    expect(items[0].querySelector("img")?.getAttribute("alt")).toBe("alice");

    vi.useRealTimers();
  });

  it("portals the popup to <body>, out of the stargazers anchor, so clicks can't leak to it", async () => {
    vi.useFakeTimers();
    // GitHub nests the star counter inside an `<a href=".../stargazers">`.
    // Reproduce that to prove the popup is NOT placed inside the outer anchor.
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

    // Only the hovered star popup has a rendered item — find it by that.
    const item = document.querySelector<HTMLAnchorElement>(".bg-wfs-popup-item")!;
    const popup = item.closest<HTMLElement>(".bg-wfs-popup")!;

    // The popup lives in <body>, never inside the stargazers anchor — so a click
    // anywhere in it (user link or blank space) can't resolve to that anchor.
    expect(popup.parentElement).toBe(document.body);
    expect(outer.contains(popup)).toBe(false);

    // The link is a real anchor to the profile — the browser navigates it
    // natively, so Cmd/Ctrl/middle-click "open in new tab" keeps working.
    expect(item.getAttribute("href")).toBe(`${GH}/CodyTseng`);

    vi.useRealTimers();
  });

  it("reaps a popup whose counter left the page before re-injecting", () => {
    injectWatchForkStarPopup();
    expect(document.querySelectorAll(".bg-wfs-popup")).toHaveLength(3);

    // Simulate an SPA navigation: GitHub swaps in a fresh pagehead, dropping the
    // old counters. The portaled popups stay in <body> as orphans until reaped.
    document.querySelector("ul.pagehead-actions")!.remove();
    const fresh = document.createElement("ul");
    fresh.className = "pagehead-actions";
    fresh.innerHTML = `<li><span class="Counter js-social-count" id="star-counter">42</span></li>`;
    document.body.appendChild(fresh);

    injectWatchForkStarPopup();

    // The three orphaned popups from the old counters are gone; only the new
    // page's single popup remains.
    expect(document.querySelectorAll(".bg-wfs-popup")).toHaveLength(1);
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
