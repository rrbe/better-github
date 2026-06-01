import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "./test-utils/url";

/**
 * early-sort-redirect.ts is an IIFE that runs at import time. Each test sets up
 * the URL + chrome mock first, then dynamically imports the module to trigger it.
 */
async function runRedirect(): Promise<void> {
  vi.resetModules();
  await import("./early-sort-redirect");
}

let storageGet: ReturnType<typeof vi.fn>;
let replaceSpy: ReturnType<typeof vi.spyOn>;

describe("early-sort-redirect", () => {
  beforeEach(() => {
    // Default: feature enabled (storage returns no override).
    storageGet = vi.fn((_key: string, cb: (r: Record<string, unknown>) => void) => cb({}));
    vi.stubGlobal("chrome", { storage: { local: { get: storageGet } } });

    replaceSpy = vi.spyOn(window.location, "replace").mockImplementation(() => {});
    // Clean page marker so applyPageMarker assertions are unaffected by leakage.
    delete document.documentElement.dataset.bgPage;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.bgPage;
  });

  it("redirects to a default sort on a sort-less PR list page", async () => {
    setUrl("https://github.com/owner/repo/pulls");

    await runRedirect();

    expect(storageGet).toHaveBeenCalledWith("feature-default-sort", expect.any(Function));
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const target = replaceSpy.mock.calls[0][0] as string;
    const params = new URLSearchParams(target.split("?")[1]);
    expect(target.split("?")[0]).toBe("/owner/repo/pulls");
    expect(params.get("q")).toBe("is:pr is:open sort:updated-desc ");
  });

  it("uses the issue base query on a sort-less issues list page", async () => {
    setUrl("https://github.com/owner/repo/issues");

    await runRedirect();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const params = new URLSearchParams((replaceSpy.mock.calls[0][0] as string).split("?")[1]);
    expect(params.get("q")).toBe("is:issue is:open sort:updated-desc ");
  });

  it("appends sort to an existing q that has no sort qualifier", async () => {
    setUrl("https://github.com/owner/repo/pulls?q=is%3Apr+author%3Aoctocat");

    await runRedirect();

    expect(replaceSpy).toHaveBeenCalledTimes(1);
    const params = new URLSearchParams((replaceSpy.mock.calls[0][0] as string).split("?")[1]);
    expect(params.get("q")).toBe("is:pr author:octocat sort:updated-desc ");
  });

  it("does not redirect when the default-sort feature is disabled", async () => {
    setUrl("https://github.com/owner/repo/pulls");
    storageGet.mockImplementation((_key: string, cb: (r: Record<string, unknown>) => void) =>
      cb({ "feature-default-sort": false }),
    );

    await runRedirect();

    expect(storageGet).toHaveBeenCalledTimes(1);
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the query already contains a sort qualifier", async () => {
    setUrl("https://github.com/owner/repo/pulls?q=is%3Apr+sort%3Acreated-asc");

    await runRedirect();

    expect(storageGet).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("does nothing on a non-list URL", async () => {
    setUrl("https://github.com/owner/repo");

    await runRedirect();

    expect(storageGet).not.toHaveBeenCalled();
    expect(replaceSpy).not.toHaveBeenCalled();
  });

  it("applies the pr-list page marker before any redirect decision", async () => {
    setUrl("https://github.com/owner/repo/pulls?q=is%3Apr+sort%3Acreated-asc");

    await runRedirect();

    // applyPageMarker runs unconditionally, even when no redirect happens.
    expect(document.documentElement.dataset.bgPage).toBe("pr-list");
  });
});
