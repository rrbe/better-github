import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectFileAgeColor } from "./file-age-color";

const GH = "https://github.com";
const NOW = new Date("2026-06-01T00:00:00Z");
const HEAT_WINDOW_MS = 2_000_000_000; // mirrors the source constant

/** Build one commit-age cell wrapping a relative-time with the given datetime. */
function ageCell(datetime: string | null): string {
  const attr = datetime === null ? "" : ` datetime="${datetime}"`;
  return `<div class="react-directory-commit-age"><relative-time${attr}></relative-time></div>`;
}

function heatOf(selector = "relative-time"): string | undefined {
  return document.querySelector<HTMLElement>(selector)?.dataset.betterGithubHeat;
}

describe("injectFileAgeColor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("assigns a low heat index to a recent timestamp", () => {
    setUrl(`${GH}/owner/repo`);
    // 5 days old → (432_000_000 / 2e9) * 10 = 2.16 → ceil = 3
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    document.body.innerHTML = ageCell(fiveDaysAgo);

    injectFileAgeColor();

    expect(heatOf()).toBe("3");
  });

  it("clamps a timestamp older than the heat window to 10", () => {
    setUrl(`${GH}/owner/repo`);
    const ancient = new Date(NOW.getTime() - HEAT_WINDOW_MS - 1).toISOString();
    document.body.innerHTML = ageCell(ancient);

    injectFileAgeColor();

    expect(heatOf()).toBe("10");
  });

  it("assigns heat 1 to a future date (age <= 0)", () => {
    setUrl(`${GH}/owner/repo`);
    const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    document.body.innerHTML = ageCell(future);

    injectFileAgeColor();

    expect(heatOf()).toBe("1");
  });

  it("leaves elements with an invalid/missing datetime untouched", () => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = ageCell(null) + ageCell("not-a-date");

    injectFileAgeColor();

    const els = document.querySelectorAll<HTMLElement>("relative-time");
    expect(els[0].dataset.betterGithubHeat).toBeUndefined();
    expect(els[1].dataset.betterGithubHeat).toBeUndefined();
  });

  it("is idempotent — a second run does not recompute an already-colorized cell", () => {
    setUrl(`${GH}/owner/repo`);
    const old = new Date(NOW.getTime() - HEAT_WINDOW_MS - 1).toISOString();
    document.body.innerHTML = ageCell(old);

    injectFileAgeColor();
    expect(heatOf()).toBe("10");

    // Mutating the dataset; the guard means a re-run must not overwrite it.
    document.querySelector<HTMLElement>("relative-time")!.dataset.betterGithubHeat = "sentinel";
    injectFileAgeColor();

    expect(heatOf()).toBe("sentinel");
  });

  it("does nothing off a repo-tree page", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    const old = new Date(NOW.getTime() - HEAT_WINDOW_MS - 1).toISOString();
    document.body.innerHTML = ageCell(old);

    injectFileAgeColor();

    expect(heatOf()).toBeUndefined();
  });

  it("colorizes async-rendered relative-time nodes via the MutationObserver", async () => {
    setUrl(`${GH}/owner/repo`);
    injectFileAgeColor();

    const cell = document.createElement("div");
    cell.className = "react-directory-commit-age";
    const rt = document.createElement("relative-time");
    rt.setAttribute("datetime", new Date(NOW.getTime() - HEAT_WINDOW_MS - 1).toISOString());
    cell.appendChild(rt);
    document.body.appendChild(cell);

    // Let the MutationObserver callback flush.
    await Promise.resolve();

    expect(rt.dataset.betterGithubHeat).toBe("10");
  });
});
