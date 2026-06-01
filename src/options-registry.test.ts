import { describe, expect, it } from "vitest";
import optionsHtml from "../static/options.html?raw";
import contentSource from "./content.ts?raw";
import optionsSource from "./options.ts?raw";

function extractFeatureKeysFromConst(source: string): string[] {
  const match = source.match(/const FEATURE_KEYS = \[([\s\S]*?)\] as const;/);
  if (!match) throw new Error("FEATURE_KEYS constant not found");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (m) => m[1]);
}

function extractFeatureCheckboxIds(html: string): string[] {
  return Array.from(
    html.matchAll(/<input\b[^>]*\bid="(feature-[^"]+)"/g),
    (m) => m[1],
  );
}

describe("feature registry", () => {
  it("keeps options UI checkboxes, options script, and content script keys in sync", () => {
    const htmlIds = extractFeatureCheckboxIds(optionsHtml);
    const optionsKeys = extractFeatureKeysFromConst(optionsSource);
    const contentKeys = extractFeatureKeysFromConst(contentSource);

    expect(new Set(optionsKeys)).toEqual(new Set(htmlIds));
    expect(new Set(contentKeys)).toEqual(new Set(htmlIds));
  });
});
