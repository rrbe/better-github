// Contributor background card.
//
// GitHub shows a hovercard when you hover a username. We attach a panel of
// *objective facts* to it — account age, relation to this repo, historical merge
// rate, activity — so the reader can judge whether an account looks suspicious.
// Facts only: no score, no "suspicious" label, no red. See docs/pr-signals-plan.md.
//
// DOM verified against a live page (2026-06):
//   .js-hovercard-content                ← the reused popover root; STABLE
//     └ .Popover-message                 ← same node across hovers, but GitHub
//         └ [data-hydro-view]            ←   replaces its innerHTML on every
//                                            avatar↔username move, so anything we
//                                            put *inside* it gets wiped (flicker).
// The hydro-view payload carries `event_type: "user-hovercard-hover"` and
// `payload.card_user_login`. We therefore anchor our panel as a child of the
// STABLE `.js-hovercard-content` (a sibling after `.Popover-message`), and only
// rebuild it when the login actually changes — so same-user content swaps never
// touch it, and it never flickers.
import { getRepoInfo } from "../lib/page-detect";
import { fetchContributorInfo } from "../lib/github-api";
import {
  accountAge,
  mergeRatePct,
  repoRelation,
  type AccountAge,
} from "../lib/contributor-signals";
import type { ContributorInfo } from "../lib/messages";
import { t } from "../lib/i18n";

const PANEL_CLASS = "better-github-contributor-card";

/** Read the login from a hovercard content root's hydro-view payload, but only
 * when it's a *user* hovercard (repos/issues reuse the same container). */
function userLogin(content: HTMLElement): string | null {
  const raw = content.getAttribute("data-hydro-view");
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.event_type !== "user-hovercard-hover") return null;
    const login = data?.payload?.card_user_login;
    return typeof login === "string" && login ? login : null;
  } catch {
    return null;
  }
}

function ageUnitWord(age: AccountAge): string {
  const plural = age.value !== 1;
  if (age.unit === "day") return t(plural ? "ccUnitDays" : "ccUnitDay");
  if (age.unit === "month") return t(plural ? "ccUnitMonths" : "ccUnitMonth");
  return t(plural ? "ccUnitYears" : "ccUnitYear");
}

// Octicon 16×16 path data, harvested from GitHub's own UI so each row is
// anchored by the same iconography as the native hovercard rows above it.
const SVG_NS = "http://www.w3.org/2000/svg";
const ICON = {
  age: "M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm7-3.25v2.992l2.028.812a.75.75 0 0 1-.557 1.392l-2.5-1A.751.751 0 0 1 7 8.25v-3.5a.75.75 0 0 1 1.5 0Z",
  repo: "M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z",
  pr: "M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z",
  activity:
    "M1.5 1.75V13.5h13.75a.75.75 0 0 1 0 1.5H.75a.75.75 0 0 1-.75-.75V1.75a.75.75 0 0 1 1.5 0Zm14.28 2.53-5.25 5.25a.75.75 0 0 1-1.06 0L7 7.06 4.28 9.78a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042l3.25-3.25a.75.75 0 0 1 1.06 0L10 7.94l4.72-4.72a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z",
};

