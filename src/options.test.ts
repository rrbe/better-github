import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-review-status",
  "feature-pr-diff-stats",
  "feature-release-tab",
  "feature-release-downloads-count",
  "feature-pr-label-position",
  "feature-pr-approve-now",
  "feature-default-sort",
  "feature-commit-tags",
  "feature-commit-diff-stats",
  "feature-better-top-repos",
  "feature-watch-fork-star-popup",
  "feature-pr-collapse-expand",
] as const;

interface ChromeStub {
  store: Record<string, unknown>;
  set: ReturnType<typeof vi.fn>;
  lastError?: { message: string };
}

function buildDom(): void {
  const checkboxes = FEATURE_KEYS.map(
    (k) => `<input type="checkbox" id="${k}" />`,
  ).join("");
  document.body.innerHTML = `
    <input type="password" id="token" />
    <div id="tokenStatus" class="token-status"></div>
    <button id="save">Save</button>
    <div class="status" id="status"></div>
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("reflects stored settings into the form on load", async () => {
    await loadOptions({ githubToken: "ghp_abc", "feature-default-sort": false });

    expect($<HTMLInputElement>("token").value).toBe("ghp_abc");
    // Absent flag defaults to enabled; an explicit false renders unchecked.
    expect($<HTMLInputElement>("feature-pr-branch-names").checked).toBe(true);
    expect($<HTMLInputElement>("feature-default-sort").checked).toBe(false);
    expect($("footer").innerHTML).toContain("9.9.9");
  });

  it("persists the token and every flag when Save is clicked", async () => {
    const chrome = await loadOptions({});
    $<HTMLInputElement>("token").value = "  ghp_new  ";
    $<HTMLInputElement>("feature-commit-tags").checked = false;

    $("save").click();

    expect(chrome.set).toHaveBeenCalledTimes(1);
    const saved = chrome.set.mock.calls[0][0] as Record<string, unknown>;
    expect(saved.githubToken).toBe("ghp_new"); // trimmed
    expect(saved["feature-commit-tags"]).toBe(false);
    expect(saved["feature-pr-branch-names"]).toBe(true);
    expect($("status").textContent).toBe("Saved!");
  });

  it("surfaces a storage error from Save", async () => {
    const chrome = await loadOptions({});
    chrome.lastError = { message: "quota exceeded" };

    $("save").click();

    expect($("status").textContent).toBe("quota exceeded");
    expect($("status").className).toContain("error");
  });

  it("auto-saves a single flag when its checkbox is toggled", async () => {
    const chrome = await loadOptions({});
    const box = $<HTMLInputElement>("feature-release-tab");

    box.checked = false;
    box.dispatchEvent(new Event("change"));

    expect(chrome.set).toHaveBeenCalledWith({ "feature-release-tab": false });
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
    await loadOptions({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ login: "octocat" }), { status: 200 }),
      ),
    );

    const token = $<HTMLInputElement>("token");
    token.value = "ghp_valid";
    token.dispatchEvent(new Event("blur"));
    await vi.waitFor(() =>
      expect($("tokenStatus").textContent).toBe("Valid — authenticated as octocat"),
    );
    expect($("tokenStatus").className).toContain("valid");
  });
});
