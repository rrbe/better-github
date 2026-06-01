import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectCommitDiffStats } from "./commit-diff-stats";
import { fetchCommitDiffStats } from "../lib/github-api";

// Replace the content<->worker bridge with auto-mocked vi.fn()s so the feature
// runs on canned data and never touches chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";
const SHA_A = "0123456789abcdef0123456789abcdef01234567";
const SHA_B = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";

const BADGE = ".better-github-commit-diff-stats";

// New-GitHub React row: the commit link lives inside a MainContent inner
// wrapper, which is where the diff-stats badge gets appended.
function commitRow(id: string, sha: string): string {
  return `
    <div class="TimelineItem-body" id="${id}">
      <div class="MainContent-module__inner__abc">
        <a href="/owner/repo/commit/${sha}">commit message</a>
      </div>
    </div>
  `;
}

describe("injectCommitDiffStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/commits/main`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("queries the API with the collected (lowercased) SHAs", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A.toUpperCase());
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([]);

    await injectCommitDiffStats();

    expect(fetchCommitDiffStats).toHaveBeenCalledWith("owner", "repo", [SHA_A]);
  });

  it("renders a diff-stats badge into the matching row's content wrapper", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A) + commitRow("row-b", SHA_B);
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([
      { sha: SHA_A, additions: 1234, deletions: 56, changedFiles: 3 },
    ]);

    await injectCommitDiffStats();

    const badge = document.querySelector(`#row-a ${BADGE}`) as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.querySelector(".better-github-diff-stats-add")?.textContent).toBe("+1,234");
    expect(badge.querySelector(".better-github-diff-stats-del")?.textContent).toBe("−56");
    expect(badge.querySelector(".better-github-diff-stats-files")?.textContent).toBe("3 files");
    expect(badge.title).toBe("1,234 additions, 56 deletions across 3 files");
    // Badge lands inside the MainContent inner wrapper, not loose in the row.
    expect(document.querySelector(`#row-a .MainContent-module__inner__abc > ${BADGE}`)).not.toBeNull();
  });

  it("omits the files segment when changedFiles is null", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([
      { sha: SHA_A, additions: 10, deletions: 2, changedFiles: null },
    ]);

    await injectCommitDiffStats();

    const badge = document.querySelector(`#row-a ${BADGE}`) as HTMLElement;
    expect(badge).not.toBeNull();
    expect(badge.querySelector(".better-github-diff-stats-files")).toBeNull();
    expect(badge.title).toBe("10 additions, 2 deletions");
  });

  it("leaves rows whose SHA the API did not return without a badge", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A) + commitRow("row-b", SHA_B);
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([
      { sha: SHA_A, additions: 1, deletions: 1, changedFiles: 1 },
    ]);

    await injectCommitDiffStats();

    expect(document.querySelector(`#row-a ${BADGE}`)).not.toBeNull();
    expect(document.querySelector(`#row-b ${BADGE}`)).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicate badge", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([
      { sha: SHA_A, additions: 5, deletions: 5, changedFiles: 2 },
    ]);

    await injectCommitDiffStats();
    await injectCommitDiffStats();

    expect(document.querySelectorAll(`#row-a ${BADGE}`)).toHaveLength(1);
  });

  it("clears reserved commit-diff skeletons even when no stats come back", async () => {
    document.body.innerHTML = `
      <div class="TimelineItem-body" id="row-a">
        <div class="MainContent-module__inner__abc">
          <a href="/owner/repo/commit/${SHA_A}">commit</a>
          <span class="bg-skeleton-pill bg-skeleton-pill--commit-diff" aria-hidden="true"></span>
        </div>
      </div>
    `;
    vi.mocked(fetchCommitDiffStats).mockResolvedValue([]);

    await injectCommitDiffStats();

    expect(document.querySelector(".bg-skeleton-pill--commit-diff")).toBeNull();
  });

  it("does nothing off a commits-list page and skips the fetch", async () => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = commitRow("row-a", SHA_A);

    await injectCommitDiffStats();

    expect(document.querySelectorAll(BADGE)).toHaveLength(0);
    expect(fetchCommitDiffStats).not.toHaveBeenCalled();
  });
});
