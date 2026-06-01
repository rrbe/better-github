import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type NavModule = typeof import("./navigation");

async function loadNavigation(): Promise<NavModule> {
  vi.resetModules();
  return import("./navigation");
}

describe("navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // navigation.ts attaches document/window listeners at module load with no
    // teardown, so resetModules()+reimport leaves prior listeners attached.
    // They fire stale handlers (caught + logged) on later dispatches — silence
    // the expected logging so it doesn't spam stderr with stacks.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs all registered handlers synchronously on startNavigation()", async () => {
    const { onPageReady, startNavigation } = await loadNavigation();
    const a = vi.fn();
    const b = vi.fn();

    onPageReady(a);
    onPageReady(b);
    startNavigation();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("debounces rapid turbo:load + turbo:render into a single handler run", async () => {
    const { onPageReady } = await loadNavigation();
    const handler = vi.fn();
    onPageReady(handler);

    // Fire several SPA navigation events in quick succession.
    document.dispatchEvent(new Event("turbo:load"));
    document.dispatchEvent(new Event("turbo:render"));
    document.dispatchEvent(new Event("turbo:load"));

    // Nothing should have run yet — the debounce timer is still pending.
    expect(handler).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("runs handlers again on a later, separate navigation burst", async () => {
    const { onPageReady } = await loadNavigation();
    const handler = vi.fn();
    onPageReady(handler);

    document.dispatchEvent(new Event("turbo:load"));
    vi.runOnlyPendingTimers();
    expect(handler).toHaveBeenCalledTimes(1);

    document.dispatchEvent(new Event("turbo:render"));
    vi.runOnlyPendingTimers();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("re-runs handlers via the polling interval after startNavigation()", async () => {
    const { onPageReady, startNavigation } = await loadNavigation();
    const handler = vi.fn();
    onPageReady(handler);

    startNavigation();
    expect(handler).toHaveBeenCalledTimes(1); // immediate run

    vi.advanceTimersByTime(2000);
    expect(handler).toHaveBeenCalledTimes(2); // one poll tick

    vi.advanceTimersByTime(2000);
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it("runs handlers on popstate (back/forward) after the timer flushes", async () => {
    const { onPageReady } = await loadNavigation();
    const handler = vi.fn();
    onPageReady(handler);

    window.dispatchEvent(new Event("popstate"));
    expect(handler).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // Kept last: this registers a throwing handler whose module-level listeners
  // leak (see beforeEach), so running it after the others avoids re-firing the
  // throw inside their assertions.
  it("isolates a throwing handler so later handlers still run, and logs the error", async () => {
    const { onPageReady, startNavigation } = await loadNavigation();

    const boom = vi.fn(() => {
      throw new Error("handler blew up");
    });
    const after = vi.fn();

    onPageReady(boom);
    onPageReady(after);
    startNavigation();

    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "[Better GitHub] Handler error:",
      expect.any(Error),
    );
  });
});
