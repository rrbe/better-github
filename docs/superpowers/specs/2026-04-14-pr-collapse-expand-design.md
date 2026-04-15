# PR Collapse/Expand All Files

## Summary

Add a toolbar button to GitHub diff pages that collapses or expands all file diffs at once. Targets three page types: PR Files Changed, commit detail, and compare view.

## Scope

### Pages

- PR Files Changed: `/{owner}/{repo}/pull/{number}/files`
- Commit detail: `/{owner}/{repo}/commit/{sha}`
- Compare view: `/{owner}/{repo}/compare/{base}...{head}`

### Behavior

- Inject a single button into the diff page toolbar area
- Button label toggles between "Collapse all" and "Expand all" based on current state
- Clicking the button iterates over all file diff containers and toggles their collapsed/expanded state
- Uses GitHub's native collapse mechanism (clicking the file header chevron or toggling the relevant DOM attribute) rather than CSS hacks — keeps behavior consistent with GitHub's own UX
- If most files are expanded, button shows "Collapse all"; if most are collapsed, button shows "Expand all"

### Settings

- Feature key: `feature-pr-collapse-expand`
- Default: ON
- Listed under the "Pull Requests" group in the options page
- Toggling off removes the injected button; toggling on re-injects it

## Implementation

### New files

- `src/features/pr-collapse-expand.ts` — feature logic

### Modified files

- `src/lib/page-detect.ts` — add `isDiffPage()` helper (matches all three page types)
- `src/content.ts` — register feature in `FEATURE_KEYS`, `FEATURE_CLASSES`, and `injectFeature`
- `src/styles/content.css` — minimal styling for the button
- `static/options.html` — add toggle under Pull Requests group

### DOM strategy

GitHub's file diff containers use `div.file` (classic) or a React-based equivalent. Each file header has a toggle button (chevron icon) that collapses/expands the diff body. The implementation should:

1. Query all file diff containers on the page
2. Detect each file's current collapsed state (presence of a `Details--on`/`open` attribute or collapsed CSS class)
3. Toggle by programmatically clicking each file's header toggle button, or by setting the appropriate attribute
4. After toggling, update the button label

### Button placement

Inject the button near GitHub's existing diff toolbar (the sticky bar with "Conversations / Commits / Checks / Files changed" tabs or the file filter area). Exact selector to be determined during implementation by inspecting the live DOM.

### Idempotency

- Check for existing `.better-github-collapse-expand` element before injecting
- MutationObserver or navigation listener handles SPA re-renders
