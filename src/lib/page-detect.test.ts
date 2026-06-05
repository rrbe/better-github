import { describe, it, expect } from "vitest";
import { setUrl } from "../test-utils/url";
import {
  getRepoInfo,
  isPRListPage,
  isIssueOrPRListPage,
  isRepoPage,
  isRepoTree,
  isReleasesPage,
  isReleaseDetailPage,
  getReleaseTag,
  isPRDetailPage,
  isPRFilesChangedPage,
  isCommitPage,
  isComparePage,
  isDiffPage,
  getPRNumber,
  isCommitsListPage,
  getPRListParams,
} from "./page-detect";

const GH = "https://github.com";

describe("getRepoInfo", () => {
  it("parses owner/repo from a repo URL", () => {
    setUrl(`${GH}/owner/repo`);
    expect(getRepoInfo()).toEqual({ owner: "owner", repo: "repo" });
  });

  it("parses owner/repo from a deeper repo URL", () => {
    setUrl(`${GH}/owner/repo/pull/42/files`);
    expect(getRepoInfo()).toEqual({ owner: "owner", repo: "repo" });
  });

  it("returns null for reserved owners", () => {
    setUrl(`${GH}/settings/profile`);
    expect(getRepoInfo()).toBeNull();
    setUrl(`${GH}/notifications/index`);
    expect(getRepoInfo()).toBeNull();
  });

  it("returns null when there is no owner/repo pair", () => {
    setUrl(`${GH}/explore`);
    expect(getRepoInfo()).toBeNull();
    setUrl(`${GH}/`);
    expect(getRepoInfo()).toBeNull();
  });
});

describe("isPRListPage", () => {
  it("matches the pulls list, with or without query/trailing slash", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    expect(isPRListPage()).toBe(true);
    setUrl(`${GH}/owner/repo/pulls/`);
    expect(isPRListPage()).toBe(true);
    setUrl(`${GH}/owner/repo/pulls?q=is:pr+is:open`);
    expect(isPRListPage()).toBe(true);
  });

  it("rejects a single PR, the issues list, and reserved owners", () => {
    setUrl(`${GH}/owner/repo/pull/42`);
    expect(isPRListPage()).toBe(false);
    setUrl(`${GH}/owner/repo/issues`);
    expect(isPRListPage()).toBe(false);
    setUrl(`${GH}/settings/pulls`);
    expect(isPRListPage()).toBe(false);
  });
});

describe("isIssueOrPRListPage", () => {
  it("matches both the pulls and issues lists", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    expect(isIssueOrPRListPage()).toBe(true);
    setUrl(`${GH}/owner/repo/issues?q=is:open`);
    expect(isIssueOrPRListPage()).toBe(true);
  });

  it("rejects a single issue", () => {
    setUrl(`${GH}/owner/repo/issues/7`);
    expect(isIssueOrPRListPage()).toBe(false);
  });
});

describe("isRepoPage", () => {
  it("is true on any repo page and false off-repo", () => {
    setUrl(`${GH}/owner/repo/pull/1`);
    expect(isRepoPage()).toBe(true);
    setUrl(`${GH}/explore`);
    expect(isRepoPage()).toBe(false);
  });
});

describe("isRepoTree", () => {
  it("matches the repo root and tree paths", () => {
    setUrl(`${GH}/owner/repo`);
    expect(isRepoTree()).toBe(true);
    setUrl(`${GH}/owner/repo/tree/main`);
    expect(isRepoTree()).toBe(true);
    setUrl(`${GH}/owner/repo/tree/main/src/lib`);
    expect(isRepoTree()).toBe(true);
  });

  it("rejects blob and pull paths", () => {
    setUrl(`${GH}/owner/repo/blob/main/README.md`);
    expect(isRepoTree()).toBe(false);
    setUrl(`${GH}/owner/repo/pull/1`);
    expect(isRepoTree()).toBe(false);
  });
});

describe("isReleasesPage", () => {
  it("matches the releases listing and a specific tag", () => {
    setUrl(`${GH}/owner/repo/releases`);
    expect(isReleasesPage()).toBe(true);
    setUrl(`${GH}/owner/repo/releases/tag/v1.0.0`);
    expect(isReleasesPage()).toBe(true);
  });
});

