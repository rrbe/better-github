// Runs at document_start — before page renders, so no visible flicker.
// Redirects PR/issue list pages to include sort:updated-desc when missing.
// Respects the feature toggle in storage.
(function () {
  const path = location.pathname;
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
      currentParams.set("q", `${base} sort:updated-desc`);
    } else {
      currentParams.set("q", `${currentQ} sort:updated-desc`);
    }

    location.replace(`${location.pathname}?${currentParams.toString()}`);
  });
})();
