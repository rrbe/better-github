import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectReleasesTab } from "./release-tab";

const GH = "https://github.com";

describe("injectReleasesTab", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <nav aria-label="Repository">
        <ul>
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

  it("does not inject when GitHub already renders a Releases tab", () => {
    setUrl(`${GH}/owner/repo`);
    document.querySelector("ul")!.insertAdjacentHTML(
      "beforeend",
      `<li><a href="/owner/repo/releases">Releases</a></li>`,
    );

    injectReleasesTab();

    expect(document.querySelector(".better-github-releases-tab")).toBeNull();
  });
});
