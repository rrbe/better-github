import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { injectBetterTopRepos } from "./better-top-repos";

// better-top-repos is pure DOM, but its pin state lives in chrome.storage.local
// and both read/write are guarded by `chrome.runtime?.id`. Provide a minimal
// in-memory chrome so getPinnedRepos()/savePinnedRepos() exercise the real path.
interface StorageState {
  store: Record<string, unknown>;
  setCalls: Record<string, unknown>[];
}

function stubChrome(initialPinned: string[] = []): StorageState {
  const state: StorageState = {
    store: initialPinned.length ? { "pinned-repos": initialPinned } : {},
    setCalls: [],
  };
  vi.stubGlobal("chrome", {
    runtime: { id: "ext-id" },
    storage: {
      local: {
        get: vi.fn((keys: string[], cb: (r: Record<string, unknown>) => void) => {
          cb(Object.fromEntries(keys.map((k) => [k, state.store[k]])));
        }),
        set: vi.fn((items: Record<string, unknown>) => {
          Object.assign(state.store, items);
          state.setCalls.push(items);
        }),
      },
    },
  });
  return state;
}

// --- DOM fixtures ----------------------------------------------------------

// OLD dashboard layout: a dedicated <ul class="js-dashboard-repos-list"> whose
// <li> rows each carry a /owner/repo anchor. No heading inside the <ul>.
function oldDashboard(repoNames: string[]): void {
  const rows = repoNames
    .map((name) => `<li class="repo-row"><a href="/${name}">${name}</a></li>`)
    .join("");
  document.body.innerHTML = `
    <div class="js-repos-container">
      <ul class="js-dashboard-repos-list">${rows}</ul>
    </div>
  `;
}

// NEW dashboard layout: a Primer ActionList <ul> where the first <li> is the
// "Top repositories" heading and the rest are repo items.
function newDashboard(repoNames: string[]): void {
  const heading = `<li class="heading"><h3>Top repositories</h3></li>`;
  const rows = repoNames
    .map(
      (name) =>
        `<li class="prc-ActionList-ActionListItem-uq6I7"><a href="/${name}">${name}</a></li>`,
    )
    .join("");
  document.body.innerHTML = `<ul class="action-list">${heading}${rows}</ul>`;
}

const TWENTY = Array.from({ length: 20 }, (_, i) => `owner/repo${i}`);

function pinButtons(): NodeListOf<HTMLButtonElement> {
  return document.querySelectorAll<HTMLButtonElement>(".better-github-pin-btn");
}

function repoOrder(): string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>("li a[href^='/']")].map(
    (a) => a.getAttribute("href")!.slice(1),
  );
}

