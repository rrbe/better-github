import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServiceWorkerRequest, ServiceWorkerResponse } from "./lib/messages";

type SendResponse = (response: ServiceWorkerResponse<unknown>) => void;
type MessageListener = (
  request: unknown,
  sender: unknown,
  sendResponse: SendResponse,
) => boolean | void;
type ChangedListener = (changes: Record<string, unknown>, area: string) => void;

interface ChromeMockState {
  localStore: Record<string, unknown>;
  sessionStore: Record<string, unknown>;
  messageListeners: MessageListener[];
  changedListeners: ChangedListener[];
}

function createChromeMock(token = ""): ChromeMockState {
  const state: ChromeMockState = {
    localStore: token ? { githubToken: token } : {},
    sessionStore: {},
    messageListeners: [],
    changedListeners: [],
  };

  const chromeMock = {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener: MessageListener) => {
          state.messageListeners.push(listener);
        }),
      },
      openOptionsPage: vi.fn(),
    },
    action: {
      onClicked: {
        addListener: vi.fn(),
      },
    },
    storage: {
      local: {
        get: vi.fn((keys: string | string[], callback: (result: Record<string, unknown>) => void) => {
          if (Array.isArray(keys)) {
            callback(Object.fromEntries(keys.map((key) => [key, state.localStore[key]])));
            return;
          }
          callback({ [keys]: state.localStore[keys] });
        }),
      },
      session: {
        get: vi.fn(async (keys: string | string[] | null) => {
          if (keys === null) return { ...state.sessionStore };
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map((key) => [key, state.sessionStore[key]]));
          }
          return { [keys]: state.sessionStore[keys] };
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(state.sessionStore, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete state.sessionStore[key];
          }
        }),
        clear: vi.fn(async () => {
          for (const key of Object.keys(state.sessionStore)) {
            delete state.sessionStore[key];
          }
        }),
      },
      onChanged: {
        addListener: vi.fn((listener: ChangedListener) => {
          state.changedListeners.push(listener);
        }),
      },
    },
  };

  vi.stubGlobal("chrome", chromeMock);
  return state;
}

async function loadWorker(token = ""): Promise<ChromeMockState> {
  const state = createChromeMock(token);
  await import("./service-worker");
  expect(state.messageListeners).toHaveLength(1);
  return state;
}

