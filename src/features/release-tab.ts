import { isRepoPage, getRepoInfo, isReleasesPage } from "../lib/page-detect";
import { t } from "../lib/i18n";

const TAB_CLASS = "better-github-releases-tab";

// GitHub's native tag icon (Octicon tag-16) — the same thin line-art octicon
// GitHub uses for Releases, so it matches the rest of the UnderlineNav icons.
// Use the `octicon octicon-tag` class pattern like the native nav icons, NOT
// `UnderlineNav-octicon`: that class adds its own `margin-right: 8px`, which
// would stack on top of the link's flex `gap` and double the icon→text spacing.
const TAG_ICON_SVG = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor" class="octicon octicon-tag">
  <path d="M1 7.775V2.75C1 1.784 1.784 1 2.75 1h5.025c.464 0 .91.184 1.238.513l6.25 6.25a1.75 1.75 0 0 1 0 2.474l-5.026 5.026a1.75 1.75 0 0 1-2.474 0l-6.25-6.25A1.752 1.752 0 0 1 1 7.775Zm1.5 0c0 .066.026.13.073.177l6.25 6.25a.25.25 0 0 0 .354 0l5.025-5.025a.25.25 0 0 0 0-.354l-6.25-6.25a.25.25 0 0 0-.177-.073H2.75a.25.25 0 0 0-.25.25ZM6 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"></path>
</svg>`;

export function injectReleasesTab(): void {
  if (!isRepoPage()) return;
  if (document.querySelector(`.${TAB_CLASS}`)) return;

  const info = getRepoInfo();
  if (!info) return;

  // Find the repo navigation bar
  const nav =
    document.querySelector<HTMLElement>(".UnderlineNav-body") ||
    document.querySelector<HTMLElement>("nav[aria-label='Repository'] ul");

  if (!nav) return;

  // Check if Releases tab already exists natively
  const links = nav.querySelectorAll("a");
  for (const link of links) {
    if (link.textContent?.includes("Releases")) return;
  }

  // Find a reference tab to clone structure from (prefer one without counter like "Actions")
  const refTab = findReferenceTab(nav);
  if (!refTab) return;

  const releasesTab = refTab.cloneNode(true) as HTMLElement;
  releasesTab.classList.add(TAB_CLASS);

  // Fix the link
  const link =
    releasesTab.tagName === "A"
      ? (releasesTab as HTMLAnchorElement)
      : releasesTab.querySelector("a");

  if (!link) return;

  link.href = `/${info.owner}/${info.repo}/releases`;
  link.removeAttribute("aria-current");
  link.classList.remove("selected");

  // Remove "selected" from all parent/child elements
  releasesTab.querySelectorAll(".selected, [aria-current]").forEach((el) => {
    el.classList.remove("selected");
    el.removeAttribute("aria-current");
  });

  // Remove counter if cloned
  releasesTab
    .querySelectorAll(".Counter, [data-view-component].Counter")
    .forEach((el) => el.remove());

  // Replace SVG icon with the tag icon
  const svg = releasesTab.querySelector("svg");
  if (svg) {
    svg.outerHTML = TAG_ICON_SVG;
  }

  // Update text content - find the text span
  const releasesLabel = t("releases");
  const textSpan = releasesTab.querySelector("[data-content]") as HTMLElement;
  if (textSpan) {
    textSpan.textContent = releasesLabel;
    textSpan.setAttribute("data-content", releasesLabel);
  } else {
    // Fallback: find span that contains text
    const spans = releasesTab.querySelectorAll("span");
    for (const span of spans) {
      if (span.children.length === 0 && span.textContent?.trim()) {
        span.textContent = releasesLabel;
        break;
      }
    }
  }

  // Highlight if currently on releases page
  if (isReleasesPage()) {
    link.classList.add("selected");
    link.setAttribute("aria-current", "page");
  }

  nav.appendChild(releasesTab);

  // GitHub's Catalyst/Turbo components may re-apply aria-current after injection.
  // Watch the link and strip any selected state that shouldn't be there.
  const observer = new MutationObserver(() => {
    if (!isReleasesPage()) {
      if (link.getAttribute("aria-current")) {
        link.removeAttribute("aria-current");
      }
      if (link.classList.contains("selected")) {
        link.classList.remove("selected");
      }
    }
  });
  observer.observe(link, {
    attributes: true,
    attributeFilter: ["aria-current", "class"],
  });
}

function findReferenceTab(nav: HTMLElement): HTMLElement | null {
  // Prefer a tab without a counter (simpler to clone)
  const tabs = nav.querySelectorAll<HTMLElement>(":scope > li, :scope > a");
  // Try to find "Actions" or "Projects" tab (no counter usually)
  for (const tab of tabs) {
    const text = tab.textContent?.trim() || "";
    if (text.startsWith("Actions") || text.startsWith("Projects")) {
      return tab;
    }
  }
  // Fallback to first tab
  return tabs[0] || null;
}
