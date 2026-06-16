# Contributor Card — debugging state & open problems

> Handoff doc so a future session can resume. Branch `feat/contributor-card`,
> PR #34. The data layer + card render work; **two things are unresolved**:
> (1) the panel still flashes then disappears (~0.5–1s) in real use, and
> (2) a design decision — the user wants it as a **seamless continuation of
> GitHub's native card**, not the separate floating panel currently shipped.
>
> Last updated 2026-06-17.

---

## 1. What the feature is

On hovering a username, GitHub shows a hovercard. We attach a panel of objective
facts (account age, relation to this repo, historical merge rate, activity).
Code: `src/features/contributor-card.ts` (+ `src/lib/contributor-signals.ts`,
service-worker `fetchContributorInfo`). Toggle: `feature-contributor-card`.

## 2. The bug (still open)

**Symptom (user, real mouse, logged-in):** hovering the avatar or username area,
our panel **appears for ~0.5–1s then disappears on its own**, while GitHub's
native card stays. Confirmed the current build IS loaded (panel is a direct child
of `.js-hovercard-content`, showing real data).

**Why my "fixes" kept missing:** I validated with **synthetic events** and a
**mimic**, which showed 0 flicker — but the real mouse does something synthetic
events don't reproduce. **Do not trust synthetic-event or screenshot validation
for this.** Use a real-mouse DOM timeline (see §6).

## 3. Verified GitHub hovercard DOM facts (live, chrome-devtools)

- **Trigger:** `<a data-hovercard-type="user" data-hovercard-url="/users/{login}/hovercard" href="/{login}">`.
  The **avatar and the username are SEPARATE triggers** for the same user (a PR
  page had 4 triggers for one user). Moving between them is the key interaction.
- **Container:** `.js-hovercard-content` — a `.Popover.position-absolute`
  directly under `<body>`. **Persistent / reused.** `overflow:visible`, height auto.
- **Body box:** `.js-hovercard-content > .Popover-message` (inline `width:360px`,
  `position:relative`). **Same node across hovers**, BUT GitHub **replaces its
  innerHTML on every hover / trigger change.**
