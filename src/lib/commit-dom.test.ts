import { beforeEach, describe, expect, it } from "vitest";
import { collectCommitRows } from "./commit-dom";

const SHA_A = "0123456789abcdef0123456789abcdef01234567";
const SHA_B = "abcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("collectCommitRows", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("collects commit rows for the current repository and normalizes SHAs", () => {
    document.body.innerHTML = `
      <ol>
        <li id="row-a"><a href="/owner/repo/commit/${SHA_A.toUpperCase()}">commit</a></li>
        <li id="row-b"><a href="/owner/repo/commit/${SHA_B}">commit</a></li>
        <li id="other-repo"><a href="/owner/other/commit/${SHA_A}">commit</a></li>
        <li id="short-sha"><a href="/owner/repo/commit/abc123">commit</a></li>
      </ol>
    `;

    const rows = collectCommitRows("owner", "repo");

    expect([...rows.keys()]).toEqual([SHA_A, SHA_B]);
    expect(rows.get(SHA_A)).toBe(document.getElementById("row-a"));
    expect(rows.get(SHA_B)).toBe(document.getElementById("row-b"));
  });

  it("keeps the first row when the same commit appears more than once", () => {
    document.body.innerHTML = `
      <ol>
        <li id="first"><a href="/owner/repo/commit/${SHA_A}">commit</a></li>
        <li id="second"><a href="/owner/repo/commit/${SHA_A}">commit</a></li>
      </ol>
    `;

    const rows = collectCommitRows("owner", "repo");

    expect(rows.size).toBe(1);
    expect(rows.get(SHA_A)).toBe(document.getElementById("first"));
  });
});
