import { isDashboardPage } from "../lib/page-detect";

const CLICKED_ATTR = "data-better-github-expanded";
const PIN_INJECTED_ATTR = "data-better-github-pin-injected";
const STORAGE_KEY = "pinned-repos";

// SVG pin icons (12x12) — outline for default, filled for pinned
const PIN_SVG_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
  <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826Z"/>
</svg>`;
const PIN_SVG_FILLED = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
  <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826Z"/>
</svg>`;

export function injectDashboardTopRepos(): void {
  if (!isDashboardPage()) return;

  // Auto-expand: click "Show more" if present
  const showMoreBtn = document.querySelector<HTMLElement>(
    '[data-testid="dynamic-side-panel-items-show-more"]',
  );
  if (showMoreBtn && !showMoreBtn.hasAttribute(CLICKED_ATTR)) {
    showMoreBtn.setAttribute(CLICKED_ATTR, "true");
    showMoreBtn.click();
  }

  // Pin feature: inject pin icons and reorder
  injectPinIcons();
}

function getRepoList(): { ul: HTMLUListElement; items: HTMLLIElement[] } | null {
  const headings = document.querySelectorAll("h3");
  for (const h of headings) {
    if (h.textContent?.includes("Top repositories")) {
      // h3 is inside a heading <li>, whose parent is the inner <ul> with repo items
      const headingLi = h.closest("li");
      if (!headingLi) continue;
      const ul = headingLi.parentElement as HTMLUListElement | null;
      if (!ul || ul.tagName !== "UL") continue;
      const items = [
        ...ul.querySelectorAll<HTMLLIElement>("li.prc-ActionList-ActionListItem-So4vC"),
      ];
      return { ul, items };
    }
  }
  return null;
}

function getRepoName(li: HTMLLIElement): string | null {
  const link = li.querySelector<HTMLAnchorElement>("a[href]");
  if (!link) return null;
  const href = link.getAttribute("href");
  if (!href) return null;
  const match = href.match(/^\/([^/]+\/[^/]+)$/);
  return match ? match[1] : null;
}

async function getPinnedRepos(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      if (!chrome.runtime?.id) return resolve([]);
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        resolve(result[STORAGE_KEY] || []);
      });
    } catch {
      resolve([]);
    }
  });
}

function savePinnedRepos(pinned: string[]): void {
  try {
    if (!chrome.runtime?.id) return;
    chrome.storage.local.set({ [STORAGE_KEY]: pinned });
  } catch {
    // Extension context invalidated
  }
}

function injectPinIcons(): void {
  const list = getRepoList();
  if (!list) return;

  // Inject styles once
  injectStyles();

  getPinnedRepos().then((pinned) => {
    let hasNew = false;

    for (const li of list.items) {
      // Skip already-injected items
      if (li.hasAttribute(PIN_INJECTED_ATTR)) continue;

      const repoName = getRepoName(li);
      if (!repoName) continue;

      // Skip "Show more" button item
      if (li.querySelector('[data-testid="dynamic-side-panel-items-show-more"]')) continue;

      li.setAttribute(PIN_INJECTED_ATTR, "true");
      hasNew = true;

      const isPinned = pinned.includes(repoName);
      const btn = createPinButton(isPinned);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(repoName, btn, list.ul);
      });

      li.style.position = "relative";
      li.appendChild(btn);
    }

    // Reorder if there are new items or on first run
    if (hasNew) {
      reorderPinnedRepos(list.ul, pinned);
    }
  });
}

function createPinButton(isPinned: boolean): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "better-github-pin-btn";
  if (isPinned) btn.classList.add("pinned");
  btn.innerHTML = isPinned ? PIN_SVG_FILLED : PIN_SVG_OUTLINE;
  btn.title = isPinned ? "Unpin repository" : "Pin repository";
  btn.type = "button";
  return btn;
}

async function togglePin(repoName: string, btn: HTMLButtonElement, ul: HTMLUListElement) {
  const pinned = await getPinnedRepos();
  const index = pinned.indexOf(repoName);

  if (index >= 0) {
    pinned.splice(index, 1);
    btn.classList.remove("pinned");
    btn.innerHTML = PIN_SVG_OUTLINE;
    btn.title = "Pin repository";
  } else {
    pinned.push(repoName);
    btn.classList.add("pinned");
    btn.innerHTML = PIN_SVG_FILLED;
    btn.title = "Unpin repository";
  }

  savePinnedRepos(pinned);
  reorderPinnedRepos(ul, pinned);
}

function reorderPinnedRepos(ul: HTMLUListElement, pinned: string[]): void {
  const items = [...ul.querySelectorAll<HTMLLIElement>("li.prc-ActionList-ActionListItem-So4vC")];
  const heading = ul.querySelector("li:not(.prc-ActionList-ActionListItem-So4vC)");

  // Collect pinned items in order of pinned array
  const pinnedItems: HTMLLIElement[] = [];
  for (const repoName of pinned) {
    const item = items.find((li) => getRepoName(li) === repoName);
    if (item) pinnedItems.push(item);
  }

  // Move pinned items to top (after heading), in order
  for (const item of pinnedItems.reverse()) {
    if (heading?.nextSibling) {
      ul.insertBefore(item, heading.nextSibling);
    } else {
      ul.prepend(item);
    }
  }
}

function injectStyles(): void {
  if (document.getElementById("better-github-pin-styles")) return;

  const style = document.createElement("style");
  style.id = "better-github-pin-styles";
  style.textContent = `
    .js-left-column-scroll-container {
      scrollbar-gutter: stable;
    }
    .better-github-pin-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      color: var(--fgColor-muted, #656d76);
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
      display: flex;
      align-items: center;
      z-index: 2;
      line-height: 0;
    }
    .better-github-pin-btn:hover {
      color: var(--fgColor-default, #1f2328);
      background: var(--bgColor-neutral-muted, rgba(175,184,193,0.2));
    }
    .better-github-pin-btn.pinned {
      opacity: 1;
      color: var(--fgColor-accent, #0969da);
    }
    .better-github-pin-btn.pinned:hover {
      color: var(--fgColor-accent, #0969da);
      background: var(--bgColor-accent-muted, rgba(9,105,218,0.1));
    }
    li.prc-ActionList-ActionListItem-So4vC:hover .better-github-pin-btn {
      opacity: 1;
    }
`;
  document.head.appendChild(style);
}
