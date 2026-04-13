import { isDashboardPage } from "../lib/page-detect";

const CLICKED_ATTR = "data-better-github-expanded";

export function injectDashboardTopRepos(): void {
  if (!isDashboardPage()) return;

  const showMoreBtn = document.querySelector<HTMLElement>(
    '[data-testid="dynamic-side-panel-items-show-more"]',
  );
  if (!showMoreBtn) return;
  if (showMoreBtn.hasAttribute(CLICKED_ATTR)) return;

  showMoreBtn.setAttribute(CLICKED_ATTR, "true");
  showMoreBtn.click();
}
