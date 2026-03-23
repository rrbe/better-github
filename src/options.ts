const tokenInput = document.getElementById("token") as HTMLInputElement;
const tokenStatus = document.getElementById("tokenStatus") as HTMLDivElement;
const saveBtn = document.getElementById("save") as HTMLButtonElement;
const status = document.getElementById("status") as HTMLDivElement;

const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-review-status",
  "feature-release-tab",
] as const;

// --- Load saved settings ---
chrome.storage.local.get(["githubToken", ...FEATURE_KEYS], (result) => {
  if (result.githubToken) {
    tokenInput.value = result.githubToken;
  }
  for (const key of FEATURE_KEYS) {
    const checkbox = document.getElementById(key) as HTMLInputElement;
    // Default to enabled if not explicitly set
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