describe("isReleaseDetailPage", () => {
  it("matches a single release page but not the listing", () => {
    setUrl(`${GH}/owner/repo/releases/tag/v1.0.0`);
    expect(isReleaseDetailPage()).toBe(true);
    setUrl(`${GH}/owner/repo/releases`);
    expect(isReleaseDetailPage()).toBe(false);
  });
});

describe("getReleaseTag", () => {
  it("returns the decoded tag from a release page", () => {
    setUrl(`${GH}/owner/repo/releases/tag/v1.0.0`);
    expect(getReleaseTag()).toBe("v1.0.0");
    setUrl(`${GH}/owner/repo/releases/tag/release%2F1.0`);
    expect(getReleaseTag()).toBe("release/1.0");
  });

  it("returns null off a release page", () => {
    setUrl(`${GH}/owner/repo/releases`);
    expect(getReleaseTag()).toBeNull();
  });
});

describe("isPRDetailPage", () => {
  it("matches a PR and its sub-tabs", () => {
    setUrl(`${GH}/owner/repo/pull/42`);
    expect(isPRDetailPage()).toBe(true);
    setUrl(`${GH}/owner/repo/pull/42/files`);
    expect(isPRDetailPage()).toBe(true);
  });

  it("rejects the pulls list", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    expect(isPRDetailPage()).toBe(false);
  });
});

describe("isPRFilesChangedPage", () => {
  it("matches the files/changes tab only", () => {
    setUrl(`${GH}/owner/repo/pull/42/files`);
    expect(isPRFilesChangedPage()).toBe(true);
    setUrl(`${GH}/owner/repo/pull/42/changes`);
    expect(isPRFilesChangedPage()).toBe(true);
    setUrl(`${GH}/owner/repo/pull/42`);
    expect(isPRFilesChangedPage()).toBe(false);
  });
});

describe("isCommitPage", () => {
  it("matches a single commit, not the commits list", () => {
    setUrl(`${GH}/owner/repo/commit/abc123def456`);
    expect(isCommitPage()).toBe(true);
    setUrl(`${GH}/owner/repo/commits`);
    expect(isCommitPage()).toBe(false);
  });
});

describe("isComparePage", () => {
  it("matches a compare URL", () => {
    setUrl(`${GH}/owner/repo/compare/main...dev`);
    expect(isComparePage()).toBe(true);
  });
});

describe("isDiffPage", () => {
  it("is true for PR files, commit, and compare pages", () => {
    setUrl(`${GH}/owner/repo/pull/42/files`);
    expect(isDiffPage()).toBe(true);
    setUrl(`${GH}/owner/repo/commit/abc123`);
    expect(isDiffPage()).toBe(true);
    setUrl(`${GH}/owner/repo/compare/main...dev`);
    expect(isDiffPage()).toBe(true);
  });

  it("is false on a plain repo page", () => {
    setUrl(`${GH}/owner/repo`);
    expect(isDiffPage()).toBe(false);
  });
});

describe("getPRNumber", () => {
  it("extracts the PR number", () => {
    setUrl(`${GH}/owner/repo/pull/123/files`);
    expect(getPRNumber()).toBe(123);
  });

  it("returns null when not on a PR page", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    expect(getPRNumber()).toBeNull();
  });
});

describe("isCommitsListPage", () => {
  it("matches the commits list and a branch-scoped list", () => {
    setUrl(`${GH}/owner/repo/commits`);
    expect(isCommitsListPage()).toBe(true);
    setUrl(`${GH}/owner/repo/commits/main`);
    expect(isCommitsListPage()).toBe(true);
  });

  it("rejects a single commit page", () => {
    setUrl(`${GH}/owner/repo/commit/abc123`);
    expect(isCommitsListPage()).toBe(false);
  });
});

describe("getPRListParams", () => {
  it("defaults to open PRs sorted by updated when no query is present", () => {
    setUrl(`${GH}/owner/repo/pulls`);
    expect(getPRListParams()).toEqual({
      state: "open",
      page: 1,
      query: "is:pr is:open sort:updated-desc",
    });
  });

  it("reports closed state when the query contains is:closed", () => {
    setUrl(`${GH}/owner/repo/pulls?q=is:pr+is:closed`);
    expect(getPRListParams()).toMatchObject({ state: "closed", query: "is:pr is:closed" });
  });

  it("parses the page number", () => {
    setUrl(`${GH}/owner/repo/pulls?page=3`);
    expect(getPRListParams().page).toBe(3);
  });
});
