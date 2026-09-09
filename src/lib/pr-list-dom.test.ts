import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { dashboard, dashboardRow } from "../test-utils/pr-dashboard";
import { collectPRRows, isCompactPRRow } from "./pr-list-dom";

describe("collectPRRows", () => {
  beforeEach(() => {
    setUrl("https://github.com/owner/repo/pulls");
    document.body.innerHTML = "";
  });

  it("collects classic rows once, excluding title IDs and unrelated issue_ IDs", () => {
    document.body.innerHTML = `<div id="issue_7"><a id="issue_7_link">PR</a></div><div id="issue_filters"></div>`;
    expect([...collectPRRows("owner", "repo")]).toEqual([[7, document.getElementById("issue_7")]]);
  });

  it("recognizes the rendered dashboard without relying on feature flag data", () => {
    document.body.innerHTML = dashboard(dashboardRow(7), dashboardRow(8));
    const rows = collectPRRows("owner", "repo");
    expect([...rows.keys()]).toEqual([7, 8]);
    expect([...rows.values()].every((row) => row.tagName === "LI")).toBe(true);
  });

  it("skips compact dashboard rows and collects them again at default density", () => {
    document.body.innerHTML = dashboard(dashboardRow(7));
    const list = document.querySelector("ul")!;
    const row = document.querySelector("li")!;
    list.setAttribute("data-density", "compact");
    expect(isCompactPRRow(row)).toBe(true);
    expect(collectPRRows("owner", "repo").size).toBe(0);
    list.setAttribute("data-density", "default");
    expect([...collectPRRows("owner", "repo").keys()]).toEqual([7]);
  });

  it("does not treat other React lists as the compact PR dashboard", () => {
    document.body.innerHTML =
      '<react-app app-name="issues-react"><ul data-density="compact"><li></li></ul></react-app>';
    expect(isCompactPRRow(document.querySelector("li")!)).toBe(false);
  });

  it.each([
    ["OWNER", "repo", "owner/repo"],
    ["owner", "REPO", "owner/repo"],
    ["OWNER", "REPO", "owner/repo"],
    ["owner", "repo", "Owner/Repo"],
  ])("matches %s/%s against canonical title links for %s", (owner, repo, linkedRepo) => {
    setUrl(`https://github.com/${owner}/${repo}/pulls`);
    document.body.innerHTML = dashboard(dashboardRow(7).replaceAll("owner/repo", linkedRepo));

    expect([...collectPRRows(owner, repo).keys()]).toEqual([7]);
  });

  it("ignores other repos, external links, issue links and links outside the dashboard", () => {
    document.body.innerHTML =
      dashboard(
        dashboardRow(7),
        dashboardRow(8).replaceAll("owner/repo", "other/repo"),
        dashboardRow(9).replaceAll("github.com", "example.com"),
        dashboardRow(10).replaceAll("/pull/", "/issues/"),
      ) + dashboardRow(11);
    expect([...collectPRRows("owner", "repo").keys()]).toEqual([7]);
  });
});
