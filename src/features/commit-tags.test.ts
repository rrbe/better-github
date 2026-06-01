import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectCommitTags } from "./commit-tags";
import { fetchRepoTags } from "../lib/github-api";

// Replace the content<->worker bridge with auto-mocked vi.fn()s so the feature
// runs on canned data and never touches chrome.runtime.
vi.mock("../lib/github-api");

const GH = "https://github.com";
const SHA_A = "0123456789abcdef0123456789abcdef01234567";
const SHA_B = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";

const TAG_BADGE = ".better-github-commit-tag";
const TAG_ROW = ".better-github-commit-tag-row";

// New-GitHub React row: a heading title + a MainContent inner wrapper holding
// the commit link. The heading is where commit-tags inserts inline tag rows.
function commitRow(id: string, sha: string): string {
  return `
    <div class="TimelineItem-body" id="${id}">
      <div class="MainContent-module__inner__abc">
        <h4 class="commit-title"><a href="/owner/repo/commit/${sha}">commit message</a></h4>
      </div>
    </div>
  `;
}

describe("injectCommitTags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/commits/main`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("injects a tag badge into the row whose SHA the API returned", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A) + commitRow("row-b", SHA_B);
    vi.mocked(fetchRepoTags).mockResolvedValue([{ name: "v1.0.0", commitSha: SHA_A }]);

    await injectCommitTags();

    const badge = document.querySelector(`#row-a ${TAG_BADGE}`) as HTMLAnchorElement;
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("v1.0.0");
    expect(badge.getAttribute("href")).toBe("/owner/repo/releases/tag/v1.0.0");
    expect(badge.title).toBe("Tag: v1.0.0");

    // The tag row is mounted inside the heading (inline placement).
    expect(document.querySelector(`#row-a h4 ${TAG_ROW}`)).not.toBeNull();
  });

  it("leaves untagged rows untouched and matches SHAs case-insensitively", async () => {
    // Row A's SHA is uppercase in the DOM; the API returns the canonical
    // lowercase form. collectCommitRows lowercases, so they must still match.
    document.body.innerHTML =
      commitRow("row-a", SHA_A.toUpperCase()) + commitRow("row-b", SHA_B);
    vi.mocked(fetchRepoTags).mockResolvedValue([{ name: "v2.3.4", commitSha: SHA_A }]);

    await injectCommitTags();

    expect(document.querySelector(`#row-a ${TAG_BADGE}`)?.textContent).toBe("v2.3.4");
    expect(document.querySelector(`#row-b ${TAG_BADGE}`)).toBeNull();
  });

  it("renders every tag pointing at the same commit", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchRepoTags).mockResolvedValue([
      { name: "v1.0.0", commitSha: SHA_A },
      { name: "latest", commitSha: SHA_A },
    ]);

    await injectCommitTags();

    const badges = document.querySelectorAll(`#row-a ${TAG_BADGE}`);
    expect([...badges].map((b) => b.textContent)).toEqual(["v1.0.0", "latest"]);
    // Both badges share a single tag row.
    expect(document.querySelectorAll(`#row-a ${TAG_ROW}`)).toHaveLength(1);
  });

  it("escapes tag names so they cannot inject markup", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchRepoTags).mockResolvedValue([
      { name: "<img src=x onerror=alert(1)>", commitSha: SHA_A },
    ]);

    await injectCommitTags();

    const span = document.querySelector(`#row-a ${TAG_BADGE} span`) as HTMLElement;
    expect(span.textContent).toBe("<img src=x onerror=alert(1)>");
    // No real <img> element leaked into the DOM.
    expect(document.querySelector(`#row-a ${TAG_BADGE} img`)).toBeNull();
  });

  it("is idempotent — a second pass adds no duplicate badge", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchRepoTags).mockResolvedValue([{ name: "v1.0.0", commitSha: SHA_A }]);

    await injectCommitTags();
    await injectCommitTags();

    expect(document.querySelectorAll(`#row-a ${TAG_BADGE}`)).toHaveLength(1);
  });

  it("does nothing off a commits-list page and skips the fetch", async () => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = commitRow("row-a", SHA_A);

    await injectCommitTags();

    expect(document.querySelectorAll(TAG_BADGE)).toHaveLength(0);
    expect(fetchRepoTags).not.toHaveBeenCalled();
  });

  it("renders nothing when the API returns no tags", async () => {
    document.body.innerHTML = commitRow("row-a", SHA_A);
    vi.mocked(fetchRepoTags).mockResolvedValue([]);

    await injectCommitTags();

    expect(document.querySelectorAll(TAG_BADGE)).toHaveLength(0);
  });
});
