import { isDiffPage, isPRFilesChangedPage } from "../lib/page-detect";
import { t } from "../lib/i18n";

const TREE_BTN_CLASS = "better-github-toggle-tree";
const DIFF_BTN_CLASS = "better-github-collapse-expand";

// 16x16 Octicon SVG paths
const ICON_FOLD_DOWN =
  '<path d="m8.177 14.323 2.896-2.896a.25.25 0 0 0-.177-.427H8.75V7.764a.75.75 0 1 0-1.5 0V11H5.104a.25.25 0 0 0-.177.427l2.896 2.896a.25.25 0 0 0 .354 0ZM2.25 5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 4.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75ZM8.25 5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 4.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>';
const ICON_UNFOLD =
  '<path d="m8.177.677 2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25a.75.75 0 0 1-1.5 0V4H5.104a.25.25 0 0 1-.177-.427L7.823.677a.25.25 0 0 1 .354 0ZM7.25 10.75a.75.75 0 0 1 1.5 0V12h2.146a.25.25 0 0 1 .177.427l-2.896 2.896a.25.25 0 0 1-.354 0l-2.896-2.896A.25.25 0 0 1 5.104 12H7.25v-1.25Zm-5-2a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>';

function makeIcon(pathHTML: string): string {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:inline-block;vertical-align:text-bottom">${pathHTML}</svg>`;
}

export function injectPRCollapseExpand(): void {
  if (!isDiffPage()) return;

  injectTreeToggle();
  injectDiffToggle();
}

// --- File tree folder collapse/expand (PR pages only) ---

interface TreeFolder {
  isExpanded: boolean;
  level: number;
  toggle(): void;
}

function getTreeFolders(): TreeFolder[] {
  // New experience: aria-expanded lives on the <li> itself
  const newSidebar = document.querySelector(
    '[class*="PullRequestFileTree-module__sidebar"]'
  );
  if (newSidebar) {
    return Array.from(
      newSidebar.querySelectorAll('li[role="treeitem"][aria-expanded]')
    ).map((el) => ({
      isExpanded: el.getAttribute("aria-expanded") === "true",
      level: parseInt(el.getAttribute("aria-level") || "0", 10),
      toggle: () =>
        el.querySelector<HTMLElement>('[class*="TreeViewItemContent"]')?.click(),
    }));
  }

  // Old experience: aria-expanded lives on the button inside each directory item
  return Array.from(
    document.querySelectorAll(
      'file-tree li[role="treeitem"][data-tree-entry-type="directory"]'
    )
  ).map((el) => {
    const btn = el.querySelector<HTMLButtonElement>(
      "button.ActionList-content[aria-expanded]"
    );
    return {
      isExpanded: btn?.getAttribute("aria-expanded") === "true",
      level: parseInt(el.getAttribute("aria-level") || "0", 10),
      toggle: () => btn?.click(),
    };
  });
}

function findTreeInjectionPoint(): {
  container: Element;
  reference: Element;
} | null {
  // New experience
  const newSidebar = document.querySelector(
    '[class*="PullRequestFileTree-module__sidebar"]'
  );
  if (newSidebar) {
    const scrollable = newSidebar.querySelector(
      '[class*="FileTreeScrollable"]'
    );
    if (scrollable) return { container: newSidebar, reference: scrollable };
  }

  // Old experience: sidebar > inner div > [svg, filter-input, experimental-action-list]
  const oldSidebar = document.querySelector(
    '[data-target="diff-layout.sidebarContainer"]'
  );
  if (oldSidebar) {
    const innerDiv = oldSidebar.firstElementChild;
    const actionList = innerDiv?.querySelector("experimental-action-list");
    if (innerDiv && actionList)
      return { container: innerDiv, reference: actionList };
  }

  return null;
}

function injectTreeToggle(): void {
  if (!isPRFilesChangedPage()) return;
  if (document.querySelector(`.${TREE_BTN_CLASS}`)) return;

  const injection = findTreeInjectionPoint();
  if (!injection) return;

  const btn = document.createElement("button");
  btn.className = TREE_BTN_CLASS;
  btn.type = "button";

  function areMajorityExpanded(): boolean {
    const folders = getTreeFolders();
    if (folders.length === 0) return false;
    const expanded = folders.filter((f) => f.isExpanded).length;
    return expanded > folders.length / 2;
  }

  function updateLabel(): void {
    const expanded = areMajorityExpanded();
    btn.innerHTML = expanded
      ? `${makeIcon(ICON_FOLD_DOWN)} ${t("collapseTree")}`
      : `${makeIcon(ICON_UNFOLD)} ${t("expandTree")}`;
    btn.title = expanded ? t("collapseTreeTitle") : t("expandTreeTitle");
  }

  updateLabel();

  btn.addEventListener("click", () => {
    // Release focus so Space keeps scrolling the PR instead of re-triggering the button.
    btn.blur();
    const folders = getTreeFolders();
    const shouldCollapse = areMajorityExpanded();

    // Sort by depth: collapse deepest first, expand shallowest first
    const sorted = [...folders].sort((a, b) =>
      shouldCollapse ? b.level - a.level : a.level - b.level
    );

    for (const folder of sorted) {
      if (shouldCollapse && folder.isExpanded) {
        folder.toggle();
      } else if (!shouldCollapse && !folder.isExpanded) {
        folder.toggle();
      }
    }

    setTimeout(updateLabel, 100);
  });

  injection.container.insertBefore(btn, injection.reference);
}

