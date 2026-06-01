import { describe, it, expect } from "vitest";
import { escapeHtml, pluralize } from "./utils";

describe("pluralize", () => {
  it("returns the singular form for exactly 1", () => {
    expect(pluralize(1, "file")).toBe("file");
  });

  it("returns the default plural (+s) for 0 and >1", () => {
    expect(pluralize(0, "file")).toBe("files");
    expect(pluralize(2, "file")).toBe("files");
  });

  it("respects a custom plural form", () => {
    expect(pluralize(1, "child", "children")).toBe("child");
    expect(pluralize(3, "child", "children")).toBe("children");
  });
});

describe("escapeHtml", () => {
  it("escapes angle brackets and ampersands", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("just text")).toBe("just text");
  });

  it("escapes markup but not quotes (text-content contract)", () => {
    expect(escapeHtml('<a href="x">hi</a>')).toBe('&lt;a href="x"&gt;hi&lt;/a&gt;');
  });
});
