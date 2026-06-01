const MIN_REPOS = 20;
const MAX_SHOW_MORE_CLICKS = 5;
const PIN_INJECTED_ATTR = "data-better-github-pin-injected";
const STORAGE_KEY = "pinned-repos";

// SVG pin icons (12x12) — outline for default, filled for pinned
const PIN_SVG_OUTLINE = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
  <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826Z"/>
</svg>`;
const PIN_SVG_FILLED = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
  <path d="M4.456.734a1.75 1.75 0 0 1 2.826.504l.613 1.327a3.08 3.08 0 0 0 2.084 1.707l2.454.584c1.332.317 1.8 1.972.832 2.94L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-2.204 2.205c-.968.968-2.623.5-2.94-.832l-.584-2.454a3.08 3.08 0 0 0-1.707-2.084l-1.327-.613a1.75 1.75 0 0 1-.504-2.826Z"/>
</svg>`;

// Track click count per "Show more" button to avoid infinite loops
const clickCounts = new WeakMap<HTMLElement, number>();

// GitHub renders the dashboard "Top repositories" list in two different layouts
// depending on the "New Dashboard Experience" feature flag:
//   - "new": Primer React ActionList (heading + items share one <ul>)
//   - "old": server-rendered list (<ul class="js-dashboard-repos-list">, items only)
// We normalize both behind RepoList so the pin/reorder logic stays layout-agnostic.
type Layout = "new" | "old";
interface RepoList {
  layout: Layout;
  ul: HTMLUListElement;
}

export function injectBetterTopRepos(): void {
  const list = findRepoList();
  if (!list) return;

  // Auto-expand: keep clicking "Show more" until >= MIN_REPOS or no more
  const items = getRepoItems(list);
  if (items.length < MIN_REPOS) {
    const showMoreBtn = getShowMore(list);
    if (showMoreBtn) {
      const clicks = clickCounts.get(showMoreBtn) || 0;
      if (clicks < MAX_SHOW_MORE_CLICKS) {
        clickCounts.set(showMoreBtn, clicks + 1);
        showMoreBtn.click();
        return; // Wait for next poll to inject pins after new items load
      }
    }
  }

  // Pin feature: inject pin icons and reorder
  injectPinIcons(list);
}

function findRepoList(): RepoList | null {
  // NEW dashboard: the "Top repositories" <h3> sits in a heading <li> whose
  // parent <ul> also holds the repo items.
  const headings = document.querySelectorAll("h3");
  for (const h of headings) {
    if (h.textContent?.includes("Top repositories")) {
      const headingLi = h.closest("li");
      if (!headingLi) continue;
      const ul = headingLi.parentElement as HTMLUListElement | null;
      if (ul && ul.tagName === "UL") return { layout: "new", ul };
    }
  }

  // OLD dashboard: a dedicated repo list <ul> (heading lives outside it).
  // GitHub renders the list twice — the left sidebar (filter-left) and a
  // responsive center copy (filter-center) — and hides one via CSS depending on
  // viewport. Pick the visible one so pins don't land on the hidden duplicate.
  const oldUls = [...document.querySelectorAll<HTMLUListElement>("ul.js-dashboard-repos-list")];
  const oldUl = oldUls.find((ul) => ul.offsetParent !== null) ?? oldUls[0];
  if (oldUl) return { layout: "old", ul: oldUl };

  return null;
}

// Repo items in display order. Filtering by getRepoName() naturally drops the
// heading row and the "Show more" row in both layouts.
function getRepoItems(list: RepoList): HTMLLIElement[] {
  if (list.layout === "new") {
    return [
      ...list.ul.querySelectorAll<HTMLLIElement>('li[class*="prc-ActionList-ActionListItem-"]'),
    ].filter((li) => getRepoName(li) !== null);
  }
  // OLD dashboard: items start inside the <ul>, but AJAX "Show more" pagination
  // can append later pages as siblings of the <ul>. Scope to the whole repos
  // container and identify repo rows by their /owner/repo link.
  const container = list.ul.closest<HTMLElement>(".js-repos-container") ?? list.ul;
  return [...container.querySelectorAll<HTMLLIElement>("li")].filter(
    (li) => getRepoName(li) !== null,
  );
}

// Insertion anchor for pinned repos. The new layout keeps the heading as the
// first <li> in the same <ul>, so pins go after it; the old layout's <ul> has
// no heading, so pins go to the very top.
function getHeadingAnchor(list: RepoList): HTMLLIElement | null {
  if (list.layout !== "new") return null;
  const first = list.ul.querySelector<HTMLLIElement>(":scope > li");
  return first && !getRepoName(first) ? first : null;
}

function getShowMore(list: RepoList): HTMLElement | null {
  if (list.layout === "new") {
    return list.ul.querySelector<HTMLElement>(
      '[data-testid="dynamic-side-panel-items-show-more"]',
    );
  }

  // OLD dashboard: an AJAX pagination form (js-more-repos-form) whose submit
  // button appends the next page of repos in place — no navigation — so it is
  // safe to click programmatically.
  const container = list.ul.closest<HTMLElement>(".js-repos-container") ?? list.ul.parentElement;
  return container?.querySelector<HTMLElement>(".js-more-repos-form button[type='submit']") ?? null;
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

function injectPinIcons(list: RepoList): void {
  // Inject styles once
  injectStyles();

  const items = getRepoItems(list);

  getPinnedRepos().then((pinned) => {
    let hasNew = false;

    for (const li of items) {
      // Skip already-injected items
      if (li.hasAttribute(PIN_INJECTED_ATTR)) continue;

      const repoName = getRepoName(li);
      if (!repoName) continue;

      li.setAttribute(PIN_INJECTED_ATTR, "true");
      hasNew = true;

      const isPinned = pinned.includes(repoName);
      const btn = createPinButton(isPinned);

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(repoName, btn, list);
      });

      li.style.position = "relative";
      li.appendChild(btn);
    }

    // Reorder if there are new items or on first run
    if (hasNew) {
      reorderPinnedRepos(list, pinned);
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

async function togglePin(repoName: string, btn: HTMLButtonElement, list: RepoList) {
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
  reorderPinnedRepos(list, pinned);
}

function reorderPinnedRepos(list: RepoList, pinned: string[]): void {
  const items = getRepoItems(list);
  const anchor = getHeadingAnchor(list);

  // Collect pinned items in order of pinned array
  const pinnedItems: HTMLLIElement[] = [];
  for (const repoName of pinned) {
    const item = items.find((li) => getRepoName(li) === repoName);
    if (item) pinnedItems.push(item);
  }

  // Move pinned items to top (after heading if present), in order
  for (const item of pinnedItems.reverse()) {
    if (anchor?.nextSibling) {
      list.ul.insertBefore(item, anchor.nextSibling);
    } else {
      list.ul.insertBefore(item, list.ul.firstChild);
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
    li[${PIN_INJECTED_ATTR}]:hover .better-github-pin-btn {
      opacity: 1;
    }
`;
  document.head.appendChild(style);
}