// injectPinIcons reads pinned state asynchronously (chrome.storage callback +
// a .then), so let microtasks settle after each call.
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("injectBetterTopRepos", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.head.innerHTML = "";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("bails when there is no Top repositories list", async () => {
    stubChrome();
    document.body.innerHTML = `<div><ul><li><a href="/owner/repo">x</a></li></ul></div>`;

    injectBetterTopRepos();
    await flush();

    expect(pinButtons()).toHaveLength(0);
    expect(document.getElementById("better-github-pin-styles")).toBeNull();
  });

  it("injects a pin button onto every repo row (old layout)", async () => {
    stubChrome();
    oldDashboard(TWENTY);

    injectBetterTopRepos();
    await flush();

    // One button per repo row, each a real <button> tagged onto its <li>.
    expect(pinButtons()).toHaveLength(20);
    const firstRow = document.querySelector(".js-dashboard-repos-list li")!;
    expect(firstRow.querySelector(".better-github-pin-btn")).not.toBeNull();
    expect(firstRow.getAttribute("data-better-github-pin-injected")).toBe("true");
    // Styles injected exactly once into <head>.
    expect(document.getElementById("better-github-pin-styles")).not.toBeNull();
  });

  it("renders the pinned repo's button in the filled/pinned state", async () => {
    stubChrome(["owner/repo5"]);
    oldDashboard(TWENTY);

    injectBetterTopRepos();
    await flush();

    const pinnedBtn = document
      .querySelector('a[href="/owner/repo5"]')!
      .closest("li")!
      .querySelector(".better-github-pin-btn")!;
    expect(pinnedBtn.classList.contains("pinned")).toBe(true);
    expect(pinnedBtn.getAttribute("title")).toBe("Unpin repository");

    const plainBtn = document
      .querySelector('a[href="/owner/repo0"]')!
      .closest("li")!
      .querySelector(".better-github-pin-btn")!;
    expect(plainBtn.classList.contains("pinned")).toBe(false);
    expect(plainBtn.getAttribute("title")).toBe("Pin repository");
  });

  it("reorders pinned repos to the top of the list (old layout)", async () => {
    // repo7 and repo3 are pinned; pinned-array order is [repo7, repo3].
    stubChrome(["owner/repo7", "owner/repo3"]);
    oldDashboard(TWENTY);

    injectBetterTopRepos();
    await flush();

    const order = repoOrder();
    // Pinned ones float to the front in pinned-array order, the rest follow.
    expect(order[0]).toBe("owner/repo7");
    expect(order[1]).toBe("owner/repo3");
    expect(order.slice(2)).not.toContain("owner/repo7");
    expect(order.slice(2)).not.toContain("owner/repo3");
  });

  it("keeps the heading first and pins below it (new layout)", async () => {
    stubChrome(["owner/repo4"]);
    newDashboard(Array.from({ length: 20 }, (_, i) => `owner/repo${i}`));

    injectBetterTopRepos();
    await flush();

    const lis = [...document.querySelectorAll("ul.action-list > li")];
    // Heading row stays at index 0; the pinned repo is the first actual item.
    expect(lis[0].querySelector("h3")?.textContent).toBe("Top repositories");
    expect(lis[1].querySelector("a")?.getAttribute("href")).toBe("/owner/repo4");
    expect(pinButtons()).toHaveLength(20);
  });

  it("clicking a repo's pin button toggles it and persists to storage", async () => {
    const state = stubChrome();
    oldDashboard(TWENTY);

    injectBetterTopRepos();
    await flush();

    const row3 = document.querySelector('a[href="/owner/repo3"]')!.closest("li")!;
    const btn = row3.querySelector<HTMLButtonElement>(".better-github-pin-btn")!;
    expect(btn.classList.contains("pinned")).toBe(false);

    btn.click();
    await flush();

    expect(btn.classList.contains("pinned")).toBe(true);
    expect(btn.getAttribute("title")).toBe("Unpin repository");
    // Persisted to chrome.storage.local under the pinned-repos key.
    expect(state.store["pinned-repos"]).toEqual(["owner/repo3"]);
    // And the newly-pinned repo floated to the top.
    expect(repoOrder()[0]).toBe("owner/repo3");
  });

  it("is idempotent — a second pass adds no duplicate buttons", async () => {
    stubChrome(["owner/repo2"]);
    oldDashboard(TWENTY);

    injectBetterTopRepos();
    await flush();
    injectBetterTopRepos();
    await flush();

    expect(pinButtons()).toHaveLength(20);
    // Styles still present once.
    expect(document.querySelectorAll("#better-github-pin-styles")).toHaveLength(1);
  });

  it("clicks Show more instead of pinning when fewer than 20 repos are loaded", async () => {
    stubChrome();
    const click = vi.fn();
    document.body.innerHTML = `
      <div class="js-repos-container">
        <ul class="js-dashboard-repos-list">
          <li><a href="/owner/repo0">owner/repo0</a></li>
          <li><a href="/owner/repo1">owner/repo1</a></li>
        </ul>
        <form class="js-more-repos-form"><button type="submit">Show more</button></form>
      </div>
    `;
    const showMore = document.querySelector<HTMLButtonElement>(
      ".js-more-repos-form button",
    )!;
    showMore.click = click;

    injectBetterTopRepos();
    await flush();

    // Auto-expand path: it clicks Show more and returns BEFORE injecting pins.
    expect(click).toHaveBeenCalledTimes(1);
    expect(pinButtons()).toHaveLength(0);
  });

  it("stops clicking Show more after the click cap and falls through to pinning", async () => {
    stubChrome();
    let clicks = 0;
    document.body.innerHTML = `
      <div class="js-repos-container">
        <ul class="js-dashboard-repos-list">
          <li><a href="/owner/repo0">owner/repo0</a></li>
        </ul>
        <form class="js-more-repos-form"><button type="submit">Show more</button></form>
      </div>
    `;
    const showMore = document.querySelector<HTMLButtonElement>(
      ".js-more-repos-form button",
    )!;
    showMore.click = () => {
      clicks++;
    };

    // MAX_SHOW_MORE_CLICKS is 5; the 6th call must give up and inject pins.
    for (let i = 0; i < 6; i++) {
      injectBetterTopRepos();
      await flush();
    }

    expect(clicks).toBe(5);
    expect(pinButtons()).toHaveLength(1);
  });
});
