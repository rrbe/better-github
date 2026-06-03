import { describe, it, expect, afterEach } from "vitest";
import { t, setLocale, localizePage } from "./i18n";

describe("i18n", () => {
  afterEach(() => setLocale("en"));

  it("resolves English by default", () => {
    setLocale("en");
    expect(t("approveNow")).toBe("approve now");
    expect(t("saved")).toBe("Saved!");
    expect(t("settingsTitle")).toBe("Settings");
  });

  it("switches to Simplified Chinese via setLocale", () => {
    setLocale("zh_CN");
    expect(t("approveNow")).toBe("立即批准");
    expect(t("settingsTitle")).toBe("设置");
  });

  it("switches to Traditional Chinese via setLocale", () => {
    setLocale("zh_TW");
    expect(t("approveNow")).toBe("立即核准");
    expect(t("settingsTitle")).toBe("設定");
    expect(t("featPrCollapseExpandName")).toBe("摺疊/展開所有檔案");
  });

  it("substitutes positional placeholders in both locales", () => {
    setLocale("en");
    expect(t("tokenValid", "octocat")).toBe("Valid — authenticated as octocat");
    expect(t("diffStatsTitleWithFiles", ["1,234", "56", "3 files"])).toBe(
      "1,234 additions, 56 deletions across 3 files",
    );
    setLocale("zh_CN");
    expect(t("commitTagTitle", "v1.0.0")).toBe("标签：v1.0.0");
  });

  it("falls back to English for a legacy/unknown preference", () => {
    // "auto" was a valid preference before we dropped browser auto-detection;
    // an existing user may still have it stored. It must resolve to English.
    setLocale("auto" as unknown as Parameters<typeof setLocale>[0]);
    expect(t("settingsTitle")).toBe("Settings");
    expect(t("approveNow")).toBe("approve now");
  });

  it("returns empty string for an unknown key", () => {
    setLocale("zh_CN");
    expect(t("__does_not_exist__")).toBe("");
  });

  it("localizePage swaps text/title/placeholder by data attribute", () => {
    setLocale("zh_CN");
    document.body.innerHTML = `
      <h2 data-i18n="settingsTitle">Settings</h2>
      <span data-i18n-html="tokenClassicTitle">x</span>
      <button data-i18n-title="closeSearch">x</button>
      <input data-i18n-placeholder="searchFeaturesPlaceholder" />
    `;
    localizePage();
    expect(document.querySelector("h2")?.textContent).toBe("设置");
    expect(document.querySelector("span")?.innerHTML).toContain("<b>scopes</b>");
    expect(document.querySelector("button")?.getAttribute("title")).toBe("关闭搜索");
    expect(document.querySelector("input")?.getAttribute("placeholder")).toBe("搜索功能…");
    document.body.innerHTML = "";
  });
});