function sendMessage(
  listener: MessageListener,
  request: ServiceWorkerRequest,
): Promise<ServiceWorkerResponse<unknown>> {
  return new Promise((resolve) => {
    const keepAlive = listener(request, {}, resolve);
    expect(keepAlive).toBe(true);
  });
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    statusText: init.statusText,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("service worker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("coalesces concurrent requests and caches successful PR branch responses", async () => {
    const state = await loadWorker("token");
    const fetchDeferred = deferred<Response>();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockReturnValue(fetchDeferred.promise);

    const request: ServiceWorkerRequest = {
      type: "FETCH_PR_BRANCHES",
      owner: "owner",
      repo: "repo",
      state: "open",
      page: 1,
    };
    const first = sendMessage(state.messageListeners[0], request);
    const second = sendMessage(state.messageListeners[0], request);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchDeferred.resolve(jsonResponse([{ number: 7, head: { ref: "feature/a" } }]));

    expect(await first).toEqual({ ok: true, data: [{ number: 7, headRef: "feature/a" }] });
    expect(await second).toEqual({ ok: true, data: [{ number: 7, headRef: "feature/a" }] });
    expect(state.sessionStore["cache:branches:owner/repo:open:1"]).toMatchObject({
      data: [{ number: 7, headRef: "feature/a" }],
    });
  });

  it("returns fresh cached data without fetching", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000);
    const state = await loadWorker("token");
    state.sessionStore["cache:branches:owner/repo:open:1"] = {
      data: [{ number: 1, headRef: "cached" }],
      timestamp: 900,
    };

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_PR_BRANCHES",
      owner: "owner",
      repo: "repo",
      state: "open",
      page: 1,
    });

    expect(response).toEqual({ ok: true, data: [{ number: 1, headRef: "cached" }] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("expires stale cache entries before fetching", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10 * 60 * 1000);
    const state = await loadWorker("token");
    state.sessionStore["cache:branches:owner/repo:open:1"] = {
      data: [{ number: 1, headRef: "stale" }],
      timestamp: 0,
    };
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ number: 2, head: { ref: "fresh" } }]));

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_PR_BRANCHES",
      owner: "owner",
      repo: "repo",
      state: "open",
      page: 1,
    });

    expect(response).toEqual({ ok: true, data: [{ number: 2, headRef: "fresh" }] });
    expect(state.sessionStore["cache:branches:owner/repo:open:1"]).toMatchObject({
      data: [{ number: 2, headRef: "fresh" }],
    });
  });

  it("does not call GraphQL-backed endpoints without a token", async () => {
    const state = await loadWorker();

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_PR_DIFF_STATS",
      owner: "owner",
      repo: "repo",
      prNumbers: [1],
    });

    expect(response).toEqual({ ok: true, data: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to REST tags when GraphQL returns errors", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ errors: [{ message: "nope" }] }))
      .mockResolvedValueOnce(jsonResponse([{ name: "v1.0.0", commit: { sha: "abc" } }]));

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_REPO_TAGS",
      owner: "owner",
      repo: "repo",
    });

    expect(response).toEqual({ ok: true, data: [{ name: "v1.0.0", commitSha: "abc" }] });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      "https://api.github.com/repos/owner/repo/tags?per_page=100&page=1",
    );
  });

  it("clears review-status caches after approving a PR", async () => {
    const state = await loadWorker("token");
    state.sessionStore["cache:reviews:owner/repo:1,2"] = { data: [], timestamp: 1 };
    state.sessionStore["cache:branches:owner/repo:open:1"] = { data: [], timestamp: 1 };
    vi.mocked(fetch).mockResolvedValue(jsonResponse({}));

    const response = await sendMessage(state.messageListeners[0], {
      type: "APPROVE_PR",
      owner: "owner",
      repo: "repo",
      prNumber: 1,
      body: "Looks good",
    });
    await Promise.resolve();

    expect(response).toEqual({ ok: true, data: { success: true } });
    expect(state.sessionStore["cache:reviews:owner/repo:1,2"]).toBeUndefined();
    expect(state.sessionStore["cache:branches:owner/repo:open:1"]).toBeDefined();
  });

  it("clears session cache when the token changes", async () => {
    const state = await loadWorker("old-token");
    state.sessionStore["cache:branches:owner/repo:open:1"] = { data: [], timestamp: 1 };

    state.changedListeners[0]({ githubToken: { oldValue: "old-token", newValue: "new-token" } }, "local");

    expect(state.sessionStore).toEqual({});
  });

  it("keeps the session cache for non-token changes and other storage areas", async () => {
    const state = await loadWorker("token");
    state.sessionStore["cache:branches:owner/repo:open:1"] = { data: [], timestamp: 1 };

    // A feature toggle in local storage — not the token.
    state.changedListeners[0](
      { "feature-pr-branch-names": { oldValue: true, newValue: false } },
      "local",
    );
    // A token change, but in the sync area rather than local.
    state.changedListeners[0]({ githubToken: { oldValue: "token", newValue: "next" } }, "sync");

    expect(state.sessionStore["cache:branches:owner/repo:open:1"]).toBeDefined();
  });

  it("maps GraphQL review threads into counts plus unresolved-thread details", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: {
          repository: {
            pr_1: {
              reviewThreads: {
                totalCount: 3,
                nodes: [
                  { isResolved: true, isOutdated: false, path: "a.ts", line: 1, comments: { nodes: [{ author: { login: "alice" }, bodyText: "done", url: "u1" }] } },
                  { isResolved: true, isOutdated: false, path: "b.ts", line: 2, comments: { nodes: [{ author: { login: "bob" }, bodyText: "ok", url: "u2" }] } },
                  { isResolved: false, isOutdated: true, path: "src/c.ts", line: 42, comments: { nodes: [{ author: { login: "carol" }, bodyText: "needs a null check", url: "u3" }] } },
                ],
              },
            },
          },
        },
      }),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_PR_REVIEW_STATUSES",
      owner: "owner",
      repo: "repo",
      prNumbers: [1],
    });

    expect(response).toEqual({
      ok: true,
      data: [
        {
          number: 1,
          totalThreads: 3,
          resolvedThreads: 2,
          // Only the single unresolved thread is detailed; resolved ones are dropped.
          unresolved: [
            { path: "src/c.ts", line: 42, isOutdated: true, author: "carol", snippet: "needs a null check", url: "u3" },
          ],
        },
      ],
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("https://api.github.com/graphql");
  });

  it("tolerates threads with missing author / path / comments", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: {
          repository: {
            pr_1: {
              reviewThreads: {
                totalCount: 1,
                nodes: [
                  { isResolved: false, isOutdated: false, path: null, line: null, comments: { nodes: [{ author: null, bodyText: "", url: "" }] } },
                ],
              },
            },
          },
        },
      }),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_PR_REVIEW_STATUSES",
      owner: "owner",
      repo: "repo",
      prNumbers: [1],
    });

    expect(response).toEqual({
      ok: true,
      data: [
        {
          number: 1,
          totalThreads: 1,
          resolvedThreads: 0,
          unresolved: [{ path: "", line: null, isOutdated: false, author: "", snippet: "", url: "" }],
        },
      ],
    });
  });

  it("normalizes commit SHAs and parses GraphQL commit diff stats", async () => {
    const SHA = "0123456789abcdef0123456789abcdef01234567";
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: { repository: { [`c_${SHA}`]: { additions: 10, deletions: 2, changedFilesIfAvailable: 3 } } },
      }),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_COMMIT_DIFF_STATS",
      owner: "owner",
      repo: "repo",
      shas: [SHA.toUpperCase(), "not-a-sha"],
    });

    // Uppercase SHA is lowercased; the invalid one is filtered out before the query.
    expect(response).toEqual({
      ok: true,
      data: [{ sha: SHA, additions: 10, deletions: 2, changedFiles: 3 }],
    });
  });

  it("maps the stargazers REST payload", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        { user: { login: "octocat", avatar_url: "https://a/o.png", name: "Octo Cat" }, starred_at: "2026-01-01T00:00:00Z" },
        { user: { login: "mona", avatar_url: "https://a/m.png", name: null }, starred_at: "2026-01-02T00:00:00Z" },
      ]),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_STARGAZERS",
      owner: "owner",
      repo: "repo",
    });

    expect(response).toEqual({
      ok: true,
      data: [
        { login: "octocat", avatarUrl: "https://a/o.png", name: "Octo Cat", starredAt: "2026-01-01T00:00:00Z" },
        { login: "mona", avatarUrl: "https://a/m.png", name: null, starredAt: "2026-01-02T00:00:00Z" },
      ],
    });
  });

  it("maps the forks REST payload", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse([
        {
          owner: { login: "octocat", avatar_url: "https://a/o.png" },
          full_name: "octocat/repo",
          description: "a fork",
          stargazers_count: 5,
        },
      ]),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_FORKS",
      owner: "owner",
      repo: "repo",
    });

    expect(response).toEqual({
      ok: true,
      data: [
        { owner: "octocat", ownerAvatarUrl: "https://a/o.png", fullName: "octocat/repo", description: "a fork", stargazersCount: 5 },
      ],
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/repos/owner/repo/forks");
  });

  it("reads tag commit OIDs from the GraphQL refs response", async () => {
    const state = await loadWorker("token");
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({
        data: {
          repository: {
            refs: {
              nodes: [
                { name: "v2.0.0", target: { oid: "sha-lightweight" } },
                { name: "v1.0.0", target: { target: { oid: "sha-annotated" } } },
              ],
            },
          },
        },
      }),
    );

    const response = await sendMessage(state.messageListeners[0], {
      type: "FETCH_REPO_TAGS",
      owner: "owner",
      repo: "repo",
    });

    // Lightweight tags carry oid directly; annotated tags nest it under target.target.
    expect(response).toEqual({
      ok: true,
      data: [
        { name: "v2.0.0", commitSha: "sha-lightweight" },
        { name: "v1.0.0", commitSha: "sha-annotated" },
      ],
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
