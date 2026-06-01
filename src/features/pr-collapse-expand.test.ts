import { beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRCollapseExpand } from "./pr-collapse-expand";

const GH = "https://github.com";

describe("injectPRCollapseExpand", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("injects one diff toggle and toggles classic diff files", () => {
    setUrl(`${GH}/owner/repo/commit/abc123`);
    document.body.innerHTML = `
      <div class="diffbar"><div class="pr-review-tools"></div></div>
      <div class="file-header"><button class="js-details-target" aria-expanded="true"></button></div>
      <div class="file-header"><button class="js-details-target" aria-expanded="true"></button></div>
    `;
    document.querySelectorAll<HTMLButtonElement>(".js-details-target").forEach((button) => {
      button.addEventListener("click", () => {
        const expanded = button.getAttribute("aria-expanded") !== "false";
        button.setAttribute("aria-expanded", expanded ? "false" : "true");
      });
    });

    injectPRCollapseExpand();
    injectPRCollapseExpand();

    const toggle = document.querySelector<HTMLButtonElement>(".better-github-collapse-expand")!;
    expect(document.querySelectorAll(".better-github-collapse-expand")).toHaveLength(1);

    toggle.click();

    expect([...document.querySelectorAll(".js-details-target")].map((button) =>
      button.getAttribute("aria-expanded")
    )).toEqual(["false", "false"]);
  });

  it("injects one tree toggle on PR files pages and toggles deepest folders first", () => {
    setUrl(`${GH}/owner/repo/pull/42/files`);
    document.body.innerHTML = `
      <div data-target="diff-layout.sidebarContainer">
        <div>
          <svg></svg>
          <experimental-action-list></experimental-action-list>
          <file-tree>
            <li role="treeitem" data-tree-entry-type="directory" aria-level="1">
              <button class="ActionList-content" aria-expanded="true" id="parent"></button>
            </li>
            <li role="treeitem" data-tree-entry-type="directory" aria-level="2">
              <button class="ActionList-content" aria-expanded="true" id="child"></button>
            </li>
          </file-tree>
        </div>
      </div>
      <div class="diffbar"><div class="pr-review-tools"></div></div>
    `;
    const order: string[] = [];
    for (const button of document.querySelectorAll<HTMLButtonElement>(".ActionList-content")) {
      button.addEventListener("click", () => {
        order.push(button.id);
        button.setAttribute("aria-expanded", "false");
      });
    }

    vi.useFakeTimers();
    injectPRCollapseExpand();
    injectPRCollapseExpand();

    document.querySelector<HTMLButtonElement>(".better-github-toggle-tree")!.click();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();

    expect(document.querySelectorAll(".better-github-toggle-tree")).toHaveLength(1);
    expect(order).toEqual(["child", "parent"]);
  });
});
