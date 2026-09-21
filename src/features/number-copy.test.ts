import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setUrl } from "../test-utils/url";
import { dashboard, dashboardRow } from "../test-utils/pr-dashboard";
import { injectNumberCopy } from "./number-copy";

function issueRow(number: number, href = `/owner/repo/issues/${number}`): string {
  return `<li>
    <h3><a data-testid="issue-pr-title-link" href="${href}">Issue #${number}</a></h3>
    <div data-testid="list-row-repo-name-and-number"><span><span>#<!-- -->${number}</span></span> · opened</div>
  </li>`;
}

describe("injectNumberCopy", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    setUrl("https://github.com/owner/repo/issues");
    document.body.innerHTML = "";
    vi.spyOn(navigator.clipboard, "writeText").mockImplementation(writeText);
    writeText.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("copies the issue number from a React row without touching title or other repositories", async () => {
    document.body.innerHTML = `<react-app app-name="issues-react"><ul>
      ${issueRow(7)}
      ${issueRow(8, "/other/repo/issues/8")}
      ${issueRow(9, "/owner/repo/pull/9")}
    </ul></react-app>`;

    injectNumberCopy();
    injectNumberCopy();

    const button = document.querySelector<HTMLButtonElement>(".better-github-number-copy")!;
    expect(document.querySelectorAll(".better-github-number-copy")).toHaveLength(1);
    expect(button.title).toBe("Click to copy issue number");
    expect(button.closest("h3")).toBeNull();
    expect(button.textContent).toBe("");
    button.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("7"));
  });

  it("copies numbers from classic issue rows", async () => {
    document.body.innerHTML = `<div id="issue_7">
      <a id="issue_7_link" href="/owner/repo/issues/7">Issue</a>
      <div>#7 opened</div>
    </div>`;

    injectNumberCopy();
    const button = document.querySelector<HTMLButtonElement>(".better-github-number-copy")!;
    expect(button.textContent).toBe("#7");
    button.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("7"));
  });

  it("retains the PR number interaction", async () => {
    setUrl("https://github.com/owner/repo/pulls");
    document.body.innerHTML = dashboard(dashboardRow(7));

    injectNumberCopy();
    const button = document.querySelector<HTMLButtonElement>(".better-github-number-copy")!;
    expect(button.title).toBe("Click to copy PR number");
    button.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith("7"));
  });
});
