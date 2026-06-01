// Read GitHub's per-user feature-flag set.
//
// GitHub server-renders the flags it has enabled for the logged-in user into a
// <script type="application/json" id="client-env"> in <head>:
//   { "locale": ..., "featureFlags": ["flag_a", "flag_b", ...], "login": ..., ... }
//
// Caveats — read before relying on this:
//  - A listed flag means GitHub *bucketed* the user into it, NOT that the
//    feature is visibly active. Users can opt out (e.g. via Feature Preview)
//    while the flag stays in the list — observed 2026: "dashboard_universe_2025"
//    remains listed even with the new dashboard turned OFF. So hasFlag() is at
//    best a weak hint; the live DOM is the only reliable source of truth for
//    "is this feature actually rendered". Detect features in the DOM, not here.
//  - It is the ENABLED set only. A flag that is off (or unknown) is simply
//    absent; you cannot enumerate "all" flags or read off-states from here.
//  - Flag names are GitHub-internal: undocumented, unstable, and may be renamed
//    or RETIRED without notice — typically when a feature reaches GA. So a flag
//    being absent is ambiguous ("not rolled out" vs "already GA").
//  - It is SSR'd once per full load; GitHub's Turbo/React soft navigations do
//    not reliably refresh it. These helpers re-read the DOM on every call, so
//    call them at point of use rather than caching the result across navigations.

const CLIENT_ENV_ID = "client-env";

interface ClientEnv {
  featureFlags?: string[];
  login?: string;
  locale?: string;
}

function readClientEnv(): ClientEnv | null {
  const el = document.getElementById(CLIENT_ENV_ID);
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as ClientEnv;
  } catch {
    return null;
  }
}

// All feature flags GitHub has enabled for the current user (empty if the
// client-env payload is missing or unparseable).
export function getEnabledFlags(): Set<string> {
  return new Set(readClientEnv()?.featureFlags ?? []);
}

// Whether GitHub bucketed the current user into a specific feature flag.
//
// NOTE: this is NOT "is the feature visibly active" — see the opt-out caveat
// above. To decide whether to drive a feature, detect it in the DOM; reach for
// hasFlag() only when there is genuinely no DOM/behavior signal to key off.
export function hasFlag(flag: string): boolean {
  return getEnabledFlags().has(flag);
}