function iconSvg(d: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", `${PANEL_CLASS}-icon`);
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

// A value is built from parts so the key datum (a count or status) can be made
// bold while supporting detail is dimmed — that contrast is what makes the facts
// scannable. A plain string is normal weight; {strong} bold; {dim} muted.
type ValuePart = string | { strong: string } | { dim: string };

function valueEl(parts: ValuePart[]): HTMLElement {
  const v = document.createElement("span");
  v.className = `${PANEL_CLASS}-value`;
  for (const part of parts) {
    if (typeof part === "string") {
      v.appendChild(document.createTextNode(part));
    } else if ("strong" in part) {
      const s = document.createElement("strong");
      s.textContent = part.strong;
      v.appendChild(s);
    } else {
      const d = document.createElement("span");
      d.className = `${PANEL_CLASS}-dim`;
      d.textContent = part.dim;
      v.appendChild(d);
    }
  }
  return v;
}

/** Bold `token` within an already-localized string (e.g. the count inside
 * "$count$ contributions…"), so emphasis survives word-order differences. */
function emphasizeToken(full: string, token: string): ValuePart[] {
  const i = full.indexOf(token);
  if (i < 0) return [{ strong: full }];
  return [full.slice(0, i), { strong: token }, full.slice(i + token.length)];
}

function row(iconPath: string, labelKey: string, value: HTMLElement): HTMLElement {
  const r = document.createElement("div");
  r.className = `${PANEL_CLASS}-row`;
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}-label`;
  label.textContent = t(labelKey);
  r.append(iconSvg(iconPath), label, value);
  return r;
}

function header(): HTMLElement {
  const h = document.createElement("div");
  h.className = `${PANEL_CLASS}-header`;
  const mark = document.createElement("span");
  mark.className = `${PANEL_CLASS}-mark`;
  const text = document.createElement("span");
  text.textContent = "Better GitHub";
  h.append(mark, text);
  return h;
}

/** Build the full panel for a login (data already in hand). */
function buildPanel(login: string, info: ContributorInfo): HTMLElement {
  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  panel.dataset.login = login;
  panel.appendChild(header());

  const age = accountAge(Date.parse(info.createdAt), Date.now());
  const created = info.createdAt.slice(0, 7); // YYYY-MM
  panel.appendChild(
    row(ICON.age, "ccAge", valueEl([{ strong: `${age.value} ${ageUnitWord(age)}` }, { dim: ` · ${created}` }])),
  );

  const rel = repoRelation(info.repoMerged);
  if (rel) {
    const value =
      rel.kind === "first-time"
        ? valueEl([{ strong: t("ccFirstTime") }])
        : valueEl(emphasizeToken(t("ccReturning", String(rel.mergedCount)), String(rel.mergedCount)));
    panel.appendChild(row(ICON.repo, "ccRepo", value));
  }

  if (info.prTotal > 0) {
    const rate = mergeRatePct(info.prMerged, info.prTotal);
    const parts: ValuePart[] = [
      { strong: String(info.prTotal) },
      " PR · ",
      { strong: String(info.prMerged) },
      ` ${t("ccMerged")}`,
    ];
    if (rate != null) parts.push({ dim: ` · ${rate}%` });
    panel.appendChild(row(ICON.pr, "ccHistory", valueEl(parts)));
  }

  const activity =
    info.hasToken && info.contributionsLastYear != null
      ? valueEl(
          emphasizeToken(
            t("ccContribs", String(info.contributionsLastYear)),
            String(info.contributionsLastYear),
          ),
        )
      : valueEl([{ dim: t("ccNeedToken") }]);
  panel.appendChild(row(ICON.activity, "ccActivity", activity));
  return panel;
}

const infoCache = new Map<string, ContributorInfo | null>();
const fetching = new Set<string>();

interface Card {
  container: HTMLElement;
  message: HTMLElement | null;
  content: HTMLElement | null;
  login: string | null;
}

function currentCard(): Card | null {
  const container = document.querySelector<HTMLElement>(".js-hovercard-content");
  if (!container) return null;
  const message = container.querySelector<HTMLElement>(".Popover-message");
  const content = message?.querySelector<HTMLElement>("[data-hydro-view]") ?? null;
  return { container, message, content, login: content ? userLogin(content) : null };
}

/** Insert the panel into the stable container, right below the card body, sized
 * and offset to line up with the bubble so the two read as one card. GitHub
 * shifts `.Popover-message` horizontally (e.g. `left:-9px`) to seat its caret;
 * our panel flows from the container's edge, so we apply the same offset as a
 * left margin (and it flips sign for right-aligned popovers). */
function placePanel(card: Card, panel: HTMLElement): void {
  if (card.message) {
    const msg = card.message.getBoundingClientRect();
    const container = card.container.getBoundingClientRect();
    panel.style.width = `${Math.round(msg.width)}px`;
    panel.style.marginLeft = `${Math.round(msg.left - container.left)}px`;
  }
  if (card.message && card.message.nextSibling) {
    card.container.insertBefore(panel, card.message.nextSibling);
  } else {
    card.container.appendChild(panel);
  }
}

// Reconcile our panel with whatever the hovercard currently shows. Called on a
// rAF-coalesced pass after any DOM mutation.
function sync(): void {
  if (!observer) return;
  const card = currentCard();
  if (!card) return;
  const existing = card.container.querySelector<HTMLElement>(`.${PANEL_CLASS}`);

  // Mid-swap (GitHub cleared the body, no content yet): leave our panel in place
  // — removing it here is exactly what caused the flicker. Wait for the new content.
  if (!card.content) return;

  // Non-user hovercard (repo/issue): our panel doesn't belong here.
  if (!card.login) {
    existing?.remove();
    return;
  }

  // Same user as what we're already showing → nothing to do (survives swaps).
  if (existing && existing.dataset.login === card.login) return;

  const login = card.login;
  // Key the cache by repo *and* login. The cache now persists across
  // navigations (injectContributorCard no longer clears it), and the
  // repo-relation row (`repoMerged`) is repo-specific — a bare login key would
  // show repo A's relation while viewing repo B.
  const repo = getRepoInfo();
  const cacheKey = `${repo?.owner ?? ""}/${repo?.repo ?? ""}#${login}`;
  if (infoCache.has(cacheKey)) {
    existing?.remove();
    const info = infoCache.get(cacheKey);
    if (info) placePanel(card, buildPanel(login, info));
    return;
  }

  // Different/unknown user: drop the stale panel (don't show wrong data), fetch.
  existing?.remove();
  if (fetching.has(cacheKey)) return;
  fetching.add(cacheKey);
  fetchContributorInfo(login, repo?.owner, repo?.repo)
    .then((data) => {
      fetching.delete(cacheKey);
      infoCache.set(cacheKey, data ?? null);
      sync();
    })
    .catch(() => fetching.delete(cacheKey));
}

let observer: MutationObserver | null = null;
let observedBody: HTMLElement | null = null;
let rafId = 0;

function scheduleSync(): void {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    sync();
  });
}

export function injectContributorCard(): void {
  // MUST be idempotent and non-destructive. navigation.ts re-fires every
  // onPageReady handler on a 2s poll and on every turbo:render — so this runs
  // repeatedly while the user is mid-hover. The old code called
  // cleanupContributorCard() here first, which removed the live panel and
  // cleared the cache: that is what made the card flash then vanish on its own
  // (~0.5–1s in), while GitHub's native card stayed. The hovercard and its
  // container are global, so one long-lived observer is enough; we only
  // re-attach when Turbo has swapped out the <body> we were watching.
  if (observer && observedBody === document.body) return;
  observer?.disconnect();
  observer = new MutationObserver(() => scheduleSync());
  observedBody = document.body;
  observer.observe(observedBody, { childList: true, subtree: true });
  scheduleSync(); // a hovercard may already be open when we (re)attach
}

export function cleanupContributorCard(): void {
  observer?.disconnect();
  observer = null;
  observedBody = null;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  fetching.clear();
  infoCache.clear();
  document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());
}
