import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { injectPRNumberHighlight } from "./pr-number-highlight";

const GH = "https://github.com";
const NUMBER = ".better-github-pr-number";

/** Mirror the live Turbo-DOM `.opened-by`: "#1234 opened <time> by <a>". */
function openedByRow(number: number): string {
  return `
    <div id="issue_${number}">
      <a id="issue_${number}_link">Some PR title</a>
      <span class="opened-by">
        #${number}
          opened <relative-time datetime="2026-06-03T19:29:46Z">Jun 4, 2026</relative-time> by
          <a class="Link--muted">rrbe</a>
      </span>
    </div>
  `;
}

describe("injectPRNumberHighlight", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("wraps the leading #number on the PR list page", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = openedByRow(3577);

    injectPRNumberHighlight();

    const badge = document.querySelector<HTMLElement>(NUMBER);
    expect(badge).not.toBeNull();
    expect(badge!.textContent).toBe("#3577");
    // The badge lives inside the original `.opened-by`, replacing the number text.
    expect(badge!.closest(".opened-by")).not.toBeNull();
  });

  it("leaves the surrounding 'opened … by' text intact", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = openedByRow(42);

    injectPRNumberHighlight();

    const openedBy = document.querySelector<HTMLElement>(".opened-by")!;
    // Number appears exactly once, and the meta text is unchanged.
    expect(openedBy.querySelectorAll(NUMBER)).toHaveLength(1);
    expect(openedBy.textContent).toContain("opened");
    expect(openedBy.textContent).toContain("by");
    // The "#42" no longer leaks into a bare text node next to the span.
    const bareText = [...openedBy.childNodes]
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent)
      .join("");
    expect(bareText).not.toContain("#42");
  });

  it("highlights every row in the list", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = openedByRow(1) + openedByRow(2) + openedByRow(3);

    injectPRNumberHighlight();

    const badges = [...document.querySelectorAll<HTMLElement>(NUMBER)];
    expect(badges.map((b) => b.textContent)).toEqual(["#1", "#2", "#3"]);
  });

  it("also runs on the issues list page", () => {
    setUrl(`${GH}/owner/repo/issues`);
    document.body.innerHTML = openedByRow(7);

    injectPRNumberHighlight();

    expect(document.querySelector(NUMBER)?.textContent).toBe("#7");
  });

  it("does nothing off an issue/PR list page", () => {
    setUrl(`${GH}/owner/repo`);
    document.body.innerHTML = openedByRow(99);

    injectPRNumberHighlight();

    expect(document.querySelector(NUMBER)).toBeNull();
  });

  it("is idempotent — a second run does not double-wrap", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = openedByRow(123);

    injectPRNumberHighlight();
    injectPRNumberHighlight();

    expect(document.querySelectorAll(NUMBER)).toHaveLength(1);
    expect(document.querySelector(NUMBER)?.textContent).toBe("#123");
  });
});
