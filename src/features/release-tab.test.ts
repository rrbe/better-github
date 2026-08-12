import { beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { fetchReleaseCount } from "../lib/github-api";
import { injectReleasesTab } from "./release-tab";

vi.mock("../lib/github-api");

const GH = "https://github.com";

describe("injectReleasesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchReleaseCount).mockResolvedValue(null);
    document.body.innerHTML = `
      <nav aria-label="Repository">
        <ul>
          <li>
            <a href="/owner/repo/pulls">
              <svg></svg>
              <span data-component="text" data-content="Pull requests">Pull requests</span>
              <span data-component="counter">
                <span aria-hidden="true" data-component="CounterLabel" class="native-counter">14</span>
                <span class="native-VisuallyHidden-label">&nbsp;(14)</span>
              </span>
            </a>
          </li>
          <li>
            <a href="/owner/repo/actions">
              <svg></svg>
              <span data-content="Actions">Actions</span>
            </a>
          </li>
        </ul>
      </nav>
    `;
  });

  it("adds one Releases tab and preserves idempotency", () => {
    setUrl(`${GH}/owner/repo`);

    injectReleasesTab();
    injectReleasesTab();

    const tabs = document.querySelectorAll(".better-github-releases-tab");
    const link = tabs[0]?.querySelector("a") as HTMLAnchorElement | null;

    expect(tabs).toHaveLength(1);
    expect(link?.pathname).toBe("/owner/repo/releases");
    expect(link?.textContent).toContain("Releases");
    expect(link?.getAttribute("aria-current")).toBeNull();
  });

  it("marks the injected tab as current on releases pages", () => {
    setUrl(`${GH}/owner/repo/releases/tag/v1.0.0`);

    injectReleasesTab();

    const link = document.querySelector<HTMLAnchorElement>(".better-github-releases-tab a")!;
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(link.classList.contains("selected")).toBe(true);
  });

  it("clones GitHub's native counter structure and updates its labels", async () => {
    setUrl(`${GH}/owner/repo`);
    vi.mocked(fetchReleaseCount).mockResolvedValue(22);

    injectReleasesTab();

    await vi.waitFor(() => {
      expect(
        document.querySelector('.better-github-releases-tab [data-component="CounterLabel"]')
          ?.textContent,
      ).toBe("22");
    });
    const link = document.querySelector<HTMLAnchorElement>(".better-github-releases-tab a")!;
    const counter = link.querySelector<HTMLElement>('[data-component="counter"]')!;
    expect(counter.querySelector('[data-component="CounterLabel"]')?.className).toBe(
      "native-counter",
    );
    expect(counter.querySelector('[class*="VisuallyHidden"]')?.textContent).toBe("\u00a0(22)");
    expect(link.lastElementChild).toBe(counter);
  });

  it("uses GitHub's counter DOM structure when no native counter is available to clone", async () => {
    setUrl(`${GH}/owner/repo`);
    document.querySelector('[data-component="counter"]')?.remove();
    vi.mocked(fetchReleaseCount).mockResolvedValue(22);

    injectReleasesTab();

    await vi.waitFor(() => {
      expect(
        document.querySelector(
          '.better-github-releases-tab [data-component="CounterLabel"]',
        )?.textContent,
      ).toBe("22");
    });
    const counter = document.querySelector<HTMLElement>(
      '.better-github-releases-tab [data-component="counter"]',
    )!;
    expect(counter.querySelector('[data-component="CounterLabel"]')?.className).toBe("Counter");
    expect(counter.querySelector(".sr-only")?.textContent).toBe("\u00a0(22)");
  });

  it("omits the counter when the count is zero or unavailable", async () => {
    setUrl(`${GH}/owner/repo`);
    vi.mocked(fetchReleaseCount).mockResolvedValueOnce(0);

    injectReleasesTab();

    await vi.waitFor(() => expect(fetchReleaseCount).toHaveBeenCalledTimes(1));
    expect(
      document.querySelector('.better-github-releases-tab [data-component="counter"]'),
    ).toBeNull();

    document.querySelector(".better-github-releases-tab")?.remove();
    vi.mocked(fetchReleaseCount).mockResolvedValueOnce(null);
    injectReleasesTab();
    await vi.waitFor(() => expect(fetchReleaseCount).toHaveBeenCalledTimes(2));
    expect(
      document.querySelector('.better-github-releases-tab [data-component="counter"]'),
    ).toBeNull();
  });

  it("strips selected/current state when cloning an active reference tab", () => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = `
      <nav aria-label="Repository">
        <ul>
          <li>
            <a href="/owner/repo/actions" aria-current="page" class="selected">
              <svg></svg>
              <span data-content="Actions" aria-current="true">Actions</span>
            </a>
          </li>
        </ul>
      </nav>
    `;

    injectReleasesTab();

    const tab = document.querySelector(".better-github-releases-tab")!;
    const link = tab.querySelector("a")!;

    // Cloned from a selected tab, but we're not on a releases page — the
    // injected tab and every descendant must be free of selected/current state.
    expect(link.getAttribute("aria-current")).toBeNull();
    expect(link.classList.contains("selected")).toBe(false);
    expect(tab.querySelectorAll("[aria-current]")).toHaveLength(0);
    expect(tab.querySelectorAll(".selected")).toHaveLength(0);
  });

  it("does not inject when GitHub already renders a Releases tab", () => {
    setUrl(`${GH}/owner/repo`);
    document.querySelector("ul")!.insertAdjacentHTML(
      "beforeend",
      `<li><a href="/owner/repo/releases">Releases</a></li>`,
    );

    injectReleasesTab();

    expect(document.querySelector(".better-github-releases-tab")).toBeNull();
    expect(fetchReleaseCount).not.toHaveBeenCalled();
  });
});
