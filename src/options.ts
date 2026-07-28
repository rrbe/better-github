import { t, localizePage, initLocale, setLocale, LOCALE_KEY, type LocalePref } from "./lib/i18n";

const langSelect = document.getElementById("langSelect") as HTMLSelectElement | null;

// Resolve the stored locale preference, reflect it in the picker, then localize.
const localeReady = initLocale().then((pref) => {
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

interface StoredSettings {
  githubToken?: string;
  [feature: string]: string | boolean | undefined;
}

const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-conflict-indicator",
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

let storedToken = "";

// --- Load saved settings ---
chrome.storage.local.get<StoredSettings>(["githubToken", ...FEATURE_KEYS], (result) => {
  if (result.githubToken) {
    storedToken = result.githubToken.trim();
    tokenInput.value = storedToken;
    localeReady.then(() => validateToken(storedToken, { invalidMessageKey: "tokenStoredInvalid" }));
  }
  for (const key of FEATURE_KEYS) {
    const checkbox = document.getElementById(key) as HTMLInputElement;
    checkbox.checked = result[key] !== false;
  }
});

// --- Token validation and auto-save ---
let lastValidatedToken = "";
let validationRun = 0;
let tokenValidationTimer: number | undefined;

interface TokenValidationOptions {
  shouldPersist?: boolean;
  invalidMessageKey?: "tokenInvalid" | "tokenStoredInvalid";
}

function renderValidTokenStatus(user: string, expiration: string | null) {
  const expirationDate = expiration?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
  const expirationText = expirationDate
    ? t("tokenExpirationDate", expirationDate)
    : t("tokenExpirationNone");
  tokenStatus.className = "token-status valid";
  tokenStatus.textContent = t("tokenValid", [user, expirationText]);
}

function persistToken(token: string, run: number) {
  if (token === storedToken) return;

  chrome.storage.local.set({ githubToken: token }, () => {
    if (run !== validationRun) return;
    if (chrome.runtime.lastError) {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = chrome.runtime.lastError.message ?? t("saveFailed");
      lastValidatedToken = "";
      return;
    }
    storedToken = token;
  });
}

async function validateToken(
  token: string,
  { shouldPersist = false, invalidMessageKey = "tokenInvalid" }: TokenValidationOptions = {},
) {
  const run = ++validationRun;
  if (!token) {
    tokenStatus.className = "token-status";
    tokenStatus.textContent = "";
    lastValidatedToken = "";
    if (shouldPersist) persistToken("", run);
    return;
  }
  if (token === lastValidatedToken) {
    if (shouldPersist) persistToken(token, run);
    return;
  }

  tokenStatus.className = "token-status checking";
  tokenStatus.textContent = t("validatingToken");

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (run !== validationRun) return;

    if (response.ok) {
      const user = await response.json();
      if (run !== validationRun) return;
      renderValidTokenStatus(
        user.login,
        response.headers.get("GitHub-Authentication-Token-Expiration")?.trim() || null,
      );
      lastValidatedToken = token;
      if (shouldPersist) persistToken(token, run);
    } else if (response.status === 401) {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = t(invalidMessageKey);
      lastValidatedToken = "";
    } else {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = t("tokenValidationFailed", String(response.status));
      lastValidatedToken = "";
    }
  } catch {
    if (run !== validationRun) return;
    tokenStatus.className = "token-status invalid";
    tokenStatus.textContent = t("tokenNetworkError");
    lastValidatedToken = "";
  }
}

function scheduleTokenValidation() {
  if (tokenValidationTimer) clearTimeout(tokenValidationTimer);
  tokenValidationTimer = window.setTimeout(() => {
    validateToken(tokenInput.value.trim(), { shouldPersist: true });
  }, 600);
}

tokenInput.addEventListener("input", scheduleTokenValidation);
tokenInput.addEventListener("blur", () => {
  if (tokenValidationTimer) {
    clearTimeout(tokenValidationTimer);
    tokenValidationTimer = undefined;
  }
  validateToken(tokenInput.value.trim(), { shouldPersist: true });
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
