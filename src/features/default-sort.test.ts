import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { applyDefaultSort } from "./default-sort";

const GH = "https://github.com";

describe("applyDefaultSort", () => {
  beforeEach(() => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = "";
  });

  it("adds updated sort to PR and issue list links", () => {
    document.body.innerHTML = `
      <a id="pulls" href="/owner/repo/pulls">Pull requests</a>
      <a id="issues" href="https://github.com/owner/repo/issues?q=is%3Aissue+is%3Aopen">Issues</a>
      <a id="sorted" href="/owner/repo/pulls?q=is%3Apr+sort%3Acreated-desc">Sorted</a>
      <a id="external" href="https://example.com/owner/repo/pulls">External</a>
    `;

    applyDefaultSort();

    expect(document.getElementById("pulls")?.getAttribute("href")).toBe(
      "/owner/repo/pulls?q=is%3Apr+is%3Aopen+sort%3Aupdated-desc+",
    );
    expect((document.getElementById("issues") as HTMLAnchorElement).href).toBe(
      "https://github.com/owner/repo/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+",
    );
    expect(document.getElementById("sorted")?.getAttribute("href")).toBe(
      "/owner/repo/pulls?q=is%3Apr+sort%3Acreated-desc",
    );
    expect((document.getElementById("external") as HTMLAnchorElement).href).toBe(
      "https://example.com/owner/repo/pulls",
    );
  });

  it("adds a trailing space to focused query inputs ending in sort", () => {
    setUrl(`${GH}/owner/repo/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc`);
    document.body.innerHTML = `<input name="q" value="is:issue is:open sort:updated-desc" />`;

    applyDefaultSort();
    const input = document.querySelector("input")!;
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(input.value).toBe("is:issue is:open sort:updated-desc ");
    expect(input.selectionStart).toBe(input.value.length);
  });
});
