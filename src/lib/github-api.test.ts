import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  approvePR,
  fetchCommitDiffStats,
  fetchForks,
  fetchPRBranches,
  fetchPRDiffStats,
  fetchPRReviewStatuses,
  fetchRepoTags,
  fetchStargazers,
  fetchWatchers,
} from "./github-api";

type SendResponse = { ok: boolean; data?: unknown; error?: string };

interface RuntimeMock {
  id?: string;
  lastError?: { message: string };
  sendMessage: ReturnType<typeof vi.fn>;
}

function mockRuntime(opts: { response?: SendResponse; lastError?: { message: string }; id?: string | undefined } = {}): RuntimeMock {
  const runtime: RuntimeMock = {
    id: "id" in opts ? opts.id : "ext-id",
    lastError: opts.lastError,
    sendMessage: vi.fn((_req: unknown, cb: (r: SendResponse | undefined) => void) => {
      cb(opts.response);
    }),
  };
  vi.stubGlobal("chrome", { runtime });
  return runtime;
}

describe("github-api bridge", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("forwards a typed request and resolves the worker's data on success", async () => {
    const runtime = mockRuntime({ response: { ok: true, data: [{ number: 7, headRef: "feature/a" }] } });

    const result = await fetchPRBranches("owner", "repo", "open", 2);

    expect(result).toEqual([{ number: 7, headRef: "feature/a" }]);
    expect(runtime.sendMessage).toHaveBeenCalledWith(
      { type: "FETCH_PR_BRANCHES", owner: "owner", repo: "repo", state: "open", page: 2 },
      expect.any(Function),
    );
  });

  it("swallows an ok:false response and returns the empty default", async () => {
    mockRuntime({ response: { ok: false, error: "boom" } });
    expect(await fetchPRBranches("owner", "repo")).toEqual([]);
  });

  it("treats chrome.runtime.lastError as a failure", async () => {
    mockRuntime({ response: { ok: true, data: [] }, lastError: { message: "port closed" } });
    expect(await fetchPRBranches("owner", "repo")).toEqual([]);
  });

  it("rejects without messaging when the extension context is invalidated", async () => {
    const runtime = mockRuntime({ id: undefined });
    expect(await fetchPRBranches("owner", "repo")).toEqual([]);
    expect(runtime.sendMessage).not.toHaveBeenCalled();
  });

  it("returns a failed PRApproveResult (not []) on the approve path", async () => {
    mockRuntime({ response: { ok: false, error: "Not authorized" } });

    const result = await approvePR("owner", "repo", 1, "lgtm");

    expect(result).toEqual({ success: false, error: "Not authorized" });
  });

  // Every wrapper forwards a distinct request type and resolves the worker's
  // data on success — table-driven so each one is exercised.
  const cases: Array<{ name: string; type: string; run: () => Promise<unknown> }> = [
    { name: "fetchPRReviewStatuses", type: "FETCH_PR_REVIEW_STATUSES", run: () => fetchPRReviewStatuses("o", "r", [1]) },
    { name: "fetchPRDiffStats", type: "FETCH_PR_DIFF_STATS", run: () => fetchPRDiffStats("o", "r", [1]) },
    { name: "fetchCommitDiffStats", type: "FETCH_COMMIT_DIFF_STATS", run: () => fetchCommitDiffStats("o", "r", ["abc"]) },
    { name: "fetchRepoTags", type: "FETCH_REPO_TAGS", run: () => fetchRepoTags("o", "r") },
    { name: "fetchStargazers", type: "FETCH_STARGAZERS", run: () => fetchStargazers("o", "r") },
    { name: "fetchWatchers", type: "FETCH_WATCHERS", run: () => fetchWatchers("o", "r") },
    { name: "fetchForks", type: "FETCH_FORKS", run: () => fetchForks("o", "r") },
  ];

  it.each(cases)("$name forwards a $type request and resolves its data", async ({ type, run }) => {
    const runtime = mockRuntime({ response: { ok: true, data: [{ marker: type }] } });

    const result = await run();

    expect(result).toEqual([{ marker: type }]);
    expect(runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type, owner: "o", repo: "r" }),
      expect.any(Function),
    );
  });

  it.each(cases)("$name returns [] when the bridge fails", async ({ run }) => {
    mockRuntime({ response: { ok: false, error: "down" } });
    expect(await run()).toEqual([]);
  });
});
