// Lightweight i18n that, unlike chrome.i18n (which is locked to the browser UI
// locale), supports an in-extension manual language override stored in
// chrome.storage.local. Catalogs are bundled so t() stays synchronous. The
// active locale defaults to English for everyone; we deliberately do NOT
// auto-detect the browser locale. Users opt into another language explicitly
// on the options page, and the choice can be applied at runtime via setLocale().
import enMessages from "../_locales/en/messages.json";
import zhCNMessages from "../_locales/zh_CN/messages.json";
import zhTWMessages from "../_locales/zh_TW/messages.json";

interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}
type Catalog = Record<string, MessageEntry>;

const CATALOGS: Record<string, Catalog> = {
  en: enMessages as unknown as Catalog,
  zh_CN: zhCNMessages as unknown as Catalog,
  zh_TW: zhTWMessages as unknown as Catalog,
};

/** A concrete catalog id. English is the default; other locales are opt-in. */
export type LocalePref = "en" | "zh_CN" | "zh_TW";
/** Order shown in the language picker. */
export const LOCALE_OPTIONS: LocalePref[] = ["en", "zh_CN", "zh_TW"];
/** chrome.storage.local key holding the LocalePref. */
export const LOCALE_KEY = "locale";
/** Locale used when the user hasn't explicitly picked one. */
export const DEFAULT_LOCALE: LocalePref = "en";

/** Normalize an arbitrary stored value to a known locale (en fallback). Also
 * absorbs the legacy "auto" preference, which no longer exists. */
function normalize(pref: unknown): LocalePref {
  return typeof pref === "string" && pref in CATALOGS ? (pref as LocalePref) : DEFAULT_LOCALE;
}

let currentLocale: LocalePref = DEFAULT_LOCALE;

/** Apply a preference immediately (synchronous). */
export function setLocale(pref: LocalePref): void {
  currentLocale = normalize(pref);
}

/**
 * Load the stored preference and apply it. Resolves to the effective locale
 * (DEFAULT_LOCALE when unset, unrecognized, or storage is unavailable) so
 * callers can reflect it in a picker. Safe to call repeatedly.
 */
export function initLocale(): Promise<LocalePref> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([LOCALE_KEY], (result) => {
        const pref = normalize(result?.[LOCALE_KEY]);
        setLocale(pref);
        resolve(pref);
      });
    } catch {
      resolve(DEFAULT_LOCALE);
    }
  });
}

function substitute(entry: MessageEntry, substitutions?: string | string[]): string {
  let msg = entry.message;
  if (entry.placeholders) {
    for (const [name, def] of Object.entries(entry.placeholders)) {
      msg = msg.split(`$${name}$`).join(def.content);
    }
  }
  const subs =
    substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  return msg.replace(/\$(\d)/g, (_match, digit: string) => subs[Number(digit) - 1] ?? "");
}

/** Resolve a message key for the active locale, falling back to English. */
export function t(key: string, substitutions?: string | string[]): string {
  const entry = CATALOGS[currentLocale]?.[key] ?? CATALOGS.en[key];
  if (!entry) return "";
  return substitute(entry, substitutions);
}

/**
 * Localize a static HTML subtree in place. Elements opt in via data attributes:
 *   data-i18n           → element.textContent
 *   data-i18n-html      → element.innerHTML (for messages with inline markup)
 *   data-i18n-title     → title attribute
 *   data-i18n-placeholder → placeholder attribute
 * The English copy stays in the HTML as the no-JS default; this swaps in the
 * active locale string and can be re-run after setLocale() to switch live.
 */
export function localizePage(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (key) el.textContent = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (key) el.innerHTML = t(key);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    const key = el.dataset.i18nTitle;
    if (key) el.setAttribute("title", t(key));
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (key) el.setAttribute("placeholder", t(key));
  });
}
