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
  repoRelation,
  type AccountAge,
  type RepoRelation,
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

/** i18n key for a repo-relation identity label. */
function relationLabelKey(rel: NonNullable<RepoRelation>): string {
  switch (rel.kind) {
    case "owner":
      return "ccOwner";
    case "member":
      return "ccMember";
    case "collaborator":
      return "ccCollaborator";
    case "contributor":
      return "ccContributor";
    case "first-time":
      return "ccFirstTime";
  }
}

function row(labelKey: string, value: HTMLElement): HTMLElement {
  const r = document.createElement("div");
  r.className = `${PANEL_CLASS}-row`;
  const label = document.createElement("span");
  label.className = `${PANEL_CLASS}-label`;
  label.textContent = t(labelKey);
  r.append(label, value);
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
    row("ccAge", valueEl([{ strong: `${age.value} ${ageUnitWord(age)}` }, { dim: ` · ${created}` }])),
  );

  const rel = repoRelation(info.repoAssociation);
  if (rel) {
    panel.appendChild(row("ccRepo", valueEl([{ strong: t(relationLabelKey(rel)) }])));
  }

  if (info.prTotal > 0) {
    // total · merged · closed (closed = closed without merging — the rejection
    // signal). Counts bold; the words muted-default. No rate (counts read clearer).
    panel.appendChild(
      row(
        "ccHistory",
        valueEl([
          { strong: String(info.prTotal) },
          " PR · ",
          { strong: String(info.prMerged) },
          ` ${t("ccMerged")} · `,
          { strong: String(info.prClosed) },
          ` ${t("ccClosed")}`,
        ]),
      ),
    );
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
  panel.appendChild(row("ccActivity", activity));
  return panel;
}

function skeletonBar(width: number): HTMLElement {
  const bar = document.createElement("span");
  bar.className = `${PANEL_CLASS}-skeleton`;
  bar.style.width = `${width}px`;
  return bar;
}

/** A placeholder shown the instant the card opens, while the fetch is in flight,
 * so real data fills in rather than popping the whole panel into existence. The
 * keys (labels) are static and known up front, so they render as real text —
 * only the value slot, which depends on the fetch, gets a shimmer bar. Same row
 * structure as the real panel, so swapping in the data causes no layout shift.
 * Value-bar widths are varied so they read as content. */
function buildSkeleton(login: string): HTMLElement {
  const panel = document.createElement("div");
  panel.className = `${PANEL_CLASS} ${PANEL_CLASS}--loading`;
  panel.dataset.login = login;
  panel.dataset.skeleton = "true";
  panel.appendChild(header());
  // [label key, value-bar width] per row — mirrors age/repo/history/activity.
  for (const [labelKey, vw] of [
    ["ccAge", 92],
    ["ccRepo", 132],
    ["ccHistory", 108],
    ["ccActivity", 150],
  ] as const) {
    const value = document.createElement("span");
    value.className = `${PANEL_CLASS}-value`;
    value.appendChild(skeletonBar(vw));
    panel.appendChild(row(labelKey, value));
  }
  return panel;
}

// Successful fetches only — keyed by repo#login, persists across navigations.
const infoCache = new Map<string, ContributorInfo>();
const fetching = new Set<string>();
// Logins whose last fetch FAILED, with when it failed. A failure must NOT be
// cached as a permanent "no data": fetchContributorInfo returns null on any
// error (rate limit, network blip), and caching that forever hid the card for
// the rest of the session after a single transient failure. Instead we retry
// after a short cooldown (and on any fresh page load, since this is in-memory).
const failedFetchAt = new Map<string, number>();
const FAILED_FETCH_RETRY_MS = 60_000;

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

  // Already showing the *real* panel for this user → nothing to do (survives
  // content swaps). A skeleton for this user is NOT done — it still needs filling.
  const login = card.login;
  if (existing && !existing.dataset.skeleton && existing.dataset.login === login) return;

  // Key the cache by repo *and* login. The cache persists across navigations
  // (injectContributorCard no longer clears it), and the repo-relation row
  // (`repoAssociation`) is repo-specific — a bare login key would show repo A's
  // relation while viewing repo B.
  const repo = getRepoInfo();
  const cacheKey = `${repo?.owner ?? ""}/${repo?.repo ?? ""}#${login}`;
  if (infoCache.has(cacheKey)) {
    existing?.remove();
    placePanel(card, buildPanel(login, infoCache.get(cacheKey)!));
    return;
  }

  // Fetch failed recently → don't re-shimmer or refetch on every hovercard
  // re-render (which would storm the network); just show nothing for now. The
  // cooldown lets a later hover retry instead of the card being stuck off.
  const failedAt = failedFetchAt.get(cacheKey);
  if (failedAt !== undefined && Date.now() - failedAt < FAILED_FETCH_RETRY_MS) {
    existing?.remove();
    return;
  }

  // Not cached yet. Show a skeleton immediately so the card doesn't pop in when
  // the data lands; keep it while the fetch is in flight, and fetch once.
  const skeletonShown = existing?.dataset.skeleton === "true" && existing.dataset.login === login;
  if (!skeletonShown) {
    existing?.remove();
    placePanel(card, buildSkeleton(login));
  }
  if (fetching.has(cacheKey)) return;
  fetching.add(cacheKey);
  fetchContributorInfo(login, repo?.owner, repo?.repo)
    .then((data) => {
      fetching.delete(cacheKey);
      if (data) {
        // Success → cache and render. Clear any prior failure mark.
        failedFetchAt.delete(cacheKey);
        infoCache.set(cacheKey, data);
        sync();
      } else {
        // null = transient failure (see failedFetchAt note). Mark for retry and
        // drop the skeleton — never cache it as permanent "no data".
        failedFetchAt.set(cacheKey, Date.now());
        card.container.querySelector(`.${PANEL_CLASS}[data-skeleton]`)?.remove();
      }
    })
    .catch(() => {
      fetching.delete(cacheKey);
      failedFetchAt.set(cacheKey, Date.now());
      // Don't leave a skeleton shimmering forever on a failed fetch.
      card.container.querySelector(`.${PANEL_CLASS}[data-skeleton]`)?.remove();
    });
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
  failedFetchAt.clear();
  document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());
}
