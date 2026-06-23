import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import type { ContributorInfo } from "../lib/messages";

// The card fetches via the service-worker bridge; stub it so tests are pure DOM.
const fetchContributorInfo =
  vi.fn<(login: string, owner?: string, repo?: string) => Promise<ContributorInfo | null>>();
vi.mock("../lib/github-api", () => ({
  fetchContributorInfo: (login: string, owner?: string, repo?: string) =>
    fetchContributorInfo(login, owner, repo),
}));

const { injectContributorCard, cleanupContributorCard } = await import("./contributor-card");

const GH = "https://github.com";
const NOW = new Date("2026-06-16T00:00:00Z");
const BLOCK = ".better-github-contributor-card";

function baseInfo(over: Partial<ContributorInfo> = {}): ContributorInfo {
  return {
    login: "octocat",
    createdAt: "2026-06-13T00:00:00Z", // 3 days before NOW
    followers: 10,
    publicRepos: 5,
    prTotal: 8,
    prMerged: 2,
    prClosed: 5,
    repoAssociation: "FIRST_TIME_CONTRIBUTOR",
    contributionsLastYear: 1240,
    hasToken: true,
    ...over,
  };
}

/** Build the persistent hovercard container, populated for `login` (or a
 * non-user payload when userCard=false). */
function hovercard(login: string, userCard = true): HTMLElement {
  const payload = userCard
    ? { event_type: "user-hovercard-hover", payload: { card_user_login: login } }
    : { event_type: "repository-hovercard-hover", payload: {} };
  const el = document.createElement("div");
  el.className = "Popover js-hovercard-content";
  el.innerHTML = `<div class="Popover-message">
    <div data-hydro-view='${JSON.stringify(payload)}'><div class="content">card</div></div>
  </div>`;
  return el;
}

// Let the body MutationObserver, its rAF-coalesced scan, and the async fetch flush.
const flush = () => new Promise((resolve) => setTimeout(resolve, 50));

