import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { fetchReleaseDownloads } from "../lib/github-api";
import {
  cleanupReleaseAssetDownloads,
  getDownloadHeat,
  injectReleaseAssetDownloads,
  parseAssetHref,
} from "./release-asset-downloads";

vi.mock("../lib/github-api");

const BADGE = ".better-github-asset-downloads";

function assetRow(tag: string, name: string): string {
  return `
    <li class="Box-row d-flex flex-column flex-md-row">
      <div class="d-flex flex-justify-start flex-items-center col-12 col-lg-6">
        <a href="/owner/repo/releases/download/${tag}/${name}" class="Truncate">
          <span class="Truncate-text text-bold">${name}</span>
        </a>
      </div>
      <div><span class="size">1.9 KB</span></div>
    </li>
  `;
}

describe("release asset downloads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl("https://github.com/owner/repo/releases");
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanupReleaseAssetDownloads();
    vi.restoreAllMocks();
  });

  it("parses encoded asset URLs and rejects non-assets", () => {
    expect(
      parseAssetHref(
        "/owner/repo/releases/download/release%2F1.0/my%20app.zip?x=1",
        "owner",
        "repo",
      ),
    ).toEqual({ tag: "release/1.0", name: "my app.zip" });
    expect(parseAssetHref("/owner/repo/archive/v1.zip", "owner", "repo")).toBeNull();
  });

  it("maps download volume onto a monotonic 1..10 heat scale", () => {
    expect(getDownloadHeat(0)).toBe(1);
    expect(getDownloadHeat(100)).toBe(2);
    expect(getDownloadHeat(1_000)).toBe(4);
    expect(getDownloadHeat(1_000_000)).toBe(10);
  });

  it("shows a zero count in the asset-name column", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v1.0.0", name: "app.zip", downloadCount: 0 },
    ]);

    await injectReleaseAssetDownloads();

    const badge = document.querySelector<HTMLAnchorElement>(BADGE)!;
    expect(badge.textContent).toBe("0");
    expect(badge.title).toBe("Downloaded 0 times");
    expect(badge.getAttribute("href")).toBe("/owner/repo/releases/download/v1.0.0/app.zip");
    expect(badge.parentElement?.lastElementChild).toBe(badge);
  });

  it("groups visible assets by release tag", async () => {
    document.body.innerHTML = `<ul>${assetRow("v2.0.0", "a.zip")}${assetRow("v2.0.0", "b.zip")}${assetRow("v1.0.0", "c.zip")}</ul>`;
    vi.mocked(fetchReleaseDownloads).mockImplementation((_owner, _repo, tag) =>
      Promise.resolve(
        tag === "v2.0.0"
          ? [
              { tag, name: "a.zip", downloadCount: 11 },
              { tag, name: "b.zip", downloadCount: 22 },
            ]
          : [{ tag, name: "c.zip", downloadCount: 33 }],
      ),
    );

    await injectReleaseAssetDownloads();

    expect(fetchReleaseDownloads).toHaveBeenCalledTimes(2);
    expect(Array.from(document.querySelectorAll(BADGE), (badge) => badge.textContent)).toEqual([
      "11",
      "22",
      "33",
    ]);
  });

  it("processes assets that GitHub renders later", async () => {
    document.body.innerHTML = `<ul id="list"></ul>`;
    vi.mocked(fetchReleaseDownloads).mockResolvedValue([
      { tag: "v3.0.0", name: "late.zip", downloadCount: 42 },
    ]);

    await injectReleaseAssetDownloads();
    document.getElementById("list")!.innerHTML = assetRow("v3.0.0", "late.zip");

    await vi.waitFor(() => expect(document.querySelector(BADGE)?.textContent).toBe("42"));
    expect(fetchReleaseDownloads).toHaveBeenCalledWith("owner", "repo", "v3.0.0");
  });

  it("does not inject after the feature is disabled during a fetch", async () => {
    document.body.innerHTML = `<ul>${assetRow("v1.0.0", "app.zip")}</ul>`;
    let resolveDownloads!: (downloads: Awaited<ReturnType<typeof fetchReleaseDownloads>>) => void;
    vi.mocked(fetchReleaseDownloads).mockReturnValue(
      new Promise((resolve) => {
        resolveDownloads = resolve;
      }),
    );

    const injection = injectReleaseAssetDownloads();
    cleanupReleaseAssetDownloads();
    resolveDownloads([{ tag: "v1.0.0", name: "app.zip", downloadCount: 7 }]);
    await injection;

    expect(document.querySelector(BADGE)).toBeNull();
  });
});
