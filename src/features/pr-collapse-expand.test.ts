import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRCollapseExpand } from "./pr-collapse-expand";

const GH = "https://github.com";

describe("injectPRCollapseExpand", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["prefixed", "current"])("toggles React files and folders with %s CSS classes", (dom) => {
    setUrl(`${GH}/owner/repo/pull/42/changes`);
    const prefix = dom === "prefixed" ? "DiffFileHeader-module__" : "";
    const sidebar =
      dom === "prefixed"
        ? 'class="PullRequestFileTree-module__sidebar__abc"'
        : 'id="pr-file-tree" class="sidebar__abc"';
    document.body.innerHTML = `
      <div ${sidebar}>
        <div class="FileTreeScrollable__abc"><ul role="tree">
          <li role="treeitem" aria-expanded="true" aria-level="1" id="parent">
            <div class="prc-TreeView-TreeViewItemContent-abc"></div>
          </li>
          <li role="treeitem" aria-expanded="true" aria-level="2" id="child">
            <div class="prc-TreeView-TreeViewItemContent-abc"></div>
          </li>
        </ul></div>
      </div>
      <section class="${dom === "prefixed" ? "PullRequestFilesToolbar-module__" : ""}toolbar__abc">
        <div></div><div></div><div id="controls"><button id="review">Review</button></div>
      </section>
      <div class="${prefix}diff-file-header__abc"><div><button id="file-a"></button></div></div>
      <div class="${prefix}diff-file-header__abc"><div><button id="file-b"></button></div></div>
    `;
    const folderOrder: string[] = [];
    document.querySelectorAll<HTMLElement>("[class*='TreeViewItemContent']").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const folder = toggle.closest("li")!;
        folderOrder.push(folder.id);
        folder.setAttribute(
          "aria-expanded",
          String(folder.getAttribute("aria-expanded") !== "true"),
        );
      });
    });
    document.querySelectorAll<HTMLButtonElement>("[id^='file-']").forEach((toggle) => {
      toggle.addEventListener("click", () =>
        toggle
          .closest("[class*='diff-file-header']")!
          .classList.toggle(`${prefix}diff-file-header-collapsed__abc`),
      );
    });

    vi.useFakeTimers();
    injectPRCollapseExpand();
    injectPRCollapseExpand();
    const treeToggle = document.querySelector<HTMLButtonElement>(".better-github-toggle-tree")!;
    const diffToggle = document.querySelector<HTMLButtonElement>(".better-github-collapse-expand")!;
    expect(treeToggle.nextElementSibling?.className).toContain("FileTreeScrollable");
    expect(diffToggle.nextElementSibling?.id).toBe("review");
    expect(document.querySelectorAll(".better-github-toggle-tree")).toHaveLength(1);
    expect(document.querySelectorAll(".better-github-collapse-expand")).toHaveLength(1);

    treeToggle.click();
    diffToggle.click();
    vi.advanceTimersByTime(100);
    expect(folderOrder).toEqual(["child", "parent"]);
    expect(
      [...document.querySelectorAll("[aria-expanded]")].map((e) => e.getAttribute("aria-expanded")),
    ).toEqual(["false", "false"]);
    expect(document.querySelectorAll("[class*='diff-file-header-collapsed']")).toHaveLength(2);

    treeToggle.click();
    diffToggle.click();
    vi.advanceTimersByTime(100);
    expect(folderOrder.slice(2)).toEqual(["parent", "child"]);
    expect(document.querySelectorAll("[class*='diff-file-header-collapsed']")).toHaveLength(0);
  });

  it("expands child folders that React mounts after their parent opens", () => {
    setUrl(`${GH}/owner/repo/pull/42/changes`);
    document.body.innerHTML = `
      <div id="pr-file-tree"><div class="FileTreeScrollable__abc"></div></div>
    `;
    const expanded = new Set<string>();
    const order: string[] = [];
    const names = ["parent", "child", "grandchild"];
    const scrollable = document.querySelector("[class*='FileTreeScrollable']")!;
    function folder(level: number): string {
      const name = names[level];
      const children =
        expanded.has(name) && level + 1 < names.length
          ? `<ul role="group">${folder(level + 1)}</ul>`
          : "";
      return `<li role="treeitem" id="${name}" aria-level="${level + 1}" aria-expanded="${expanded.has(name)}">
        <div class="prc-TreeView-TreeViewItemContent-abc"></div>${children}
      </li>`;
    }
    function renderTree(): void {
      scrollable.innerHTML = `<ul role="tree">${folder(0)}</ul>`;
      scrollable
        .querySelectorAll<HTMLElement>("[class*='TreeViewItemContent']")
        .forEach((toggle) => {
          toggle.addEventListener("click", () => {
            const name = toggle.closest("li")!.id;
            order.push(name);
            if (expanded.has(name)) expanded.delete(name);
            else expanded.add(name);
            renderTree();
          });
        });
    }
    renderTree();
    vi.useFakeTimers();
    injectPRCollapseExpand();
    const toggle = document.querySelector<HTMLButtonElement>(".better-github-toggle-tree")!;

    toggle.click();
    vi.advanceTimersByTime(100);
    expect(order).toEqual(names);
    expect([...expanded]).toEqual(names);
    expect(scrollable.querySelectorAll('[aria-expanded="true"]')).toHaveLength(3);

    toggle.click();
    vi.advanceTimersByTime(100);
    expect(order.slice(3)).toEqual(["grandchild", "child", "parent"]);
    expect(expanded.size).toBe(0);
    expect(scrollable.querySelectorAll("[role='treeitem']")).toHaveLength(1);

    toggle.click();
    vi.advanceTimersByTime(100);
    expect([...expanded]).toEqual(names);
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
