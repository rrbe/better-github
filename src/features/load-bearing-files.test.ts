import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUrl } from "../test-utils/url";
import {
  classifyPath,
  injectLoadBearingFiles,
  cleanupLoadBearingFiles,
  type LoadBearingCategory,
} from "./load-bearing-files";

const GH = "https://github.com";
const FILES_URL = `${GH}/owner/repo/pull/42/files`;
const BADGE = ".better-github-load-bearing";

describe("classifyPath", () => {
  const cases: Array<[string, LoadBearingCategory]> = [
    // deps — manifests & lockfiles, including nested paths
    ["package.json", "deps"],
    ["frontend/package.json", "deps"],
    ["pnpm-lock.yaml", "deps"],
    ["yarn.lock", "deps"],
    ["go.mod", "deps"],
    ["Cargo.toml", "deps"],
    ["requirements.txt", "deps"],
    ["composer.lock", "deps"],
    // install — code that runs on install / git lifecycle
    ["Makefile", "install"],
    ["scripts/setup.py", "install"],
    ["binding.gyp", "install"],
    [".husky/pre-commit", "install"],
    // ci — privileged automation
    [".github/workflows/release.yml", "ci"],
    ["nested/.github/workflows/ci.yaml", "ci"],
    [".github/actions/build/action.yml", "ci"],
    [".gitlab-ci.yml", "ci"],
    ["Jenkinsfile", "ci"],
    [".circleci/config.yml", "ci"],
    [".github/dependabot.yml", "ci"],
    // build — docker + bundler config
    ["Dockerfile", "build"],
    ["docker-compose.yml", "build"],
    ["vite.config.ts", "build"],
    ["webpack.config.js", "build"],
    // sensitive — ownership, credentials, registry config
    [".github/CODEOWNERS", "sensitive"],
    [".npmrc", "sensitive"],
    ["certs/server.pem", "sensitive"],
    ["id_rsa", "sensitive"],
  ];

  it.each(cases)("classifies %s as %s", (path, category) => {
    expect(classifyPath(path)).toBe(category);
  });

  const ordinary = [
    "src/index.ts",
    "README.md",
    "docs/guide.md",
    "src/components/Button.tsx",
    "test/app.test.ts",
    "package.json.bak",
    "",
  ];

  it.each(ordinary)("treats %s as an ordinary file", (path) => {
    expect(classifyPath(path)).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(classifyPath("Package.JSON")).toBe("deps");
    expect(classifyPath("DOCKERFILE")).toBe("build");
    expect(classifyPath(".github/Workflows/Release.YML")).toBe("ci");
  });

  it("prefers the higher-scrutiny category when rules could overlap", () => {
    // dependabot.yml lives under .github/ but is automation config → ci, not deps
    expect(classifyPath(".github/dependabot.yml")).toBe("ci");
  });
});

/** A classic `.file` diff block carrying the path on data-tagsearch-path. */
function fileBlock(path: string): string {
  return `<div class="file" data-tagsearch-path="${path}">
    <div class="file-header"><div class="file-info"><a title="${path}">${path}</a></div></div>
    <div class="js-file-content"></div>
  </div>`;
}

function badgeCategories(): string[] {
  return [...document.querySelectorAll<HTMLElement>(BADGE)].map((b) => b.dataset.category ?? "");
}

describe("injectLoadBearingFiles (DOM)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    cleanupLoadBearingFiles();
  });

  afterEach(() => {
    cleanupLoadBearingFiles();
    document.body.innerHTML = "";
  });

  it("badges a load-bearing file next to its filename", () => {
    setUrl(FILES_URL);
    document.body.innerHTML = fileBlock("package.json");

    injectLoadBearingFiles();

    const badge = document.querySelector<HTMLElement>(BADGE);
    expect(badge).not.toBeNull();
    expect(badge!.dataset.category).toBe("deps");
    // Dropped inside .file-info, beside the filename.
    expect(badge!.closest(".file-info")).not.toBeNull();
  });

  it("leaves ordinary files unbadged", () => {
    setUrl(FILES_URL);
    document.body.innerHTML = fileBlock("src/app.ts");

    injectLoadBearingFiles();

    expect(document.querySelector(BADGE)).toBeNull();
  });

  it("badges multiple files with their respective categories", () => {
    setUrl(FILES_URL);
    document.body.innerHTML =
      fileBlock("package.json") +
      fileBlock(".github/workflows/ci.yml") +
      fileBlock("src/main.ts") +
      fileBlock(".npmrc");

    injectLoadBearingFiles();

    expect(badgeCategories().sort()).toEqual(["ci", "deps", "sensitive"]);
  });

  it("supports the classic .file[data-path] container", () => {
    setUrl(FILES_URL);
    document.body.innerHTML = `<div class="file" data-path="Dockerfile">
      <div class="file-header"></div></div>`;

    injectLoadBearingFiles();

    const badge = document.querySelector<HTMLElement>(BADGE);
    expect(badge?.dataset.category).toBe("build");
  });

  it("does not badge bare [data-path] elements (file-tree sidebar guard)", () => {
    setUrl(FILES_URL);
    // A sidebar entry uses data-path but is not a diff file block.
    document.body.innerHTML = `<div class="ActionList-item" data-path="config/secret.pem"></div>`;

    injectLoadBearingFiles();

    expect(document.querySelector(BADGE)).toBeNull();
  });

  it("does nothing off a PR files-changed page", () => {
    setUrl(`${GH}/owner/repo/pull/42`);
    document.body.innerHTML = fileBlock("package.json");

    injectLoadBearingFiles();

    expect(document.querySelector(BADGE)).toBeNull();
  });

  it("is idempotent — a second run does not add a duplicate badge", () => {
    setUrl(FILES_URL);
    document.body.innerHTML = fileBlock("package.json");

    injectLoadBearingFiles();
    injectLoadBearingFiles();

    expect(document.querySelectorAll(BADGE)).toHaveLength(1);
  });

  it("falls back to the container when there is no file-info/header", () => {
    setUrl(FILES_URL);
    document.body.innerHTML = `<div class="file" data-tagsearch-path="go.mod"></div>`;

    injectLoadBearingFiles();

    const block = document.querySelector<HTMLElement>(".file")!;
    expect(block.querySelector<HTMLElement>(BADGE)?.dataset.category).toBe("deps");
  });

  it("badges async-rendered files via the MutationObserver", async () => {
    setUrl(FILES_URL);
    injectLoadBearingFiles();

    const wrap = document.createElement("div");
    wrap.innerHTML = fileBlock("Cargo.toml");
    document.body.appendChild(wrap);

    // Let the observer callback and its rAF-coalesced scan flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector<HTMLElement>(BADGE)?.dataset.category).toBe("deps");
  });

  it("stops observing after cleanup", async () => {
    setUrl(FILES_URL);
    injectLoadBearingFiles();
    cleanupLoadBearingFiles();

    const wrap = document.createElement("div");
    wrap.innerHTML = fileBlock("package.json");
    document.body.appendChild(wrap);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(document.querySelector(BADGE)).toBeNull();
  });
});
