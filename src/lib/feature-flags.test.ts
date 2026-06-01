import { beforeEach, describe, expect, it } from "vitest";
import { getEnabledFlags, hasFlag } from "./feature-flags";

function setClientEnv(json: string): void {
  document.body.innerHTML = `<script type="application/json" id="client-env">${json}</script>`;
}

describe("feature-flags", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("reads the enabled flag set from GitHub's client-env payload", () => {
    setClientEnv(JSON.stringify({ featureFlags: ["flag_a", "flag_b"], login: "octocat" }));

    expect(getEnabledFlags()).toEqual(new Set(["flag_a", "flag_b"]));
    expect(hasFlag("flag_a")).toBe(true);
    expect(hasFlag("flag_missing")).toBe(false);
  });

  it("returns an empty set when client-env is absent", () => {
    expect(getEnabledFlags().size).toBe(0);
    expect(hasFlag("anything")).toBe(false);
  });

  it("returns an empty set when client-env is not valid JSON", () => {
    setClientEnv("{ not json");
    expect(getEnabledFlags().size).toBe(0);
  });

  it("tolerates a payload with no featureFlags field", () => {
    setClientEnv(JSON.stringify({ login: "octocat" }));
    expect(getEnabledFlags().size).toBe(0);
  });
});
