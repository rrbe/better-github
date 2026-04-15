# PR Collapse/Expand All Files — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a toolbar button to GitHub diff pages that collapses or expands all file diffs at once.

**Architecture:** A single content-script feature (`pr-collapse-expand.ts`) that detects diff pages (PR files changed, commit, compare), finds the toolbar area, injects a toggle button, and batch-clicks each file's native chevron button. No API calls needed — pure DOM manipulation.

**Tech Stack:** TypeScript, Chrome Extension Manifest v3, GitHub's React-based diff UI

---

## DOM Reference (from live inspection 2026-04-14)

### Shared across all diff pages

| Element | Selector | Notes |
|---------|----------|-------|
| File header | `[class*="DiffFileHeader-module__diff-file-header"]` | One per file |
| Collapsed state | Header has class containing `collapsed` | `DiffFileHeader-module__collapsed__ZY5uc` |
| Chevron button | First `<button>` child inside file header's first `<div>` child | `.click()` toggles collapse/expand |
| SVG icon | `svg.octicon-chevron-down` (expanded) / `svg.octicon-chevron-right` (collapsed) | |
| Tooltip | `[popover]` near chevron | "Collapse file" / "Expand file" |

### PR Files Changed (`/pull/N/files` → redirects to `/pull/N/changes`)

| Element | Selector |
|---------|----------|
| Toolbar | `section[class*="PullRequestFilesToolbar-module__toolbar"]` |
| Right controls area | Toolbar's 3rd child (`children[2]`), a `div.prc-Stack-Stack-*` |
| File controls | `[class*="PullRequestFilesToolbar-module__file-controls"]` (first item in right area) |

### Commit page (`/commit/SHA`) and Compare page (`/compare/...`)

| Element | Selector |
|---------|----------|
| Diff content root | `#diff-content-parent` |
| Sticky bar | First child's first child, has class `position-sticky` |
| Right controls | Sticky bar's 2nd child |

---

### Task 1: Add page detection helpers

**Files:**
- Modify: `src/lib/page-detect.ts`

- [ ] **Step 1: Add `isPRFilesChangedPage()` helper**

In `src/lib/page-detect.ts`, add after the `isPRDetailPage()` function:

```typescript
export function isPRFilesChangedPage(): boolean {
  const info = getRepoInfo();
  if (!info) return false;
  return /^\/[^/]+\/[^/]+\/pull\/\d+\/(files|changes)(\/.*)?$/.test(location.pathname);
}
```

- [ ] **Step 2: Add `isCommitPage()` helper**

```typescript
export function isCommitPage(): boolean {
  const info = getRepoInfo();
  if (!info) return false;
  return /^\/[^/]+\/[^/]+\/commit\/[0-9a-f]+/.test(location.pathname);
}
```

- [ ] **Step 3: Add `isComparePage()` helper**

```typescript
export function isComparePage(): boolean {
  const info = getRepoInfo();
  if (!info) return false;
  return /^\/[^/]+\/[^/]+\/compare\//.test(location.pathname);
}
```

- [ ] **Step 4: Add combined `isDiffPage()` helper**

```typescript
export function isDiffPage(): boolean {
  return isPRFilesChangedPage() || isCommitPage() || isComparePage();
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/page-detect.ts
git commit -m "feat(page-detect): add diff page detection helpers"
```

---

### Task 2: Implement the feature module

**Files:**
- Create: `src/features/pr-collapse-expand.ts`

- [ ] **Step 1: Create the feature file with constants and main function**

Create `src/features/pr-collapse-expand.ts`:

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/features/pr-collapse-expand.ts
git commit -m "feat: add pr-collapse-expand feature module"
```

---

### Task 3: Register the feature in content.ts

**Files:**
- Modify: `src/content.ts`

- [ ] **Step 1: Add import**

At the top of `src/content.ts`, add:

```typescript
import { injectPRCollapseExpand } from "./features/pr-collapse-expand";
```

- [ ] **Step 2: Add to FEATURE_KEYS array**

Add `"feature-pr-collapse-expand"` to the `FEATURE_KEYS` array:

```typescript
const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-review-status",
  "feature-release-tab",
  "feature-pr-label-position",
  "feature-pr-approve-now",
  "feature-default-sort",
  "feature-commit-tags",
  "feature-better-top-repos",
  "feature-pr-collapse-expand",
] as const;
```

- [ ] **Step 3: Add to FEATURE_CLASSES**

```typescript
"feature-pr-collapse-expand": ["better-github-collapse-expand"],
```

- [ ] **Step 4: Add case to injectFeature switch**

```typescript
case "feature-pr-collapse-expand":
  injectPRCollapseExpand();
  break;
```

- [ ] **Step 5: Commit**

```bash
git add src/content.ts
git commit -m "feat: register pr-collapse-expand in content script"
```

---

### Task 4: Add button styling

**Files:**
- Modify: `src/styles/content.css`

- [ ] **Step 1: Add CSS for the collapse/expand button**

Append to the end of `src/styles/content.css`:

```css
/* PR Collapse/Expand All */
.better-github-collapse-expand {
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  color: var(--fgColor-muted, var(--color-fg-muted, #656d76));
  background: transparent;
  border: 1px solid var(--borderColor-default, var(--color-border-default, #d0d7de));
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.better-github-collapse-expand:hover {
  color: var(--fgColor-default, var(--color-fg-default, #24292f));
  background: var(--bgColor-muted, var(--color-canvas-subtle, #f6f8fa));
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/content.css
git commit -m "style: add collapse/expand button CSS"
```

---

### Task 5: Add settings toggle

**Files:**
- Modify: `static/options.html`

- [ ] **Step 1: Add toggle to Pull Requests group**

In `static/options.html`, add a new `<li class="feature-item">` inside the Pull Requests `<ul class="feature-list">`, after the PR Approve Now item:

```html
<li class="feature-item">
  <div class="feature-info">
    <div class="feature-name">Collapse/Expand All Files</div>
    <div class="feature-desc">
      Add a button to collapse or expand all file diffs on PR, commit, and compare pages.
    </div>
  </div>
  <label class="toggle">
    <input type="checkbox" id="feature-pr-collapse-expand" checked />
    <span class="slider"></span>
  </label>
</li>
```

- [ ] **Step 2: Commit**

```bash
git add static/options.html
git commit -m "feat: add collapse/expand toggle to settings page"
```

---

### Task 6: Build, test in browser, and fix issues

- [ ] **Step 1: Build the extension**

```bash
pnpm build
```

Verify no TypeScript or build errors.

- [ ] **Step 2: Load the extension in Chrome and test on PR Files Changed page**

Navigate to a PR's Files Changed tab. Verify:
- The "Collapse all" button appears in the toolbar
- Clicking it collapses all file diffs
- Button label changes to "Expand all"
- Clicking again expands all files
- Button label changes back to "Collapse all"

- [ ] **Step 3: Test on commit page**

Navigate to a commit page. Verify same behavior.

- [ ] **Step 4: Test on compare page**

Navigate to a compare page. Verify same behavior.

- [ ] **Step 5: Test settings toggle**

Open extension settings popup. Verify:
- "Collapse/Expand All Files" toggle appears under Pull Requests
- Toggling off removes the button from diff pages
- Toggling on re-injects it

- [ ] **Step 6: Fix any issues found during testing and commit**

```bash
git add -A
git commit -m "fix: address issues found during browser testing"
```

---

### Task 7: Final commit and branch readiness

- [ ] **Step 1: Run a final build to ensure everything is clean**

```bash
pnpm build
```

- [ ] **Step 2: Verify git status is clean**

```bash
git status
git log --oneline -10
```
