import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test-utils/**", "src/**/*.d.ts"],
      // Floor lines, slightly below the current numbers — a safety net against
      // big regressions, meant to be ratcheted up as coverage grows. Only
      // enforced when run with `--coverage` (i.e. `pnpm test:coverage`), so the
      // plain `pnpm test` used in CI is unaffected.
      thresholds: {
        statements: 40,
        branches: 32,
        functions: 45,
        lines: 42,
      },
    },
  },
});
