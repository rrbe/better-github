import { isDiffPage, isPRFilesChangedPage } from "../lib/page-detect";

const TREE_BTN_CLASS = "better-github-toggle-tree";
const DIFF_BTN_CLASS = "better-github-collapse-expand";

// 16x16 Octicon SVG paths
const ICON_FOLD_DOWN =
  '<path d="m8.177 14.323 2.896-2.896a.25.25 0 0 0-.177-.427H8.75V7.764a.75.75 0 1 0-1.5 0V11H5.104a.25.25 0 0 0-.177.427l2.896 2.896a.25.25 0 0 0 .354 0ZM2.25 5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 4.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75ZM8.25 5a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 4.25a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5a.75.75 0 0 1 .75.75Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>';
const ICON_UNFOLD =
  '<path d="m8.177.677 2.896 2.896a.25.25 0 0 1-.177.427H8.75v1.25a.75.75 0 0 1-1.5 0V4H5.104a.25.25 0 0 1-.177-.427L7.823.677a.25.25 0 0 1 .354 0ZM7.25 10.75a.75.75 0 0 1 1.5 0V12h2.146a.25.25 0 0 1 .177.427l-2.896 2.896a.25.25 0 0 1-.354 0l-2.896-2.896A.25.25 0 0 1 5.104 12H7.25v-1.25Zm-5-2a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM6 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 6 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5ZM12 8a.75.75 0 0 1-.75.75h-.5a.75.75 0 0 1 0-1.5h.5A.75.75 0 0 1 12 8Zm2.25.75a.75.75 0 0 0 0-1.5h-.5a.75.75 0 0 0 0 1.5h.5Z"></path>';
const ICON_CHEVRON_DOWN =
  '<path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.94l3.72-3.72a.749.749 0 0 1 1.06 0Z"></path>';
const ICON_CHEVRON_RIGHT =
  '<path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"></path>';

function makeIcon(pathHTML: string): string {
  return `<svg aria-hidden="true" focusable="false" viewBox="0 0 16 16" width="16" height="16" fill="currentColor" style="display:inline-block;vertical-align:text-bottom">${pathHTML}</svg>`;
}

export function injectPRCollapseExpand(): void {
  if (!isDiffPage()) return;

  injectTreeToggle();
  injectDiffToggle();
}

// --- File tree folder collapse/expand (PR pages only, inside file tree sidebar) ---

function injectTreeToggle(): void {
  if (!isPRFilesChangedPage()) return;
  if (document.querySelector(`.${TREE_BTN_CLASS}`)) return;

  const sidebar = document.querySelector(
    '[class*="PullRequestFileTree-module__sidebar"]'
  );
  if (!sidebar) return;

  const scrollable = sidebar.querySelector('[class*="FileTreeScrollable"]');
  if (!scrollable) return;

  const btn = document.createElement("button");
  btn.className = TREE_BTN_CLASS;
  btn.type = "button";

  function getFolders(): Element[] {
    return Array.from(
      sidebar!.querySelectorAll('li[role="treeitem"][aria-expanded]')
    );
  }

  function areMajorityExpanded(): boolean {
    const folders = getFolders();
    if (folders.length === 0) return false;
    const expanded = folders.filter(
      (f) => f.getAttribute("aria-expanded") === "true"
    ).length;
    return expanded > folders.length / 2;
  }

  function updateLabel(): void {
    const expanded = areMajorityExpanded();
    btn.innerHTML = expanded
      ? `${makeIcon(ICON_FOLD_DOWN)} Collapse tree`
      : `${makeIcon(ICON_UNFOLD)} Expand tree`;
    btn.title = expanded
      ? "Collapse all folders in file tree"
      : "Expand all folders in file tree";
  }

  updateLabel();

  btn.addEventListener("click", () => {
    const folders = getFolders();
    const shouldCollapse = areMajorityExpanded();

    for (const folder of folders) {
      const isExpanded = folder.getAttribute("aria-expanded") === "true";
      if (shouldCollapse && isExpanded) {
        folder
          .querySelector<HTMLElement>('[class*="TreeViewItemContent"]')
          ?.click();
      } else if (!shouldCollapse && !isExpanded) {
        folder
          .querySelector<HTMLElement>('[class*="TreeViewItemContent"]')
          ?.click();
      }
    }

    setTimeout(updateLabel, 100);
  });

  sidebar.insertBefore(btn, scrollable);
}

// --- File diff collapse/expand (all diff pages, in the right controls) ---

function injectDiffToggle(): void {
  if (document.querySelector(`.${DIFF_BTN_CLASS}`)) return;

  const container = findDiffControlsArea();
  if (!container) return;

  const btn = createDiffToggleButton();
  container.prepend(btn);
}

function findDiffControlsArea(): Element | null {
  const prToolbar = document.querySelector(
    'section[class*="PullRequestFilesToolbar-module__toolbar"]'
  );
  if (prToolbar) {
    const rightControls = prToolbar.children[2];
    return rightControls ?? null;
  }

  const diffContentParent = document.getElementById("diff-content-parent");
  if (diffContentParent) {
    const stickyBar = diffContentParent.querySelector(".position-sticky");
    if (stickyBar) {
      return stickyBar.children[1] ?? null;
    }
  }

  return null;
}

function getAllFileHeaders(): Element[] {
  return Array.from(
    document.querySelectorAll(
      '[class*="DiffFileHeader-module__diff-file-header"]'
    )
  );
}

function isFileCollapsed(header: Element): boolean {
  return header.className.includes("collapsed");
}

function getChevronButton(header: Element): HTMLElement | null {
  const firstDiv = header.querySelector("div");
  return firstDiv?.querySelector("button") ?? null;
}

function getMajorityCollapsed(): boolean {
  const headers = getAllFileHeaders();
  if (headers.length === 0) return false;
  const collapsedCount = headers.filter(isFileCollapsed).length;
  return collapsedCount > headers.length / 2;
}

function createDiffToggleButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = DIFF_BTN_CLASS;
  btn.type = "button";

  updateDiffButtonLabel(btn);

  btn.addEventListener("click", () => {
    const headers = getAllFileHeaders();
    const shouldExpand = getMajorityCollapsed();

    for (const header of headers) {
      const collapsed = isFileCollapsed(header);
      if (shouldExpand && collapsed) {
        getChevronButton(header)?.click();
      } else if (!shouldExpand && !collapsed) {
        getChevronButton(header)?.click();
      }
    }

    setTimeout(() => updateDiffButtonLabel(btn), 100);
  });

  return btn;
}

function updateDiffButtonLabel(btn: HTMLButtonElement): void {
  const shouldExpand = getMajorityCollapsed();
  btn.innerHTML = shouldExpand
    ? `${makeIcon(ICON_UNFOLD)} Expand all files`
    : `${makeIcon(ICON_FOLD_DOWN)} Collapse all files`;
  btn.title = shouldExpand
    ? "Expand all file diffs"
    : "Collapse all file diffs";
}
