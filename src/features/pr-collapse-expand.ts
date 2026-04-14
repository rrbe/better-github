import { isDiffPage } from "../lib/page-detect";

const BTN_CLASS = "better-github-collapse-expand";

export function injectPRCollapseExpand(): void {
  if (!isDiffPage()) return;
  if (document.querySelector(`.${BTN_CLASS}`)) return;

  const toolbar = findToolbar();
  if (!toolbar) return;

  const btn = createToggleButton();
  toolbar.prepend(btn);
}

function findToolbar(): Element | null {
  // PR Files Changed: right side of the sticky toolbar
  const prToolbar = document.querySelector(
    'section[class*="PullRequestFilesToolbar-module__toolbar"]'
  );
  if (prToolbar) {
    // 3rd child is the right controls area
    const rightControls = prToolbar.children[2];
    return rightControls ?? null;
  }

  // Commit / Compare: sticky bar inside #diff-content-parent
  const diffContentParent = document.getElementById("diff-content-parent");
  if (diffContentParent) {
    const stickyBar = diffContentParent.querySelector(".position-sticky");
    if (stickyBar) {
      // 2nd child is the right controls area
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
  // Chevron is the first button inside the first div child of the header
  const firstDiv = header.querySelector("div");
  return firstDiv?.querySelector("button") ?? null;
}

function getMajorityCollapsed(): boolean {
  const headers = getAllFileHeaders();
  if (headers.length === 0) return false;
  const collapsedCount = headers.filter(isFileCollapsed).length;
  return collapsedCount > headers.length / 2;
}

function createToggleButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = BTN_CLASS;
  btn.type = "button";

  updateButtonLabel(btn);

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

    // Update label after a short delay to let React re-render
    setTimeout(() => updateButtonLabel(btn), 100);
  });

  return btn;
}

function updateButtonLabel(btn: HTMLButtonElement): void {
  const shouldExpand = getMajorityCollapsed();
  btn.textContent = shouldExpand ? "Expand all" : "Collapse all";
  btn.title = shouldExpand
    ? "Expand all file diffs"
    : "Collapse all file diffs";
}
