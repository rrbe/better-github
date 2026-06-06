# Better GitHub

## Package Manager

Use `pnpm`, not npm or yarn.

## Build

```sh
pnpm build
```

## Test

Vitest, with `happy-dom`. Tests live next to the code as `*.test.ts`.

```sh
pnpm test            # run once
pnpm test:watch      # watch mode
pnpm test:coverage   # run with v8 coverage report (coverage/index.html)
```

- Coverage thresholds (`vitest.config.ts`) are a **floor to guard against
  regressions**, meant to be ratcheted up — not a target to pad. They only
  apply under `--coverage`, so plain `pnpm test` (CI) is unaffected.
- Prefer tests that assert observable behavior over ones that merely execute
  code for coverage. Coverage proves code *ran*, not that it was *verified*.

## Performance

This extension runs inside GitHub's own pages, so heavy work must stay cheap —
it competes with GitHub's rendering for the same main thread and network.

- **Fetch lazily, scoped to what's visible.** Never eagerly pull a whole dataset
  when the user can only see a fraction of it. Fetch per visible item, and only
  when it's actually on screen (or on expand) — not the entire history up front.
  Example: release download counts are fetched per visible release tag, not by
  pulling the full release history. (This was originally written the eager way
  and had to be fixed — see commit `perf: fetch release downloads lazily`.)
- **Debounce and scope DOM observers.** A `MutationObserver` on
  `document.body` fires constantly. Coalesce bursts into one pass per frame with
  `requestAnimationFrame` (see `pr-collapse-expand.ts`), or scope the work to
  `mutation.addedNodes` (see `file-age-color.ts`) — don't re-scan the whole
  document on every mutation.
- **Cache and coalesce in the service worker.** Route network requests through
  `cachedFetch` so repeated calls for the same key hit the cache and in-flight
  duplicates are coalesced, instead of refetching.

## Guidelines

- Avoid modifying GitHub's original DOM structure. Prefer appending new elements or using CSS overrides.
