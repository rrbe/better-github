import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchActionsInProgressCount } from "../lib/github-api";
import { setUrl } from "../test-utils/url";
import {
  cleanupActionsInProgressCount,
  injectActionsInProgressCount,
} from "./actions-in-progress-count";

vi.mock("../lib/github-api");

describe("injectActionsInProgressCount", () => {
  afterEach(() => {
    cleanupActionsInProgressCount();
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchActionsInProgressCount).mockResolvedValue(null);
    setUrl("https://github.com/owner/repo");
    document.body.innerHTML = `
      <nav aria-label="Repository">
        <ul>
          <li>
            <a href="/owner/repo/pulls">
              <span data-content="Pull requests">Pull requests</span>
              <span data-component="counter">
                <span class="native-counter" data-component="CounterLabel">14</span>
                <span class="native-VisuallyHidden-label">&nbsp;(14)</span>
              </span>
            </a>
          </li>
          <li>
            <a href="/owner/repo/actions">
              <span data-content="Actions">Actions</span>
            </a>
          </li>
        </ul>
      </nav>
    `;
  });

  it("adds the in-progress count to the Actions tab using GitHub's counter structure", async () => {
    vi.mocked(fetchActionsInProgressCount).mockResolvedValue(7);

    injectActionsInProgressCount();
    injectActionsInProgressCount();

    await vi.waitFor(() => {
      expect(
        document.querySelector(
          '.better-github-actions-in-progress-count [data-component="CounterLabel"]',
        )?.textContent,
      ).toBe("7");
    });
    expect(fetchActionsInProgressCount).toHaveBeenCalledOnce();
    expect(document.querySelectorAll(".better-github-actions-in-progress-count")).toHaveLength(1);
    expect(
      document.querySelector('.better-github-actions-in-progress-count [class*="VisuallyHidden"]')
        ?.textContent,
    ).toBe("\u00a0(7)");
  });

  it("omits zero counts without refetching on repeated navigation polls", async () => {
    vi.mocked(fetchActionsInProgressCount).mockResolvedValue(0);

    injectActionsInProgressCount();
    await vi.waitFor(() => expect(fetchActionsInProgressCount).toHaveBeenCalledOnce());
    injectActionsInProgressCount();

    expect(fetchActionsInProgressCount).toHaveBeenCalledOnce();
    expect(document.querySelector(".better-github-actions-in-progress-count")).toBeNull();
  });

  it("can fetch and render again after the feature is disabled and re-enabled", async () => {
    vi.mocked(fetchActionsInProgressCount).mockResolvedValue(3);

    injectActionsInProgressCount();
    await vi.waitFor(() =>
      expect(document.querySelector(".better-github-actions-in-progress-count")).not.toBeNull(),
    );

    cleanupActionsInProgressCount();
    expect(document.querySelector(".better-github-actions-in-progress-count")).toBeNull();

    injectActionsInProgressCount();
    await vi.waitFor(() => expect(fetchActionsInProgressCount).toHaveBeenCalledTimes(2));
    expect(document.querySelector(".better-github-actions-in-progress-count")).not.toBeNull();
  });

  it("refreshes the count and removes the badge when runs finish", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchActionsInProgressCount)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    injectActionsInProgressCount();
    await vi.advanceTimersByTimeAsync(0);
    expect(
      document.querySelector(
        '.better-github-actions-in-progress-count [data-component="CounterLabel"]',
      )?.textContent,
    ).toBe("2");

    await vi.advanceTimersByTimeAsync(61_000);
    expect(
      document.querySelector(
        '.better-github-actions-in-progress-count [data-component="CounterLabel"]',
      )?.textContent,
    ).toBe("1");
    await vi.advanceTimersByTimeAsync(61_000);
    expect(document.querySelector(".better-github-actions-in-progress-count")).toBeNull();
    expect(fetchActionsInProgressCount).toHaveBeenCalledTimes(3);
  });
});
