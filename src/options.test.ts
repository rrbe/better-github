import { afterEach, describe, expect, it, vi } from "vitest";

const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-review-status",
  "feature-pr-diff-stats",
  "feature-release-tab",
  "feature-pr-label-position",
  "feature-pr-approve-now",
  "feature-default-sort",
  "feature-commit-tags",
  "feature-commit-diff-stats",
  "feature-better-top-repos",
  "feature-watch-fork-star-popup",
  "feature-pr-collapse-expand",
  "feature-contributor-card",
] as const;

interface ChromeStub {
  store: Record<string, unknown>;
  set: ReturnType<typeof vi.fn>;
  lastError?: { message: string };
}

function buildDom(): void {
  const checkboxes = FEATURE_KEYS.map((k) => `<input type="checkbox" id="${k}" />`).join("");
  document.body.innerHTML = `
    <input type="password" id="token" />
    <div id="tokenStatus" class="token-status"></div>
    <button id="searchBtn"></button>
    <div id="searchBar" class="search-bar"></div>
    <input type="text" id="searchInput" />
    <button id="searchClose"></button>
    <div id="footer"></div>
    ${checkboxes}
    <details class="feature-group" open>
      <li class="feature-item"><div class="feature-name">Better Top Repositories</div></li>
    </details>
    <details class="feature-group">
      <li class="feature-item"><div class="feature-name">Default Sort</div></li>
    </details>
  `;
}

function stubChrome(store: Record<string, unknown> = {}): ChromeStub {
  const stub: ChromeStub = {
    store,
    lastError: undefined,
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      Object.assign(store, items);
      cb?.();
    }),
  };
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn((_keys: string[], cb: (r: Record<string, unknown>) => void) => cb(store)),
        set: stub.set,
      },
    },
    runtime: {
      getManifest: () => ({ version: "9.9.9" }),
      get lastError() {
        return stub.lastError;
      },
    },
  });
  return stub;
}

async function loadOptions(store: Record<string, unknown> = {}): Promise<ChromeStub> {
  const stub = stubChrome(store);
  buildDom();
  vi.resetModules();
  await import("./options");
  return stub;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

describe("options page", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("reflects stored settings and validates a stored token on load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "octocat" }), {
          status: 200,
          headers: { "GitHub-Authentication-Token-Expiration": "2026-07-08 12:00:00 UTC" },
        }),
      ),
    );

    await loadOptions({ githubToken: "ghp_abc", "feature-default-sort": false });

    expect($<HTMLInputElement>("token").value).toBe("ghp_abc");
    // Absent flag defaults to enabled; an explicit false renders unchecked.
    expect($<HTMLInputElement>("feature-pr-branch-names").checked).toBe(true);
    expect($<HTMLInputElement>("feature-default-sort").checked).toBe(false);
    expect($("footer").innerHTML).toContain("9.9.9");
    await vi.waitFor(() =>
      expect($("tokenStatus").textContent).toBe("Saved — octocat · expires 2026-07-08"),
    );
  });

  it("shows stored invalid token copy without clearing the saved token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const chrome = await loadOptions({ githubToken: "ghp_revoked" });

    await vi.waitFor(() =>
      expect($("tokenStatus").textContent).toBe(
        "Saved token is invalid — update it to keep token-only features working",
      ),
    );
    expect($<HTMLInputElement>("token").value).toBe("ghp_revoked");
    expect(chrome.store.githubToken).toBe("ghp_revoked");
    expect(chrome.set).not.toHaveBeenCalled();
  });

  it("auto-saves a single flag when its checkbox is toggled", async () => {
    const chrome = await loadOptions({});
    const box = $<HTMLInputElement>("feature-release-tab");

    box.checked = false;
    box.dispatchEvent(new Event("change"));

    expect(chrome.set).toHaveBeenCalledWith({ "feature-release-tab": false });
  });

  it("auto-saves a valid token after input validation", async () => {
    vi.useFakeTimers();
    const chrome = await loadOptions({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "octocat" }), {
          status: 200,
          headers: { "GitHub-Authentication-Token-Expiration": "2026-07-08 12:00:00 UTC" },
        }),
      ),
    );

    const token = $<HTMLInputElement>("token");
    token.value = "  ghp_valid  ";
    token.dispatchEvent(new Event("input"));
    await vi.advanceTimersByTimeAsync(600);

    await vi.waitFor(() =>
      expect(chrome.set).toHaveBeenCalledWith({ githubToken: "ghp_valid" }, expect.any(Function)),
    );
    expect($("tokenStatus").textContent).toBe("Saved — octocat · expires 2026-07-08");
  });

  it("filters feature items and hides groups with no match while searching", async () => {
    await loadOptions({});
    const input = $<HTMLInputElement>("searchInput");

    input.value = "top";
    input.dispatchEvent(new Event("input"));

    const groups = document.querySelectorAll<HTMLElement>(".feature-group");
    const items = document.querySelectorAll<HTMLElement>(".feature-item");
    // "Better Top Repositories" matches; "Default Sort" does not.
    expect(items[0].style.display).toBe("");
    expect(items[1].style.display).toBe("none");
    expect(groups[1].style.display).toBe("none");
  });

  it("validates the token against the GitHub API on blur", async () => {
    const chrome = await loadOptions({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "octocat" }), {
          status: 200,
          headers: { "GitHub-Authentication-Token-Expiration": "2026-07-08 12:00:00 UTC" },
        }),
      ),
    );

    const token = $<HTMLInputElement>("token");
    token.value = "ghp_valid";
    token.dispatchEvent(new Event("blur"));
    await vi.waitFor(() =>
      expect($("tokenStatus").textContent).toBe("Saved — octocat · expires 2026-07-08"),
    );
    expect($("tokenStatus").className).toContain("valid");
    expect(chrome.set).toHaveBeenCalledWith({ githubToken: "ghp_valid" }, expect.any(Function));
  });
});
