import { isDiffPage, isPRFilesChangedPage } from "../lib/page-detect";

const TREE_BTN_CLASS = "better-github-toggle-tree";
const DIFF_BTN_CLASS = "better-github-collapse-expand";

export function injectPRCollapseExpand(): void {
  if (!isDiffPage()) return;

  injectTreeToggle();
  injectDiffToggle();
}

// --- File tree show/hide button (PR pages only, near the tree icon toggle) ---

function injectTreeToggle(): void {
  if (!isPRFilesChangedPage()) return;
  if (document.querySelector(`.${TREE_BTN_CLASS}`)) return;

  const nativeToggle = document.querySelector<HTMLElement>(
    '[class*="RegularTreeToggle"]'
  );
  if (!nativeToggle) return;

  const btn = document.createElement("button");
  btn.className = TREE_BTN_CLASS;
  btn.type = "button";

  function updateLabel(): void {
    const expanded = nativeToggle!.getAttribute("aria-expanded") === "true";
    btn.textContent = expanded ? "Hide tree" : "Show tree";
    btn.title = expanded ? "Hide file tree" : "Show file tree";
  }

  updateLabel();

  btn.addEventListener("click", () => {
    nativeToggle!.click();
    setTimeout(updateLabel, 100);
  });

  // Keep label in sync if the user clicks GitHub's own icon toggle
  const observer = new MutationObserver(updateLabel);
  observer.observe(nativeToggle!, { attributes: true, attributeFilter: ["aria-expanded"] });

  // Insert after the file tree toggle area (parent of nativeToggle)
  const fileTreeArea = nativeToggle.closest(
    '[class*="PullRequestFilesToolbar-module__toolbar"] > * > *'
  ) ?? nativeToggle.parentElement;
  if (fileTreeArea?.parentElement) {
    fileTreeArea.parentElement.insertBefore(btn, fileTreeArea.nextElementSibling);
  }
}

// --- File diff collapse/expand button (all diff pages, in the right controls) ---

function injectDiffToggle(): void {
  if (document.querySelector(`.${DIFF_BTN_CLASS}`)) return;

  const container = findDiffControlsArea();
  if (!container) return;

  const btn = createDiffToggleButton();
  container.prepend(btn);
}

function findDiffControlsArea(): Element | null {
  // PR Files Changed: right controls area of the sticky toolbar
  const prToolbar = document.querySelector(
    'section[class*="PullRequestFilesToolbar-module__toolbar"]'
  );
  if (prToolbar) {
    const rightControls = prToolbar.children[2];
    return rightControls ?? null;
  }

  // Commit / Compare: right side of the sticky bar
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
  btn.textContent = shouldExpand ? "Expand all" : "Collapse all";
  btn.title = shouldExpand
    ? "Expand all file diffs"
    : "Collapse all file diffs";
}
