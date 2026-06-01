import { describe, it, expect } from "vitest";
import { detectPageMarker } from "./page-marker";

describe("detectPageMarker", () => {
  it("marks the PR list page", () => {
    expect(detectPageMarker("/owner/repo/pulls")).toBe("pr-list");
    expect(detectPageMarker("/owner/repo/pulls/")).toBe("pr-list");
  });

  it("marks the commits list page", () => {
    expect(detectPageMarker("/owner/repo/commits")).toBe("commits-list");
    expect(detectPageMarker("/owner/repo/commits/main")).toBe("commits-list");
  });

  it("does not mark a single PR or unrelated pages", () => {
    expect(detectPageMarker("/owner/repo/pulls/3")).toBeNull();
    expect(detectPageMarker("/owner/repo/issues")).toBeNull();
    expect(detectPageMarker("/owner/repo")).toBeNull();
    expect(detectPageMarker("/")).toBeNull();
  });
});
