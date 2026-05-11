/**
 * Page-type marker on `<html data-bg-page>`. Read by `skeleton-reserve.css`
 * (loaded at document_start) to pre-reserve info-row height before GitHub
 * paints — so the row that content.js mounts at document_idle no longer
 * pushes everything down.
 *
 * Must stay sync-friendly: called from early-sort-redirect.ts at
 * document_start, and from content.ts on every SPA navigation.
 */

export type PageMarker = "pr-list" | "commits-list";

export function detectPageMarker(path: string): PageMarker | null {
  // Mirror isPRListPage / isCommitsListPage in page-detect.ts so the CSS
  // reservation only kicks in where the corresponding feature actually runs.
  if (/^\/[^/]+\/[^/]+\/pulls\/?$/.test(path)) return "pr-list";
  if (/^\/[^/]+\/[^/]+\/commits(\/|$)/.test(path)) return "commits-list";
  return null;
}

export function applyPageMarker(): void {
  const marker = detectPageMarker(location.pathname);
  const root = document.documentElement;
  if (marker) {
    if (root.dataset.bgPage !== marker) root.dataset.bgPage = marker;
  } else if (root.dataset.bgPage) {
    delete root.dataset.bgPage;
  }
}
