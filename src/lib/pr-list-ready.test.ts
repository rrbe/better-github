import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repoDashboard, dashboardRow } from "../test-utils/pr-dashboard";
import { setUrl } from "../test-utils/url";
import { isPRListReady, watchPRListReady } from "./pr-list-ready";
import { insertInfoRowItem } from "./info-row";

describe("PR list hydration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setUrl("https://github.com/owner/repo/pulls");
    document.body.innerHTML = repoDashboard(dashboardRow(7));
    document.querySelector("react-app")!.setAttribute("data-ssr", "true");
  });
  afterEach(async () => {
    document.body.innerHTML = "";
    await vi.advanceTimersByTimeAsync(5000);
    vi.useRealTimers();
  });

  it("keeps SSR rows untouched and inserts only after React commits", async () => {
    const app = document.querySelector("react-app")!;
    const onReady = vi.fn();
    watchPRListReady(onReady);
    watchPRListReady(onReady);
    expect(
      insertInfoRowItem(document.querySelector("li")!, "branch", document.createElement("span")),
    ).toBe(false);
    expect(document.querySelector(".better-github-info-row")).toBeNull();
    app.innerHTML = `<ul>${dashboardRow(7)}</ul>`;
    app.classList.add("loaded");
    await vi.advanceTimersByTimeAsync(0);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(
      insertInfoRowItem(document.querySelector("li")!, "branch", document.createElement("span")),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("allows independent badges after five seconds if React never signals ready", async () => {
    const onReady = vi.fn();
    const row = document.querySelector("li")!;
    watchPRListReady(onReady);
    await vi.advanceTimersByTimeAsync(4999);
    expect(isPRListReady(row)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(isPRListReady(row)).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(insertInfoRowItem(row, "labels", document.createElement("span"))).toBe(true);
  });

  it("does not trigger an injection after leaving the app", async () => {
    const onReady = vi.fn();
    watchPRListReady(onReady);
    document.body.innerHTML = "";
    await vi.advanceTimersByTimeAsync(5000);
    expect(onReady).not.toHaveBeenCalled();
  });

  it("waits for issue list hydration before changing SSR rows", async () => {
    setUrl("https://github.com/owner/repo/issues");
    const app = document.querySelector("react-app")!;
    app.setAttribute("app-name", "issues-react");
    const onReady = vi.fn();
    const row = document.querySelector("li")!;

    watchPRListReady(onReady);
    expect(isPRListReady(row)).toBe(false);
    app.classList.add("loaded");
    await vi.advanceTimersByTimeAsync(0);
    expect(isPRListReady(row)).toBe(true);
    expect(onReady).toHaveBeenCalledTimes(1);
  });
});
