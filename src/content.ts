import { onPageReady, startNavigation } from "./lib/navigation";
import { injectPRBranchNames } from "./features/pr-branch-names";
import { injectPRReviewStatus } from "./features/pr-review-status";
import { injectPRDiffStats } from "./features/pr-diff-stats";
import { injectReleasesTab } from "./features/release-tab";
import { injectPRLabelPosition, cleanupPRLabelPosition } from "./features/pr-label-position";
import { injectFileAgeColor } from "./features/file-age-color";
import { injectPRApproveNow } from "./features/pr-approve-now";
import { applyDefaultSort } from "./features/default-sort";
import { injectCommitTags } from "./features/commit-tags";
import { injectCommitDiffStats } from "./features/commit-diff-stats";
import { injectBetterTopRepos } from "./features/better-top-repos";
import { injectWatchForkStarPopup } from "./features/watch-fork-star-popup";
import { injectPRCollapseExpand } from "./features/pr-collapse-expand";
import { reserveInfoRowSkeletons } from "./lib/info-row-skeleton";
import { applyPageMarker } from "./lib/page-marker";

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
] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

// CSS classes used by each feature's injected elements
const FEATURE_CLASSES: Record<FeatureKey, string[]> = {
  "feature-pr-branch-names": ["better-github-branch-badge", "bg-skeleton-pill--branch"],
  "feature-pr-review-status": ["better-github-review-status"],
  "feature-pr-diff-stats": ["better-github-diff-stats", "bg-skeleton-pill--pr-diff"],
  "feature-release-tab": ["better-github-releases-tab"],
  "feature-pr-label-position": ["better-github-label-prefix"],
  "feature-pr-approve-now": ["better-github-approve-now", "better-github-approve-dialog-overlay"],
  "feature-default-sort": [],
  "feature-commit-tags": ["better-github-commit-tag"],
  "feature-commit-diff-stats": ["better-github-commit-diff-stats", "bg-skeleton-pill--commit-diff"],
  "feature-better-top-repos": [],
  "feature-watch-fork-star-popup": ["bg-wfs-counter-wrap"],
  "feature-pr-collapse-expand": ["better-github-toggle-tree", "better-github-collapse-expand"],
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
    case "feature-pr-diff-stats":
      injectPRDiffStats();
      break;
    case "feature-release-tab":
      injectReleasesTab();
      break;
    case "feature-pr-label-position":
      injectPRLabelPosition();
      break;
    case "feature-pr-approve-now":
      injectPRApproveNow();
      break;
    case "feature-default-sort":
      applyDefaultSort();
      break;
    case "feature-commit-tags":
      injectCommitTags();
      break;
    case "feature-commit-diff-stats":
      injectCommitDiffStats();
      break;
    case "feature-better-top-repos":
      injectBetterTopRepos();
      break;
    case "feature-watch-fork-star-popup":
      injectWatchForkStarPopup();
      break;
    case "feature-pr-collapse-expand":
      injectPRCollapseExpand();
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
  // Keep <html data-bg-page> in sync with the current URL so
  // skeleton-reserve.css matches the right row selector after SPA navs.
  applyPageMarker();

  // Always-on features
  injectFileAgeColor();

  // Toggleable features
  const flags = await getFeatureFlags();

  // Reserve row height with skeleton placeholders before any async fetch starts
  // — avoids layout-shift "flash" when real badges arrive.
  reserveInfoRowSkeletons(flags);

  for (const key of FEATURE_KEYS) {
    if (flags[key]) {
      injectFeature(key);
    }
  }
});

startNavigation();