// --- File diff collapse/expand (all diff pages) ---

interface DiffFile {
  element: Element;
  isCollapsed: boolean;
  toggle(): void;
}

function getDiffFiles(): DiffFile[] {
  // New experience
  const newHeaders = document.querySelectorAll(
    '[class*="DiffFileHeader-module__diff-file-header"]'
  );
  if (newHeaders.length > 0) {
    return Array.from(newHeaders).map((header) => ({
      element: header,
      isCollapsed: header.className.includes("collapsed"),
      toggle: () => header.querySelector("div")?.querySelector("button")?.click(),
    }));
  }

  // Old experience
  return Array.from(document.querySelectorAll(".file-header")).map((header) => {
    const toggleBtn = header.querySelector<HTMLButtonElement>(
      ".js-details-target"
    );
    return {
      element: header,
      isCollapsed: toggleBtn?.getAttribute("aria-expanded") === "false",
      toggle: () => toggleBtn?.click(),
    };
  });
}

function findDiffInjectionPoint(): {
  container: Element;
  reference: Element | null;
} | null {
  // New experience: prepend inside the right controls area
  const prToolbar = document.querySelector(
    'section[class*="PullRequestFilesToolbar-module__toolbar"]'
  );
  if (prToolbar) {
    const rightControls = prToolbar.children[2];
    if (rightControls) return { container: rightControls, reference: rightControls.firstElementChild };
  }

  // Old experience: insert into diffbar before .pr-review-tools
  const diffBar = document.querySelector(".diffbar");
  const reviewTools = diffBar?.querySelector(".pr-review-tools");
  if (diffBar && reviewTools) return { container: diffBar, reference: reviewTools };

  // Commit/compare pages fallback
  const diffContentParent = document.getElementById("diff-content-parent");
  if (diffContentParent) {
    const stickyBar = diffContentParent.querySelector(".position-sticky");
    const rightArea = stickyBar?.children[1];
    if (rightArea) return { container: rightArea, reference: rightArea.firstElementChild };
  }

  return null;
}

// Tracks user's last-applied intent so the button label stays stable even as
// GitHub lazy-loads more files, and so newly-appearing files can be auto-folded
// to match the intent.
let diffIntent: "collapsed" | "expanded" | null = null;
let diffProcessed = new WeakSet<Element>();
let diffObserver: MutationObserver | null = null;
let diffRafId: number | null = null;

function resetDiffState(): void {
  diffIntent = null;
  diffProcessed = new WeakSet();
  if (diffRafId !== null) {
    cancelAnimationFrame(diffRafId);
    diffRafId = null;
  }
  if (diffObserver) {
    diffObserver.disconnect();
    diffObserver = null;
  }
}

function applyDiffIntentToNewFiles(): void {
  if (diffIntent === null) return;
  for (const file of getDiffFiles()) {
    if (diffProcessed.has(file.element)) continue;
    if (diffIntent === "collapsed" && !file.isCollapsed) file.toggle();
    else if (diffIntent === "expanded" && file.isCollapsed) file.toggle();
    diffProcessed.add(file.element);
  }
}

function startDiffObserver(): void {
  if (diffObserver) return;
  diffObserver = new MutationObserver(() => {
    if (diffIntent === null) return;
    if (diffRafId !== null) return;
    diffRafId = requestAnimationFrame(() => {
      diffRafId = null;
      applyDiffIntentToNewFiles();
    });
  });
  diffObserver.observe(document.body, { childList: true, subtree: true });
}

function injectDiffToggle(): void {
  if (document.querySelector(`.${DIFF_BTN_CLASS}`)) return;

  const injection = findDiffInjectionPoint();
  if (!injection) return;

  // New button means a fresh page — drop stale intent from the previous view.
  resetDiffState();

  const btn = createDiffToggleButton();
  injection.container.insertBefore(btn, injection.reference);
}

function getMajorityCollapsed(): boolean {
  const files = getDiffFiles();
  if (files.length === 0) return false;
  const collapsedCount = files.filter((f) => f.isCollapsed).length;
  return collapsedCount > files.length / 2;
}

function createDiffToggleButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = DIFF_BTN_CLASS;
  btn.type = "button";

  updateDiffButtonLabel(btn);

  btn.addEventListener("click", () => {
    // Release focus so Space keeps scrolling the PR instead of re-triggering the button.
    btn.blur();
    const currentlyCollapsed =
      diffIntent !== null ? diffIntent === "collapsed" : getMajorityCollapsed();
    diffIntent = currentlyCollapsed ? "expanded" : "collapsed";

    for (const file of getDiffFiles()) {
      if (diffIntent === "collapsed" && !file.isCollapsed) file.toggle();
      else if (diffIntent === "expanded" && file.isCollapsed) file.toggle();
      diffProcessed.add(file.element);
    }

    startDiffObserver();
    setTimeout(() => updateDiffButtonLabel(btn), 100);
  });

  return btn;
}

function updateDiffButtonLabel(btn: HTMLButtonElement): void {
  const collapsed =
    diffIntent !== null ? diffIntent === "collapsed" : getMajorityCollapsed();
  btn.innerHTML = collapsed
    ? `${makeIcon(ICON_UNFOLD)} ${t("expandAllFiles")}`
    : `${makeIcon(ICON_FOLD_DOWN)} ${t("collapseAllFiles")}`;
  btn.title = collapsed ? t("expandAllFilesTitle") : t("collapseAllFilesTitle");
}
