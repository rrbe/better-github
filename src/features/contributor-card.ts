// Contributor background card.
//
// GitHub already shows a hovercard when you hover a username. We append a block
// of *objective facts* to the bottom of it — account age, relation to this repo,
// historical merge rate, activity — so the reader can judge whether an account
// looks suspicious. Facts only: no score, no "suspicious" label, no red. See
// docs/pr-signals-plan.md.
//
// DOM verified against a live page (2026-06): the hovercard is a persistent,
// reused container `.js-hovercard-content > .Popover-message`; GitHub drops the
// fetched content in as a `<div data-hydro-view='{...}'>` whose JSON payload
// carries `event_type: "user-hovercard-hover"` and `payload.card_user_login`.
// We observe for that content, read the login from the payload, and append.
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

const BLOCK_CLASS = "better-github-contributor-card";

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
  r.className = `${BLOCK_CLASS}-row`;
  const label = document.createElement("span");
  label.className = `${BLOCK_CLASS}-label`;
  label.textContent = t(labelKey);
  const val = document.createElement("span");
  val.className = `${BLOCK_CLASS}-value`;
  val.textContent = value;
  r.append(label, val);
  return r;
}

function header(): HTMLElement {
  const h = document.createElement("div");
  h.className = `${BLOCK_CLASS}-header`;
  h.textContent = "Better GitHub";
  return h;
}

/** Build the fact block in full (the fetched data is already in hand). */
function buildBlock(info: ContributorInfo): HTMLElement {
  const block = document.createElement("div");
  block.className = BLOCK_CLASS;
  block.appendChild(header());

  const age = accountAge(Date.parse(info.createdAt), Date.now());
  const created = info.createdAt.slice(0, 7); // YYYY-MM
  block.appendChild(row("ccAge", `${age.value} ${ageUnitWord(age)} (${created})`));

  const rel = repoRelation(info.repoMerged);
  if (rel) {
    block.appendChild(
      row(
        "ccRepo",
        rel.kind === "first-time" ? t("ccFirstTime") : t("ccReturning", String(rel.mergedCount)),
      ),
    );
  }

  if (info.prTotal > 0) {
    const rate = mergeRatePct(info.prMerged, info.prTotal);
    const tail = rate == null ? "" : ` (${rate}%)`;
    block.appendChild(
      row("ccHistory", `${info.prTotal} PR · ${info.prMerged} ${t("ccMerged")}${tail}`),
    );
  }

  const activity =
    info.hasToken && info.contributionsLastYear != null
      ? t("ccContribs", String(info.contributionsLastYear))
      : t("ccNeedToken");
  block.appendChild(row("ccActivity", activity));
  return block;
}

// GitHub swaps in a fresh content node whenever you move between a user's avatar
// and username (and may re-render again as the card settles), which destroys any
// child we appended. So we must (re)inject whenever our block is missing — never
// mark GitHub's node as "done", or one wipe leaves it gone for good. Data is
// cached per login in-page so re-injection is synchronous and flicker-free; a
// pending set stops duplicate fetches for the same login.
const infoCache = new Map<string, ContributorInfo | null>();
const fetching = new Set<string>();

function currentContent(): HTMLElement | null {
  const message = document.querySelector<HTMLElement>(".js-hovercard-content .Popover-message");
  return message?.querySelector<HTMLElement>("[data-hydro-view]") ?? null;
}

function inject(content: HTMLElement | null, login: string): void {
  // Bail if disabled, the card closed, switched users, or we're already in it.
  if (!observer || !content || userLogin(content) !== login) return;
  if (content.querySelector(`.${BLOCK_CLASS}`)) return;
  const data = infoCache.get(login);
  if (!data) return; // not fetched yet, or fetched with no data
  content.appendChild(buildBlock(data));
}

function scan(): void {
  const content = currentContent();
  if (!content) return;
  const login = userLogin(content);
  if (!login) return;
  if (content.querySelector(`.${BLOCK_CLASS}`)) return; // already shown on this card
  if (infoCache.has(login)) {
    inject(content, login);
    return;
  }
  if (fetching.has(login)) return;
  fetching.add(login);
  const repo = getRepoInfo();
  fetchContributorInfo(login, repo?.owner, repo?.repo)
    .then((data) => {
      fetching.delete(login);
      infoCache.set(login, data ?? null);
      inject(currentContent(), login); // inject into whatever card is up now
    })
    .catch(() => fetching.delete(login));
}

let observer: MutationObserver | null = null;
let rafId = 0;

function scheduleScan(): void {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    scan();
  });
}

export function injectContributorCard(): void {
  cleanupContributorCard();
  // The hovercard is global, not page-specific. Watch for GitHub populating its
  // (reused) container; coalesce mutation bursts into one scan per frame.
  observer = new MutationObserver(() => scheduleScan());
  observer.observe(document.body, { childList: true, subtree: true });
}

export function cleanupContributorCard(): void {
  observer?.disconnect();
  observer = null;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  fetching.clear();
  infoCache.clear();
  document.querySelectorAll(`.${BLOCK_CLASS}`).forEach((el) => el.remove());
}
