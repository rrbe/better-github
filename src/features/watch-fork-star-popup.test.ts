import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { cleanupWatchForkStarPopup, injectWatchForkStarPopup } from "./watch-fork-star-popup";

const GH = "https://github.com";

describe("watch/fork/star popup", () => {
  beforeEach(() => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = `
      <ul class="pagehead-actions">
        <li><span class="CounterLabel" id="watch-counter">4</span></li>
        <li><a id="fork-button"><span class="Counter" id="fork-counter">2</span></a></li>
        <li><span class="Counter js-social-count" id="star-counter">9</span></li>
      </ul>
    `;
  });

  it("injects popups idempotently and cleans up without deleting GitHub counters", async () => {
    injectWatchForkStarPopup();
    injectWatchForkStarPopup();

    expect(document.querySelectorAll(".bg-wfs-counter-wrap")).toHaveLength(3);
    expect(document.querySelectorAll(".bg-wfs-popup")).toHaveLength(3);

    const watchCounter = document.getElementById("watch-counter")!;
    cleanupWatchForkStarPopup();

    expect(document.getElementById("watch-counter")).toBe(watchCounter);
    expect(watchCounter.classList.contains("bg-wfs-counter-wrap")).toBe(false);
    expect(document.querySelector(".bg-wfs-popup")).toBeNull();

    watchCounter.textContent = "5";
    await Promise.resolve();

    expect(document.querySelector(".bg-wfs-popup")).toBeNull();
  });
});
