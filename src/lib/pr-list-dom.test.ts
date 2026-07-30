import { beforeEach, describe, expect, it } from "vitest";
import { collectPRRows, getPRNumber } from "./pr-list-dom";

describe("PR list DOM helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="issue_7"><a id="issue_7_link">Title 7</a></div>
      <div id="issue_8"></div>
      <div id="issue_invalid"></div>
    `;
  });

  it("collects each PR row once and ignores title links", () => {
    const rows = collectPRRows();

    expect([...rows.keys()]).toEqual([7, 8]);
    expect(rows.get(7)).toBe(document.getElementById("issue_7"));
    expect(getPRNumber(document.getElementById("issue_7_link")!)).toBeNull();
  });
});
