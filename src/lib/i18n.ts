// Lightweight i18n that, unlike chrome.i18n (which is locked to the browser UI
// locale), supports an in-extension manual language override stored in
// chrome.storage.local. Catalogs are bundled so t() stays synchronous; the
// active locale is resolved once from the stored preference (default: follow
// the browser locale) and can be changed at runtime via setLocale().
import enMessages from "../_locales/en/messages.json";
import zhCNMessages from "../_locales/zh_CN/messages.json";

interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string }>;
}
type Catalog = Record<string, MessageEntry>;

const CATALOGS: Record<string, Catalog> = {
  en: enMessages as unknown as Catalog,
  zh_CN: zhCNMessages as unknown as Catalog,
};

/** Locale preference: "auto" follows the browser, or a concrete catalog id. */
export type LocalePref = "auto" | "en" | "zh_CN";
/** Order shown in the language picker. */
export const LOCALE_OPTIONS: LocalePref[] = ["auto", "en", "zh_CN"];
/** chrome.storage.local key holding the LocalePref. */
export const LOCALE_KEY = "locale";

/** Map the browser UI language to one of our catalogs (en fallback). */
function resolveAuto(): string {
  let ui = "en";
  try {
    const g = globalThis as unknown as { chrome?: { i18n?: { getUILanguage?: () => string } } };
    ui = g.chrome?.i18n?.getUILanguage?.() || "en";
  } catch {
    ui = "en";
  }
  return /^zh/i.test(ui) ? "zh_CN" : "en";
}

let currentLocale = resolveAuto();

/** Apply a preference immediately (synchronous). */
export function setLocale(pref: LocalePref): void {
  currentLocale = pref === "auto" ? resolveAuto() : pref;
}

/**
 * Load the stored preference and apply it. Resolves to the stored pref
 * ("auto" when unset or storage is unavailable) so callers can reflect it in a
 * picker. Safe to call repeatedly.
 */
export function initLocale(): Promise<LocalePref> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([LOCALE_KEY], (result) => {
        const pref = (result?.[LOCALE_KEY] as LocalePref) || "auto";
        setLocale(pref);
        resolve(pref);
      });
    } catch {
      resolve("auto");
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
