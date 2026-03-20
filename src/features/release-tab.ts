import { isRepoPage, getRepoInfo, isReleasesPage } from "../lib/page-detect";

const TAB_CLASS = "better-github-releases-tab";

// GitHub's rocket SVG icon (Octicon rocket-16) — used for releases
const TAG_ICON_SVG = `<svg aria-hidden="true" height="16" viewBox="0 0 16 16" version="1.1" width="16" fill="currentColor" class="octicon UnderlineNav-octicon">
  <path d="M14.064 0h.186C15.216 0 16 .784 16 1.75v.186a8.752 8.752 0 0 1-2.564 6.186l-.458.459c-.314.314-.641.616-.979.904v3.207c0 .608-.315 1.172-.833 1.49l-2.774 1.707a.749.749 0 0 1-1.11-.418l-.954-3.102a1.214 1.214 0 0 1-.145-.125L3.754 9.816a1.218 1.218 0 0 1-.124-.145L.528 8.716a.749.749 0 0 1-.418-1.11l1.71-2.774A1.748 1.748 0 0 1 3.31 4h3.204c.288-.338.59-.665.904-.979l.459-.458A8.749 8.749 0 0 1 14.064 0ZM8.938 3.623h-.002l-.458.458c-.76.76-1.437 1.598-2.02 2.5l-1.188 1.862 3.854 3.855 1.862-1.19c.901-.583 1.74-1.26 2.499-2.02l.459-.457a7.25 7.25 0 0 0 2.123-5.127V1.75a.25.25 0 0 0-.25-.25h-.186a7.249 7.249 0 0 0-5.127 2.123ZM3.56 14.56c-.732.732-2.334 1.045-3.005 1.148a.234.234 0 0 1-.201-.064.234.234 0 0 1-.064-.201c.103-.671.416-2.273 1.15-3.003a1.502 1.502 0 1 1 2.12 2.12Zm6.94-9.935a1.25 1.25 0 1 1-1.768 1.768 1.25 1.25 0 0 1 1.768-1.768Z"></path>
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
  const link = releasesTab.tagName === "A"
    ? releasesTab as HTMLAnchorElement
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
  releasesTab.querySelectorAll(".Counter, [data-view-component].Counter").forEach((el) => el.remove());

  // Replace SVG icon with tag icon
  const svg = releasesTab.querySelector("svg");
  if (svg) {
    svg.outerHTML = TAG_ICON_SVG;
  }

  // Update text content - find the text span
  const textSpan = releasesTab.querySelector("[data-content]") as HTMLElement;
  if (textSpan) {
    textSpan.textContent = "Releases";
    textSpan.setAttribute("data-content", "Releases");
  } else {
    // Fallback: find span that contains text
    const spans = releasesTab.querySelectorAll("span");
    for (const span of spans) {
      if (span.children.length === 0 && span.textContent?.trim()) {
        span.textContent = "Releases";
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