- **Content root:** `.Popover-message > div > div[data-hydro-view='{...}']`. The
  JSON payload has `event_type:"user-hovercard-hover"` and `payload.card_user_login`
  — this is how we read which user (and that it's a *user* card vs repo/issue).
- **Avatar↔username move:** GitHub **removes the old `[data-hydro-view]` node and
  adds a new one** (`-hydro#1 … +hydro#2`), with a **~500ms network gap** between.
  Same `.Popover-message`, same container.
- **Anchor survival (tested):** a child appended **inside `.Popover-message`** is
  **wiped** on swap; a child appended to **`.js-hovercard-content`** (sibling
  after `.Popover-message`) **survives**. → current code anchors in the container.
- **Hide mechanism:** GitHub hides on `mouseleave`/`mouseout` of
  `.js-hovercard-content` whose `relatedTarget` is outside it → sets
  `display:none` and clears `.Popover-message` (children → 0). There is a hide
  delay. Containment IS respected (moving into a child keeps it open, in the tests
  done so far). **NOT yet tested:** whether GitHub *removes/recreates* the
  container on hide vs just `display:none` — this matters a lot (see H1).
- No reposition on content growth (top stays, grows downward).

## 4. Fixes attempted (chronological) and why each fell short

1. **Append into `[data-hydro-view]`, mark node done.** → vanished on the node
   swap; the "done" marker then blocked re-adding → "flash then gone forever".
2. **Drop the loading→fill `replaceChildren`** (it tore out the node under the
   cursor). → did not fix it.
3. **Re-inject whenever our block is missing; per-login cache; no marker.**
   (commit `3379c78`) → re-injects, but **flickers ~500ms** every swap because the
   block lived inside the volatile content node and there's nothing to inject into
   during GitHub's rebuild gap.
4. **Anchor in stable `.js-hovercard-content`, login-keyed, rebuild only on login
   change** (commit `a84082d`, CURRENTLY LOADED). Synthetic/mimic = 0 flicker, but
   **user still sees it disappear after ~0.5–1s with a real mouse.** ← current state.

## 5. Hypotheses for the remaining disappearance (ranked, to test next)

- **H1 — GitHub destroys/recreates `.js-hovercard-content` on hide.** If, when the
  pointer leaves, GitHub *removes* the container (not just `display:none`), our
  panel (its child) is destroyed. On re-show GitHub makes a fresh container; we
  rebuild — but if the per-login fetch isn't warm at that instant, the panel is
  absent for a while → reads as "disappeared". **Test:** does the container node
  identity change across a hide/show cycle? (stamp it, hide, re-show, compare).
  *Most likely culprit given "disappears while still hovering / shortly after".*
- **H3 — moving onto our panel dismisses the card.** Our panel sits BELOW
  `.Popover-message` (outside the visible bubble, in the container). Real pointer
  moving down onto it may cross a region GitHub treats as "left the card" (its hit
  region may be `.Popover-message`, not the whole container). Earlier real-CDP test
  only moved onto a child *inside* `.Popover-message`. **Test:** real-hover trigger
  → real-move pointer onto the panel → does the card hide?
- **H4 — sync() removes it when `card.login` is momentarily null.** During a
  re-render the fresh `[data-hydro-view]` might briefly lack `card_user_login` (or
  a different `event_type`). `sync()` then hits `!card.login` → `existing.remove()`
  and doesn't re-add until a "good" render. **Test:** log `card.login` on every
  sync pass over time.
- **H5 — SPA navigation cleanup.** PR pages do partial/turbo updates. If
  `onPageReady` fires, `injectContributorCard()` → `cleanupContributorCard()`
  clears the panel + cache. **Test:** log when inject/cleanup run during a hover.
- **H2 — delayed contextual re-render** ("Opened this PR (their first)", "Joined
  this month" appear ~1s after). Same login → should be a no-op for us, but verify.

## 6. How to resume (real-mouse DOM timeline — the right method)

MCP auto-connect to the user's Chrome is now fixed permanently (SessionStart hook,
see `reference-chrome-devtools-autoconnect` memory). On next start, with the user's
Chrome open (remote debugging on), `list_pages` shows their real tabs.

Repro page: a PR conversation with a first-time external contributor, e.g.
`https://github.com/CodyTseng/jumble/pull/809` (logged in). Hover a comment
author's avatar/username.

**Recorder to paste via `evaluate_script` (records add/remove of our panel + hydro
nodes + container style, with timestamps):**

```js
window.__rec = [];
const t0 = performance.now();
const log = (m) => window.__rec.push(Math.round(performance.now()-t0)+'ms '+m);
let s=0;
const isPanel=(n)=>n.matches?.('.better-github-contributor-card')||n.querySelector?.('.better-github-contributor-card');
const hv=(n)=>n.matches?.('[data-hydro-view]')?n:n.querySelector?.('[data-hydro-view]');
window.__recObs?.disconnect?.();
window.__recObs=new MutationObserver((muts)=>{for(const mu of muts){
  if(mu.type==='attributes'){ if(mu.target.classList?.contains('js-hovercard-content')) log('container['+mu.attributeName+']='+(mu.target.getAttribute('style')||'').slice(0,40)); continue; }
  for(const n of mu.addedNodes) if(n.nodeType===1){ if(isPanel(n))log('+PANEL'); const h=hv(n); if(h){if(!h.__id)h.__id=++s; log('+hydro#'+h.__id);} }
  for(const n of mu.removedNodes) if(n.nodeType===1){ if(isPanel(n))log('-PANEL from '+(mu.target.className||mu.target.tagName)); const h=hv(n); if(h)log('-hydro#'+(h.__id||'?')); }
}});
window.__recObs.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
'armed';
```

Then either (a) ask the user to hover with their real mouse for a few seconds, or
(b) drive a **real** CDP hover yourself: `take_snapshot` → find a user-link uid →
`hover` it → wait ~3s held → `hover` the panel's uid (test H3) → read
`window.__rec`. Real CDP input (the `hover`/`click` tools) ≠ synthetic JS events;
use the real tools. Also stamp the container node identity to settle H1:
`const c=document.querySelector('.js-hovercard-content'); c.__id ??= Math.random();`
then re-check `c.__id` after a hide/show.

## 7. Design decision still open (user feedback)

The user wants the facts shown as a **seamless continuation of GitHub's native
card**, NOT the separate floating panel currently shipped. The tension:
- Inside `.Popover-message` (seamless) → **wiped on every swap → flicker** (§3).
- In `.js-hovercard-content` (stable, no flicker) → renders as a **separate panel**
  below the card (what's shipped; user dislikes).

Options to explore:
- **(A, preferred) Make the container-anchored panel visually merge** with the
  card: remove the gap, match width/background, suppress its own shadow, square the
  top corners so it reads as one taller card. Have to handle `.Popover-message`'s
  rounded bottom + shadow seam (maybe overlap it slightly upward). Keeps zero
  flicker. **Verify visually with the user.**
- (C) Inject into `.Popover-message` and re-inject on every wipe — rejected: the
  ~500ms rebuild gap can't be filled, so flicker is unavoidable there.
- (D) A fully custom standalone hovercard — user explicitly does NOT want this
  ("不是在 github card 上做接续吗").

Resolve the flicker (§5/§6) FIRST; don't polish styling on something that vanishes.

## 8. State / pointers

- Branch `feat/contributor-card`, PR #34. Commits: docs `2120557`, data `8bc9d58`,
  DOM `85e52ae`, fixes `d296798` / `3379c78` / `a84082d`.
- `dist/` is built from the latest; user reloads the unpacked extension to test.
- All unit tests pass (225). Tests use happy-dom + synthetic DOM — they DON'T
  catch the real-mouse flicker; treat them as logic guards, not proof it works.
- Design rationale & signal taxonomy: `docs/pr-signals-plan.md`.
