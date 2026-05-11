// Runs at document_start — before page renders, so no visible flicker.
// Handles early redirects that must happen before the page renders.
// Respects the feature toggles in storage.
import { applyPageMarker } from "./lib/page-marker";

(function () {
  const path = location.pathname;

  // Stamp <html data-bg-page> synchronously so skeleton-reserve.css (loaded
  // in the same document_start content_script) can pre-reserve info-row
  // height before the body parses.
  applyPageMarker();

  // --- Default sort for PR/issue lists ---
  if (!/^\/[^/]+\/[^/]+\/(pulls|issues)\/?$/.test(path)) return;

  const params = new URLSearchParams(location.search);
  const q = params.get("q");

  // Already has a sort qualifier — nothing to do
  if (q && /sort:/i.test(q)) return;

  // Check if the feature is enabled before redirecting
  chrome.storage.local.get("feature-default-sort", (result) => {
    if (result["feature-default-sort"] === false) return;

    const currentParams = new URLSearchParams(location.search);
    const currentQ = currentParams.get("q");

    // Re-check after async — page may have navigated
    if (currentQ && /sort:/i.test(currentQ)) return;

    if (!currentQ) {
      const isIssues = /\/issues\/?$/.test(location.pathname);
      const base = isIssues ? "is:issue is:open" : "is:pr is:open";
      currentParams.set("q", `${base} sort:updated-desc `);
    } else {
      currentParams.set("q", `${currentQ} sort:updated-desc `);
    }

    location.replace(`${location.pathname}?${currentParams.toString()}`);
  });
})();
