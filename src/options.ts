import { t, localizePage, initLocale, setLocale, LOCALE_KEY, type LocalePref } from "./lib/i18n";

const langSelect = document.getElementById("langSelect") as HTMLSelectElement | null;

// Resolve the stored locale preference, reflect it in the picker, then localize.
initLocale().then((pref) => {
  if (langSelect) langSelect.value = pref;
  localizePage();
});

// Manual override: persist the choice and re-localize the page in place.
langSelect?.addEventListener("change", () => {
  const pref = langSelect.value as LocalePref;
  chrome.storage.local.set({ [LOCALE_KEY]: pref });
  setLocale(pref);
  localizePage();
});

const tokenInput = document.getElementById("token") as HTMLInputElement;
const tokenStatus = document.getElementById("tokenStatus") as HTMLDivElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
// Not named `status`: as a top-level script var that would shadow the DOM
// global `window.status` (a string), breaking `.className`/`.textContent`.
const statusEl = document.getElementById("status") as HTMLDivElement;

interface StoredSettings {
  githubToken?: string;
  [feature: string]: string | boolean | undefined;
}

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

// --- Load saved settings ---
chrome.storage.local.get<StoredSettings>(["githubToken", ...FEATURE_KEYS], (result) => {
  if (result.githubToken) {
    tokenInput.value = result.githubToken;
  }
  for (const key of FEATURE_KEYS) {
    const checkbox = document.getElementById(key) as HTMLInputElement;
    checkbox.checked = result[key] !== false;
  }
});

// --- Token validation on blur ---
let lastValidatedToken = "";

async function validateToken(token: string) {
  if (!token) {
    tokenStatus.className = "token-status";
    tokenStatus.textContent = "";
    return;
  }
  if (token === lastValidatedToken) return;

  tokenStatus.className = "token-status checking";
  tokenStatus.textContent = t("validatingToken");

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const user = await response.json();
      tokenStatus.className = "token-status valid";
      tokenStatus.textContent = t("tokenValid", user.login);
      lastValidatedToken = token;
    } else if (response.status === 401) {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = t("tokenInvalid");
      lastValidatedToken = "";
    } else {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = t("tokenValidationFailed", String(response.status));
      lastValidatedToken = "";
    }
  } catch {
    tokenStatus.className = "token-status invalid";
    tokenStatus.textContent = t("tokenNetworkError");
    lastValidatedToken = "";
  }
}

tokenInput.addEventListener("blur", () => {
  validateToken(tokenInput.value.trim());
});

// --- Save button ---
let statusTimer: number | undefined;

function showStatus(kind: "success" | "error", message: string) {
  statusEl.className = `status ${kind}`;
  statusEl.textContent = message;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    statusEl.className = "status";
    statusEl.textContent = "";
  }, 2000);
}

saveBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  const settings: Record<string, string | boolean> = { githubToken: token };

  for (const key of FEATURE_KEYS) {
    const checkbox = document.getElementById(key) as HTMLInputElement;
    settings[key] = checkbox.checked;
  }

  chrome.storage.local.set(settings, () => {
    if (chrome.runtime.lastError) {
      showStatus("error", chrome.runtime.lastError.message ?? t("saveFailed"));
    } else {
      showStatus("success", t("saved"));
    }
  });
});

// --- Auto-save feature toggles on change ---
for (const key of FEATURE_KEYS) {
  const checkbox = document.getElementById(key) as HTMLInputElement;
  checkbox.addEventListener("change", () => {
    chrome.storage.local.set({ [key]: checkbox.checked });
  });
}

// --- Footer version ---
const footer = document.getElementById("footer") as HTMLDivElement;
const version = chrome.runtime.getManifest().version;
footer.innerHTML = `Better GitHub v${version} · <a href="https://github.com/rrbe/better-github" target="_blank">GitHub</a>`;

// --- Feature search ---
const searchBtn = document.getElementById("searchBtn") as HTMLButtonElement;
const searchBar = document.getElementById("searchBar") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const searchClose = document.getElementById("searchClose") as HTMLButtonElement;
const featureGroups = document.querySelectorAll<HTMLDetailsElement>(".feature-group");

function openSearch() {
  searchBar.classList.add("visible");
  searchBtn.style.display = "none";
  featureGroups.forEach((g) => g.setAttribute("open", ""));
  searchInput.focus();
}

function closeSearch() {
  searchBar.classList.remove("visible");
  searchBtn.style.display = "";
  searchInput.value = "";
  filterFeatures("");
  // Restore default collapsed state: only first group open
  featureGroups.forEach((g, i) => {
    if (i === 0) g.setAttribute("open", "");
    else g.removeAttribute("open");
  });
}

function filterFeatures(query: string) {
  const q = query.toLowerCase();
  featureGroups.forEach((group) => {
    const items = group.querySelectorAll<HTMLLIElement>(".feature-item");
    let anyVisible = false;
    items.forEach((item) => {
      const name = item.querySelector(".feature-name")?.textContent ?? "";
      const match = !q || name.toLowerCase().includes(q);
      item.style.display = match ? "" : "none";
      if (match) anyVisible = true;
    });
    group.style.display = anyVisible ? "" : "none";
  });
}

searchBtn.addEventListener("click", openSearch);
searchClose.addEventListener("click", closeSearch);
searchInput.addEventListener("input", () => filterFeatures(searchInput.value));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSearch();
});

// Marks this entry script as an ES module so tests can `import()` it; emits no
// runtime code.
export {};
