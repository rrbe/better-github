import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import {
  injectReleaseAssetDownloads,
  parseAssetHref,
  getDownloadHeat,
} from "./release-asset-downloads";
import { fetchReleaseDownloads } from "../lib/github-api";

// Run the feature on canned data instead of the content<->worker bridge.
vi.mock("../lib/github-api");

const GH = "https://github.com";
const BADGE = ".better-github-asset-downloads";

// A release asset row mirroring GitHub's Box-row layout: a download link on the
// left, and a metadata column on the right holding size + date spans.
function assetRow(tag: string, name: string, size = "1.9 KB"): string {
  return `
    <li class="Box-row d-flex flex-column flex-md-row">
      <div class="d-flex flex-justify-start flex-items-center col-12 col-lg-6">
        <a href="/owner/repo/releases/download/${tag}/${name}" class="Truncate">
          <span class="Truncate-text text-bold">${name}</span>
        </a>
      </div>
      <div class="d-flex flex-auto flex-justify-end flex-items-center">
        <span class="size color-fg-muted text-right flex-shrink-0 flex-grow-0 ml-2">${size}</span>
        <span class="date color-fg-muted text-right flex-shrink-0 flex-grow-0 ml-2"><relative-time>x</relative-time></span>
      </div>
    </li>
  `;
}

describe("parseAssetHref", () => {
  it("extracts tag and name from a download URL", () => {
    expect(parseAssetHref("/owner/repo/releases/download/v1.0.0/app.zip", "owner", "repo")).toEqual(
      {
        tag: "v1.0.0",
        name: "app.zip",
      },
    );
  });

  it("decodes encoded names and slashed tags", () => {
    expect(
      parseAssetHref("/owner/repo/releases/download/release%2F1.0/my%20app.zip", "owner", "repo"),
    ).toEqual({ tag: "release/1.0", name: "my app.zip" });
  });

  it("ignores query strings and falls back to the marker when the repo prefix differs", () => {
    expect(parseAssetHref("/o/r/releases/download/v2/file.tar.gz?x=1", "owner", "repo")).toEqual({
      tag: "v2",
      name: "file.tar.gz",
    });
  });

  it("returns null for non-asset hrefs", () => {
    expect(parseAssetHref(null, "owner", "repo")).toBeNull();
    expect(parseAssetHref("/owner/repo/archive/refs/tags/v1.zip", "owner", "repo")).toBeNull();
  });
});

describe("getDownloadHeat", () => {
  it("maps download volume onto a 1..10 heat scale", () => {
    expect(getDownloadHeat(0)).toBe(1);
    expect(getDownloadHeat(99)).toBe(1);
    expect(getDownloadHeat(100)).toBe(2);
    expect(getDownloadHeat(999)).toBe(3);
    expect(getDownloadHeat(1000)).toBe(4);
    expect(getDownloadHeat(1_000_000)).toBe(10);
    expect(getDownloadHeat(50_000_000)).toBe(10);
  });

  it("is monotonic in the download count", () => {
    let prev = 0;
    for (const count of [0, 50, 200, 800, 2000, 8000, 20000, 80000, 200000, 800000, 5_000_000]) {
      const heat = getDownloadHeat(count);
      expect(heat).toBeGreaterThanOrEqual(prev);
      prev = heat;
    }
  });
});

describe("injectReleaseAssetDownloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl(`${GH}/owner/repo/releases`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("appends the count to the asset-name column, right-aligned, with formatted count", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v1.0.0", name: "app.zip", downloadCount: 1234 },
    ]);

    await injectReleaseAssetDownloads();

    const badge = document.querySelector(BADGE) as HTMLAnchorElement;
    expect(badge).not.toBeNull();
    expect(badge.tagName).toBe("A");
    expect(badge.textContent).toBe((1234).toLocaleString());
    expect(badge.title).toBe(`Downloaded ${(1234).toLocaleString()} times`);
    // It links to the asset's own download URL, so the icon is clickable.
    expect(badge.getAttribute("href")).toBe("/owner/repo/releases/download/v1.0.0/app.zip");
    // Lives in the name column (the column holding the download link), pushed to
    // its end — decoupled from the digest / size / date columns.
    const nameLink = badge.parentElement?.querySelector(".Truncate") as HTMLElement;
    expect(nameLink).not.toBeNull();
    expect(badge.parentElement?.lastElementChild).toBe(badge);
    // Carries the heat level so CSS can tint it by download volume.
    expect(badge.dataset.betterGithubDlHeat).toBe(String(getDownloadHeat(1234)));
  });

  it("leaves assets without a matching count untouched", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}${assetRow("v1.0.0", "other.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v1.0.0", name: "app.zip", downloadCount: 5 },
    ]);

    await injectReleaseAssetDownloads();

    expect(document.querySelectorAll(BADGE)).toHaveLength(1);
  });

  it("does not match across tags with the same file name", async () => {
    document.body.innerHTML = `<ul>${assetRow("v2.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v1.0.0", name: "app.zip", downloadCount: 99 },
    ]);

    await injectReleaseAssetDownloads();

    expect(document.querySelector(BADGE)).toBeNull();
  });

  it("is idempotent across repeated runs", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v1.0.0", name: "app.zip", downloadCount: 7 },
    ]);

    await injectReleaseAssetDownloads();
    await injectReleaseAssetDownloads();

    expect(document.querySelectorAll(BADGE)).toHaveLength(1);
  });

  it("fetches a single release by tag on a release detail page", async () => {
    setUrl(`${GH}/owner/repo/releases/tag/v1.0.0`);
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([]);

    await injectReleaseAssetDownloads();

    expect(fetchReleaseDownloads).toHaveBeenCalledWith("owner", "repo", "v1.0.0");
  });

  it("fetches the release list (no tag) on the releases index", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([]);

    await injectReleaseAssetDownloads();

    expect(fetchReleaseDownloads).toHaveBeenCalledWith("owner", "repo", undefined);
  });

  it("does nothing when there are no asset links", async () => {
    document.body.innerHTML = `<ul><li>no assets</li></ul>`;

    await injectReleaseAssetDownloads();

    expect(fetchReleaseDownloads).not.toHaveBeenCalled();
    expect(document.querySelector(BADGE)).toBeNull();
  });
});
