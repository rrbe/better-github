import { beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import { dashboard, dashboardRow } from "../test-utils/pr-dashboard";
import { collectPRRows } from "./pr-list-dom";

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
