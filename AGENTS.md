# Better GitHub

## Package Manager

Use `pnpm`, not npm or yarn.

## Build

```sh
pnpm build
```

## Release / Version Bump

When asked to bump the version (e.g. "发 1.11.0"), do **all** of these — the
tag is part of the bump, not an optional extra:

1. Update the version in **both** `package.json` and `static/manifest.json`
   (they must stay in sync; the test mock in `options.test.ts` is unrelated).
2. `pnpm build` and confirm `dist/manifest.json` shows the new version.
3. Commit straight to `main` — no branch/PR for version bumps — with
   `chore: bump version to X.Y.Z`, then `git push origin main`.
4. **Create and push the matching tag**: `git tag vX.Y.Z <bump-commit>` then
   `git push origin vX.Y.Z`. Tags are lightweight and point at the bump commit
   (see `v1.10.1`, `v1.11.0`). Every release commit has one — don't skip it.

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
- Use English as first class language in pull request title & description
