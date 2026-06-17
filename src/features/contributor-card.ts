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

function row(labelKey: string, value: string): HTMLElement {
  const r = document.createElement("div");
  r.className = `${PANEL_CLASS}-row`;
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}-label`;
  label.textContent = t(labelKey);
  const val = document.createElement("span");
  val.className = `${PANEL_CLASS}-value`;
  val.textContent = value;
  r.append(label, val);
  return r;
}

function header(): HTMLElement {
  const h = document.createElement("div");
  h.className = `${PANEL_CLASS}-header`;
  h.textContent = "Better GitHub";
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
  panel.appendChild(row("ccAge", `${age.value} ${ageUnitWord(age)} (${created})`));

  const rel = repoRelation(info.repoMerged);
  if (rel) {
    panel.appendChild(
      row(
        "ccRepo",
        rel.kind === "first-time" ? t("ccFirstTime") : t("ccReturning", String(rel.mergedCount)),
      ),
    );
  }

  if (info.prTotal > 0) {
    const rate = mergeRatePct(info.prMerged, info.prTotal);
    const tail = rate == null ? "" : ` (${rate}%)`;
    panel.appendChild(
      row("ccHistory", `${info.prTotal} PR · ${info.prMerged} ${t("ccMerged")}${tail}`),
    );
  }

  const activity =
    info.hasToken && info.contributionsLastYear != null
      ? t("ccContribs", String(info.contributionsLastYear))
      : t("ccNeedToken");
  panel.appendChild(row("ccActivity", activity));
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

/** Insert the panel into the stable container, right below the card body, and
 * size it to match so the container doesn't widen. */
function placePanel(card: Card, panel: HTMLElement): void {
  const width = card.message?.getBoundingClientRect().width;
  if (width) panel.style.width = `${Math.round(width)}px`;
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
