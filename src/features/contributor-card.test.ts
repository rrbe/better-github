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
    repoMerged: 0,
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
    expect(text).toContain("3 days (2026-06)"); // account age + created month
    expect(text).toContain("First-time contributor"); // repoMerged 0
    expect(text).toContain("8 PR · 2 merged (25%)"); // history + merge rate
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

  it("shows merged-PR count for a returning contributor and omits an empty history", async () => {
    fetchContributorInfo.mockResolvedValue(baseInfo({ repoMerged: 4, prTotal: 0, prMerged: 0 }));
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    const text = document.querySelector<HTMLElement>(BLOCK)?.textContent ?? "";
    expect(text).toContain("4 merged PRs");
    expect(text).not.toContain("PR ·"); // history row omitted when prTotal is 0
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

  it("appends the block once, only after data arrives (no loading swap)", async () => {
    // A loading→fill swap (replaceChildren) tears out the node under the cursor
    // and dismisses GitHub's hovercard, so the block must appear in one append.
    let resolve!: (info: ContributorInfo) => void;
    fetchContributorInfo.mockReturnValue(new Promise((r) => (resolve = r)));
    injectContributorCard();
    document.body.appendChild(hovercard("octocat"));
    await flush();

    expect(document.querySelector(BLOCK)).toBeNull(); // nothing rendered while pending

    resolve(baseInfo());
    await flush();

    expect(document.querySelectorAll(BLOCK)).toHaveLength(1);
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
