import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { cleanupPRLabelPosition, injectPRLabelPosition } from "./pr-label-position";

const GH = "https://github.com";
const WRAPPER = ".better-github-label-prefix";
const HIDDEN = "better-github-labels-hidden";

describe("injectPRLabelPosition — old Turbo DOM", () => {
  beforeEach(() => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = `
      <div id="issue_1">
        <a id="issue_1_link">Some PR title</a>
        <a class="IssueLabel" href="?q=label:bug">bug</a>
        <a class="IssueLabel" href="?q=label:wip">wip</a>
      </div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("clones IssueLabel links into the info-row wrapper and hides the originals", () => {
    injectPRLabelPosition();

    const wrapper = document.querySelector(WRAPPER)!;
    expect(wrapper).not.toBeNull();

    const cloned = wrapper.querySelectorAll("a.IssueLabel");
    expect(cloned).toHaveLength(2);
    expect([...cloned].map((a) => a.textContent)).toEqual(["bug", "wip"]);

    // The wrapper lives inside the generated info row.
    expect(wrapper.closest(".better-github-info-row")).not.toBeNull();

    // Original labels (the ones NOT inside the wrapper) are hidden.
    const row = document.getElementById("issue_1")!;
    const originals = [...row.querySelectorAll("a.IssueLabel")].filter(
      (a) => !a.closest(WRAPPER),
    );
    expect(originals).toHaveLength(2);
    expect(originals.every((a) => a.classList.contains(HIDDEN))).toBe(true);
  });

  it("is idempotent — a second run does not duplicate the wrapper", () => {
    injectPRLabelPosition();
    injectPRLabelPosition();

    expect(document.querySelectorAll(WRAPPER)).toHaveLength(1);
    expect(document.querySelectorAll(`${WRAPPER} a.IssueLabel`)).toHaveLength(2);
  });

  it("does nothing when the row has no IssueLabel links", () => {
    document.body.innerHTML = `
      <div id="issue_2">
        <a id="issue_2_link">No labels here</a>
      </div>
    `;

    injectPRLabelPosition();

    expect(document.querySelector(WRAPPER)).toBeNull();
  });

  it("is a no-op when not on an issue/PR list page", () => {
    setUrl(`${GH}/owner/repo`);

    injectPRLabelPosition();

    expect(document.querySelector(WRAPPER)).toBeNull();
    expect(document.querySelector(`.${HIDDEN}`)).toBeNull();
  });
});

describe("cleanupPRLabelPosition", () => {
  beforeEach(() => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = "";
  });

  it("un-hides every previously hidden original label", () => {
    document.body.innerHTML = `
      <div id="issue_1">
        <a id="issue_1_link">title</a>
        <a class="IssueLabel" href="?q=label:bug">bug</a>
      </div>
    `;

    injectPRLabelPosition();
    expect(document.querySelectorAll(`.${HIDDEN}`).length).toBeGreaterThan(0);

    cleanupPRLabelPosition();

    expect(document.querySelectorAll(`.${HIDDEN}`)).toHaveLength(0);
  });
});

describe("injectPRLabelPosition — new React DOM via animationstart", () => {
  beforeEach(() => {
    setUrl(`${GH}/owner/repo/pulls`);
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("processes a trailing-badges container when its detection animation starts", () => {
    document.body.innerHTML = `
      <li role="listitem">
        <div class="MainContent-module__inner__xyz"></div>
        <div id="badges">
          <a href="?q=label:bug">bug</a>
          <a href="?q=label:wip">wip</a>
        </div>
      </li>
    `;

    // Register the animationstart listener.
    injectPRLabelPosition();

    const badges = document.getElementById("badges")!;
    badges.dispatchEvent(
      new AnimationEvent("animationstart", {
        animationName: "better-github-detect-labels",
        bubbles: true,
      }),
    );

    const wrapper = document.querySelector(WRAPPER)!;
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelectorAll("a")).toHaveLength(2);
    expect(wrapper.closest(".better-github-info-row")).not.toBeNull();
    expect(badges.classList.contains(HIDDEN)).toBe(true);
  });

  it("ignores animationstart events with a different animationName", () => {
    document.body.innerHTML = `
      <li role="listitem">
        <div class="MainContent-module__inner__xyz"></div>
        <div id="badges"><a href="?q=label:bug">bug</a></div>
      </li>
    `;

    injectPRLabelPosition();

    document.getElementById("badges")!.dispatchEvent(
      new AnimationEvent("animationstart", {
        animationName: "some-other-animation",
        bubbles: true,
      }),
    );

    expect(document.querySelector(WRAPPER)).toBeNull();
  });
});
