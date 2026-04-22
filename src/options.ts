const tokenInput = document.getElementById("token") as HTMLInputElement;
const tokenStatus = document.getElementById("tokenStatus") as HTMLDivElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;

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
] as const;

// --- Load saved settings ---
chrome.storage.local.get(["githubToken", ...FEATURE_KEYS], (result) => {
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
  tokenStatus.textContent = "Validating token…";

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const user = await response.json();
      tokenStatus.className = "token-status valid";
      tokenStatus.textContent = `Valid — authenticated as ${user.login}`;
      lastValidatedToken = token;
    } else if (response.status === 401) {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = "Invalid token — authentication failed";
      lastValidatedToken = "";
    } else {
      tokenStatus.className = "token-status invalid";
      tokenStatus.textContent = `Validation failed (HTTP ${response.status})`;
      lastValidatedToken = "";
    }
  } catch {
    tokenStatus.className = "token-status invalid";
    tokenStatus.textContent = "Network error — could not reach GitHub API";
    lastValidatedToken = "";
  }
}

tokenInput.addEventListener("blur", () => {
  validateToken(tokenInput.value.trim());
});

// --- Save button ---
saveBtn.addEventListener("click", () => {
  const token = tokenInput.value.trim();
  const settings: Record<string, string | boolean> = { githubToken: token };

  for (const key of FEATURE_KEYS) {
    const checkbox = document.getElementById(key) as HTMLInputElement;
    settings[key] = checkbox.checked;
  }

  chrome.storage.local.set(settings, () => {
    status.style.display = "block";
    setTimeout(() => {
      status.style.display = "none";
    }, 2000);
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
