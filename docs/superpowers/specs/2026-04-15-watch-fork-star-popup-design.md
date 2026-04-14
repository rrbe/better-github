# Watch/Fork/Star Hover Popup Design

## Overview

Add hover popups to the Watch, Fork, and Star counter numbers on GitHub repo pages. Hovering a counter shows an inline popup with a list preview and a "View all" link to the full GitHub page.

**Feature key**: `watch-fork-star-popup`

## Interaction Design

### Trigger

- **Hover** the counter number (e.g., "4", "111", "2.3k") for 300ms to open popup (prevents accidental triggers)
- Mouse leaves counter or popup for 200ms to close (prevents flicker)
- Invisible bridge pseudo-element (`::after`) spans the 8px gap between counter and popup so the mouse can travel smoothly

### Popup Content

**Header**: Type title + total count (e.g., "Stargazers — 2.3k")

**List** (max 30 items, single API page):

- **Watchers / Stargazers**: User avatar (28px circle) + username + display name
- **Forks**: Owner avatar + `owner/repo` + description (truncated)

**Footer**: "View all" link to `/{owner}/{repo}/stargazers`, `/watchers`, or `/forks`

**States**:

- **Loading**: 4-row skeleton placeholder (animated)
- **Error**: "Failed to load" message
- **Empty**: "No [watchers/stargazers/forks] yet"

### Counter Hover Style

Background changes to `--bgColor-accent-muted`, text to `--fgColor-accent` on hover.

## Technical Architecture

### File Changes

| File | Change |
|------|--------|
| `src/features/watch-fork-star-popup.ts` | New — feature main logic |
| `src/lib/github-api.ts` | Add `fetchStargazers()`, `fetchWatchers()`, `fetchForks()` |
| `src/lib/messages.ts` | Add message type definitions |
| `src/service-worker.ts` | Add 3 API handlers with caching |
| `src/lib/page-detect.ts` | Add `isRepoPage()` if not present |
| `src/content.ts` | Register feature: FEATURE_KEYS, FEATURE_CLASSES, injectFeature |
| `src/options.ts` + `static/options.html` | Add toggle in Repository group |
| `src/styles/content.css` | Popup styles |

### Data Flow

```
hover counter
  → 300ms delay
  → show popup with skeleton
  → chrome.runtime.sendMessage({ type: 'fetchStargazers', owner, repo })
  → service-worker.ts
  → GitHub REST API (with token, cached in session storage 5min)
  → response
  → replace skeleton with user/repo list
```

### API Endpoints

| Endpoint | Notes |
|----------|-------|
| `GET /repos/{owner}/{repo}/stargazers` | `Accept: application/vnd.github.star+json` for `starred_at` timestamps |
| `GET /repos/{owner}/{repo}/subscribers` | Watchers list |
| `GET /repos/{owner}/{repo}/forks?sort=newest` | Fork repos, newest first |

### Caching

Reuse existing service worker session storage cache. Key format: `cache:stargazers:{owner}/{repo}`, `cache:watchers:{owner}/{repo}`, `cache:forks:{owner}/{repo}`. TTL: 5 minutes.

### DOM Injection

**Target elements**:

- Watch counter: `ul.pagehead-actions .prc-CounterLabel-CounterLabel-*` (Primer React)
- Fork counter: `#fork-button .Counter`
- Star counter: `.starring-container .Counter.js-social-count` (use the visible one)

**Injection**:

1. Wrap each counter in `<span class="bg-wfs-counter-wrap">`
2. Append popup DOM inside the wrap, `display: none` by default
3. JS `mouseenter`/`mouseleave` with delay timers control visibility

**Idempotency**: Skip if `.bg-wfs-counter-wrap` already exists.

**Cleanup**: On feature toggle off, unwrap counters and remove popup DOM.

### Popup Styles

- Width: 280px, border-radius: 12px
- Background: `--bgColor-default`, border: `--borderColor-default`
- Shadow: `0 8px 24px rgba(0,0,0,0.12)`
- List items: 28px round avatar, 13px username (bold), 11px subtitle (muted)
- Skeleton: 4 rows, animated stripe
- All colors use GitHub CSS variables for light/dark theme compatibility

### Page Detection

Active on any page with `ul.pagehead-actions` (repo pages: code, issues, PRs, etc.).

### Settings

- Toggle in options page under "Repository" group
- Default: ON
- Feature key: `feature-watch-fork-star-popup`