describe("injectContributorCard", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] }); // freeze Date, keep real timers/rAF
    vi.setSystemTime(NOW);
    setUrl(`${GH}/owner/repo/pull/1`);
    document.body.innerHTML = "";
    fetchContributorInfo.mockReset();
  });

  afterEach(() => {
    cleanupContributorCard();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("appends a fact block with account age, repo relation, history and activity", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));

    await flush();

    const block = document.querySelector<HTMLElement>(BLOCK);
    expect(block).not.toBeNull();
    const text = block!.textContent ?? "";
    expect(text).toContain("3 days · 2026-06"); // account age + created month
    expect(text).toContain("First-time contributor"); // FIRST_TIME_CONTRIBUTOR
    expect(text).toContain("8 PR · 2 merged · 5 closed"); // history: total/merged/rejected
    expect(text).toContain("1240 contributions in the past year"); // token activity
  });

  it("passes the current repo context to the fetch", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    expect(fetchContributorInfo).toHaveBeenCalledWith("octocat", "owner", "repo");
  });

  it("shows a token prompt for activity when no token is set", async () => {
    fetchContributorInfo.mockResolvedValue(
      baseInfo({ hasToken: false, contributionsLastYear: null }),
    );
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    const text = document.querySelector<HTMLElement>(BLOCK)?.textContent ?? "";
    expect(text).toContain("🔒 Connect a token to see");
    expect(text).not.toContain("contributions in the past year");
  });

  it("shows a returning contributor's association and omits an empty history", async () => {
    fetchContributorInfo.mockResolvedValue(
      baseInfo({ repoAssociation: "CONTRIBUTOR", prTotal: 0, prMerged: 0, prClosed: 0 }),
    );
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    const text = document.querySelector<HTMLElement>(BLOCK)?.textContent ?? "";
    expect(text).toContain("Contributor");
    expect(text).not.toContain("PR ·"); // history row omitted when prTotal is 0
  });

  it("shows an elevated repo identity instead of a contributor label", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo({ repoAssociation: "MEMBER" }));
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    const text = document.querySelector<HTMLElement>(BLOCK)?.textContent ?? "";
    expect(text).toContain("Member");
    expect(text).not.toContain("First-time"); // identity replaces the first-time label
  });

  it("survives a same-user content swap without flickering (avatar→username)", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    const card = hovercard("octocat");
    document.body.appendChild(card);
    await flush();
    expect(document.querySelectorAll(BLOCK)).toHaveLength(1); // appeared (in the container)

    // GitHub replaces the body's content node for the same user (avatar→username).
    // Our panel lives in the stable popover root, NOT the body — so it stays put.
    const message = card.querySelector<HTMLElement>(".Popover-message")!;
    message.replaceChildren();
    expect(document.querySelectorAll(BLOCK)).toHaveLength(1); // NOT removed — no flicker

    const fresh = document.createElement("div");
    fresh.setAttribute(
      "data-hydro-view",
      JSON.stringify({
        event_type: "user-hovercard-hover",
        payload: { card_user_login: "octocat" },
      }),
    );
    fresh.innerHTML = '<div class="content">card</div>';
    message.appendChild(fresh);
    await flush();

    // Still exactly one — the same-user swap was a no-op for us.
    expect(document.querySelectorAll(BLOCK)).toHaveLength(1);
  });

  it("survives a navigation re-inject without wiping a live panel", async () => {
    // navigation.ts re-fires every onPageReady handler on a 2s poll and on
    // turbo:render, which re-calls injectContributorCard *while hovering*. That
    // must be a no-op — the old code ran cleanupContributorCard() here, removing
    // the live panel and clearing the cache, which made the card flash then
    // vanish on its own (~0.5–1s in) with GitHub's native card still showing.
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();
    expect(document.querySelectorAll(BLOCK)).toHaveLength(1);
    expect(fetchContributorInfo).toHaveBeenCalledTimes(1);

    injectContributorCard(); // simulates the 2s poll / turbo:render re-run
    await flush();

    expect(document.querySelectorAll(BLOCK)).toHaveLength(1); // not wiped
    expect(fetchContributorInfo).toHaveBeenCalledTimes(1); // cache reused, no refetch
  });

  it("rebuilds the panel when the hovercard switches to a different user", async () => {
    fetchContributorInfo.mockImplementation(async (login) => baseInfo({ login }));
    injectContributorCard();
    const card = hovercard("alice");
    document.body.appendChild(card);
    await flush();
    expect(document.querySelector<HTMLElement>(BLOCK)?.dataset.login).toBe("alice");

    // Same container, new user (GitHub reuses the popover for the next hover).
    const message = card.querySelector<HTMLElement>(".Popover-message")!;
    message.replaceChildren();
    const fresh = document.createElement("div");
    fresh.setAttribute(
      "data-hydro-view",
      JSON.stringify({
        event_type: "user-hovercard-hover",
        payload: { card_user_login: "bob" },
      }),
    );
    message.appendChild(fresh);
    await flush();

    const panels = document.querySelectorAll<HTMLElement>(BLOCK);
    expect(panels).toHaveLength(1);
    expect(panels[0].dataset.login).toBe("bob");
  });

  it("ignores non-user hovercards (repo/issue cards reuse the same container)", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    document.body.appendChild(hovercard("ignored", false));
    await flush();

    expect(fetchContributorInfo).not.toHaveBeenCalled();
    expect(document.querySelector(BLOCK)).toBeNull();
  });

  it("adds no block when no data comes back", async () => {
    fetchContributorInfo.mockResolvedValue(null);
    injectContributorCard();
    document.body.appendChild(hovercard("ghost"));
    await flush();

    expect(document.querySelector(BLOCK)).toBeNull();
  });

  it("retries a failed fetch on a later hover instead of suppressing the card forever", async () => {
    // fetchContributorInfo returns null on ANY error (rate limit, network blip).
    // Caching that as permanent "no data" hid the card for the rest of the
    // session after a single transient failure. It must retry — but not storm
    // the network on every hovercard re-render, so a short cooldown gates it.
    fetchContributorInfo.mockResolvedValueOnce(null); // first attempt fails
    injectContributorCard();
    const card = hovercard("octocat");
    document.body.appendChild(card);
    await flush();

    expect(document.querySelector(BLOCK)).toBeNull(); // failed → nothing shown
    expect(fetchContributorInfo).toHaveBeenCalledTimes(1);

    // Re-hover within the cooldown: no refetch (no storm), still nothing.
    card.querySelector(".content")!.appendChild(document.createElement("span"));
    await flush();
    expect(fetchContributorInfo).toHaveBeenCalledTimes(1);
    expect(document.querySelector(BLOCK)).toBeNull();

    // Past the cooldown, a hover retries — and this time the fetch succeeds.
    fetchContributorInfo.mockResolvedValue(baseInfo());
    vi.setSystemTime(new Date(NOW.getTime() + 61_000));
    card.querySelector(".content")!.appendChild(document.createElement("span"));
    await flush();

    expect(fetchContributorInfo).toHaveBeenCalledTimes(2); // retried, not stuck
    expect(document.querySelector<HTMLElement>(BLOCK)?.textContent).toContain("3 days");
  });

  it("shows a loading skeleton, then fills it in when data arrives", async () => {
    // The panel is anchored in the stable popover root (not inside the body
    // GitHub re-renders), so a skeleton→data swap is safe — it lets the facts
    // fill in rather than the whole panel popping in when the fetch lands.
    let resolve!: (info: ContributorInfo) => void;
    fetchContributorInfo.mockReturnValue(new Promise((r) => (resolve = r)));
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    const loading = document.querySelector<HTMLElement>(BLOCK);
    expect(loading).not.toBeNull();
    expect(loading!.dataset.skeleton).toBe("true"); // a skeleton while pending
    expect(loading!.querySelector(`${BLOCK}-skeleton`)).not.toBeNull();
    expect(loading!.textContent).not.toContain("days"); // no real data yet

    resolve(baseInfo());
    await flush();

    const panels = document.querySelectorAll<HTMLElement>(BLOCK);
    expect(panels).toHaveLength(1); // skeleton replaced in place, not duplicated
    expect(panels[0].dataset.skeleton).toBeUndefined();
    expect(panels[0].textContent).toContain("3 days · 2026-06"); // real data
  });

  it("does not double-decorate the same populated card", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    const card = hovercard("octocat");
    document.body.appendChild(card);
    await flush();
    // A further unrelated mutation inside the card must not add a second block.
    card.querySelector(".content")!.appendChild(document.createElement("span"));
    await flush();

    expect(document.querySelectorAll(BLOCK)).toHaveLength(1);
  });

  it("stops decorating after cleanup", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo());
    injectContributorCard();
    cleanupContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    expect(document.querySelector(BLOCK)).toBeNull();
  });
});
