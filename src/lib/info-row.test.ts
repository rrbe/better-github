import { beforeEach, describe, expect, it } from "vitest";
import { getOrCreateInfoRow, INFO_ROW_CLASS, insertInfoRowItem } from "./info-row";

describe("getOrCreateInfoRow", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("appends to GitHub's React main content container", () => {
    document.body.innerHTML = `
      <li id="issue_1">
        <div class="MainContent-module__inner__abc"></div>
      </li>
    `;

    const row = document.getElementById("issue_1")!;
    const infoRow = getOrCreateInfoRow(row);

    expect(infoRow).not.toBeNull();
    expect(row.querySelector("[class*='MainContent-module__inner']")?.lastElementChild).toBe(infoRow);
  });

  it("inserts after the meta line in the classic issue row DOM", () => {
    document.body.innerHTML = `
      <li id="issue_2">
        <a id="issue_2_link">Title</a>
        <div class="meta"><relative-time datetime="2026-01-01T00:00:00Z"></relative-time></div>
      </li>
    `;

    const row = document.getElementById("issue_2")!;
    const meta = row.querySelector(".meta")!;
    const infoRow = getOrCreateInfoRow(row);

    expect(meta.nextElementSibling).toBe(infoRow);
  });

  it("falls back to inserting after the title link", () => {
    document.body.innerHTML = `
      <li id="issue_3">
        <a id="issue_3_link">Title</a>
      </li>
    `;

    const title = document.getElementById("issue_3_link")!;
    const infoRow = getOrCreateInfoRow(document.getElementById("issue_3")!);

    expect(title.nextElementSibling).toBe(infoRow);
  });

  it("returns the existing info row instead of duplicating it", () => {
    document.body.innerHTML = `
      <li id="issue_4">
        <a id="issue_4_link">Title</a>
      </li>
    `;
    const row = document.getElementById("issue_4")!;

    const first = getOrCreateInfoRow(row);
    const second = getOrCreateInfoRow(row);

    expect(second).toBe(first);
    expect(row.querySelectorAll(`.${INFO_ROW_CLASS}`)).toHaveLength(1);
  });

  it("keeps items ordered and replaces skeleton slots in place", () => {
    document.body.innerHTML = `
      <li id="issue_5">
        <a id="issue_5_link">Title</a>
      </li>
    `;
    const row = document.getElementById("issue_5")!;
    const item = (text: string) =>
      Object.assign(document.createElement("span"), { textContent: text });

    insertInfoRowItem(row, "review", item("review"));
    insertInfoRowItem(row, "diff", item("diff skeleton"));
    insertInfoRowItem(row, "conflict", item("conflict"));
    insertInfoRowItem(row, "branch", item("branch skeleton"));

    const infoRow = row.querySelector(`.${INFO_ROW_CLASS}`)!;
    expect([...infoRow.children].map((el) => el.textContent)).toEqual([
      "branch skeleton",
      "diff skeleton",
      "conflict",
      "review",
    ]);

    insertInfoRowItem(row, "labels", item("labels"));

    expect([...infoRow.children].map((el) => el.textContent)).toEqual([
      "branch skeleton",
      "diff skeleton",
      "labels",
      "conflict",
      "review",
    ]);

    insertInfoRowItem(row, "diff", item("diff"));
    insertInfoRowItem(row, "branch", item("branch"));

    expect([...infoRow.children].map((el) => el.textContent)).toEqual([
      "branch",
      "diff",
      "labels",
      "conflict",
      "review",
    ]);
  });
});
