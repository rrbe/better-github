// Commits list DOM helpers shared between commit-tags and commit-diff-stats.

// Covers both classic GitHub DOM (<li>) and new React DOM (div.TimelineItem-body / div[data-testid]).
export const COMMIT_ROW_SELECTOR = "li, div.TimelineItem-body, div[data-testid]";

// Hashed CSS-module class on new GitHub's commit-row inner content wrapper.
export const MAIN_CONTENT_INNER_SELECTOR = "[class*='MainContent-module__inner']";

export function collectCommitRows(owner: string, repo: string): Map<string, Element> {
  const pattern = new RegExp(`^/${owner}/${repo}/commit/([0-9a-f]{40})$`, "i");
  const result = new Map<string, Element>();
  const links = document.querySelectorAll<HTMLAnchorElement>("a[href*='/commit/']");
  for (const link of links) {
    const match = link.pathname.match(pattern);
    if (!match) continue;
    const sha = match[1].toLowerCase();
    if (result.has(sha)) continue;
    const container = link.closest(COMMIT_ROW_SELECTOR) || link.parentElement;
    if (!container) continue;
    result.set(sha, container);
  }
  return result;
}
