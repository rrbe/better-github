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

## Guidelines

- Avoid modifying GitHub's original DOM structure. Prefer appending new elements or using CSS overrides.
