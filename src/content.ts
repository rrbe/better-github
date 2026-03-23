import { onPageReady, startNavigation } from "./lib/navigation";
import { injectPRBranchNames } from "./features/pr-branch-names";
import { injectPRReviewStatus } from "./features/pr-review-status";
import { injectReleasesTab } from "./features/release-tab";
import { injectPRLabelPosition, cleanupPRLabelPosition } from "./features/pr-label-position";
import { injectFileAgeColor } from "./features/file-age-color";

const FEATURE_KEYS = [
  "feature-pr-branch-names",
  "feature-pr-review-status",
  "feature-release-tab",
  "feature-pr-label-position",
] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

// CSS classes used by each feature's injected elements
const FEATURE_CLASSES: Record<FeatureKey, string[]> = {
  "feature-pr-branch-names": ["better-github-branch-badge"],
  "feature-pr-review-status": ["better-github-review-status"],
  "feature-release-tab": ["better-github-releases-tab"],
  "feature-pr-label-position": ["better-github-label-prefix"],
};

function isExtensionValid(): boolean {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

function getFeatureFlags(): Promise<Record<FeatureKey, boolean>> {
  return new Promise((resolve) => {
    if (!isExtensionValid()) {
      // Extension context invalidated — default all to enabled
      const flags = {} as Record<FeatureKey, boolean>;
      for (const key of FEATURE_KEYS) flags[key] = true;
      return resolve(flags);
    }
    chrome.storage.local.get([...FEATURE_KEYS], (result) => {
      const flags = {} as Record<FeatureKey, boolean>;
      for (const key of FEATURE_KEYS) {
        flags[key] = result[key] !== false;
      }
      resolve(flags);
    });
  });
}

function removeFeatureElements(key: FeatureKey): void {
  for (const cls of FEATURE_CLASSES[key]) {
    document.querySelectorAll(`.${cls}`).forEach((el) => el.remove());
  }
}

function injectFeature(key: FeatureKey): void {
  switch (key) {
    case "feature-pr-branch-names":
      injectPRBranchNames();
      break;
    case "feature-pr-review-status":
      injectPRReviewStatus();
      break;
    case "feature-release-tab":
      injectReleasesTab();
      break;
    case "feature-pr-label-position":
      injectPRLabelPosition();
      break;
  }
}

// React to toggle changes in real-time (no refresh needed)
if (isExtensionValid()) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    for (const key of FEATURE_KEYS) {
      if (!(key in changes)) continue;
      const enabled = changes[key].newValue !== false;
      if (enabled) {
        injectFeature(key);
      } else {
        if (key === "feature-pr-label-position") {
          cleanupPRLabelPosition();
        }
        removeFeatureElements(key);
      }
    }
  });
}

// On each navigation, inject enabled features
onPageReady(async () => {
  // Always-on features
  injectFileAgeColor();

  // Toggleable features
  const flags = await getFeatureFlags();
  for (const key of FEATURE_KEYS) {
    if (flags[key]) {
      injectFeature(key);
    }
  }
});

startNavigation();
