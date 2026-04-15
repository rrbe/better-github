# Settings Page Improvements: Open Source Link & Feature Search

## Overview

Two improvements to the Better GitHub extension settings page (popup):
1. Add open source project link (header + footer)
2. Add inline search for features

Repository: https://github.com/rrbe/better-github

---

## 1. Open Source Link

### Header

- Add a GitHub Octicon SVG icon (16px) to the right of the "Better GitHub Settings" title
- The icon is an `<a target="_blank">` linking to https://github.com/rrbe/better-github
- Hover: color darkens, consistent with existing title style
- Title and icon are in a flex row with `space-between` or `gap` alignment

### Footer

- A new line at the very bottom of the page, centered
- Content: `Better GitHub v{version} · GitHub`
- Version is read dynamically via `chrome.runtime.getManifest().version`
- "GitHub" is a hyperlink to the repository

---

## 2. Inline Feature Search

### Trigger

- A "Features" label + search icon button row appears above the first `<details>` group
- Left side: "Features" text label
- Right side: magnifying glass SVG icon button (no background, hover darkens)

### Search Box

- Clicking the search icon reveals an inline search input below the Features row
- Placeholder: "Search features..."
- Right side of input: ✕ close button
- Style matches existing token input (same border, border-radius, font-size)

### Search Behavior

- On search box appear: all `<details>` groups expand (set `open` attribute)
- Real-time filtering on `input` event (no debounce needed for ~9 items)
- Match logic: `featureName.toLowerCase().includes(query.toLowerCase())`
- Non-matching `.feature-item` elements: `display: none`
- If all features in a group are hidden, hide the entire group
- Empty query: show all features, keep groups expanded

### Close Search

- Trigger: click ✕ button or press Escape key
- Actions: clear input, hide search box, restore all groups to default collapsed state (only first group open), show search icon button again

### No Transition Animations

Keep it simple — no CSS transitions for show/hide.

---

## Scope

### In Scope
- HTML/CSS changes to `static/options.html`
- JS logic changes to `src/options.ts`
- GitHub Octicon SVGs (inline, no external dependencies)

### Out of Scope
- Changing popup vs. tab mode
- Search result highlighting or match count
- Matching against feature descriptions or group names
- Any changes to feature implementations or content scripts

---

## Technical Notes

- No new dependencies — pure HTML/CSS/vanilla TS
- All changes confined to `options.html` and `options.ts`
- Version number via `chrome.runtime.getManifest().version`
- SVG icons inline in HTML (GitHub octicon + magnifying glass + close X)
