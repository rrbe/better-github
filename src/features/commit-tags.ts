import { isCommitsListPage, getRepoInfo } from "../lib/page-detect";
import { fetchRepoTags } from "../lib/github-api";
import { escapeHtml } from "../lib/utils";

const TAG_CLASS = "better-github-commit-tag";
const TAG_ROW_CLASS = "better-github-commit-tag-row";

const TAG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink:0"><path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z"></path></svg>`;

export async function injectCommitTags(): Promise<void> {
  if (!isCommitsListPage()) return;

  const info = getRepoInfo();
  if (!info) return;

  if (document.querySelectorAll(`.${TAG_CLASS}`).length > 0) return;

  const tags = await fetchRepoTags(info.owner, info.repo);
  if (tags.length === 0) return;

  const tagMap = new Map<string, string[]>();
  for (const tag of tags) {
    const existing = tagMap.get(tag.commitSha);
    if (existing) {
      existing.push(tag.name);
    } else {
      tagMap.set(tag.commitSha, [tag.name]);
    }
  }

  const commitPattern = new RegExp(`^/${info.owner}/${info.repo}/commit/([0-9a-f]+)$`, "i");

  // Find all commit SHA links on the page
  const links = document.querySelectorAll<HTMLAnchorElement>("a[href*='/commit/']");

  for (const link of links) {
    const href = new URL(link.href).pathname;
    const match = href.match(commitPattern);
    if (!match) continue;

    const sha = match[1];
    const tagNames = tagMap.get(sha);
    if (!tagNames) continue;

    // Find the parent container of the SHA link to insert tag badges
    const container = link.closest("li, div.TimelineItem-body, div[data-testid]") || link.parentElement;
    if (!container) continue;

    // Skip if tags already injected in this container
    if (container.querySelector(`.${TAG_CLASS}`)) continue;

    // Create a tag row inside the MainContent inner area (below author/date line)
    const mainInner = container.querySelector<HTMLElement>("[class*='MainContent-module__inner']");
    const tagParent = mainInner || container;

    let tagRow = tagParent.querySelector<HTMLElement>(`.${TAG_ROW_CLASS}`);
    if (!tagRow) {
      tagRow = document.createElement("div");
      tagRow.className = TAG_ROW_CLASS;
      tagParent.appendChild(tagRow);
    }

    for (const tagName of tagNames) {
      const badge = document.createElement("a");
      badge.className = TAG_CLASS;
      badge.href = `/${info.owner}/${info.repo}/releases/tag/${encodeURIComponent(tagName)}`;
      badge.title = `Tag: ${tagName}`;
      badge.innerHTML = `${TAG_ICON}<span>${escapeHtml(tagName)}</span>`;
      tagRow.appendChild(badge);
    }
  }
}

