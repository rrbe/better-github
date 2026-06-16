// Load-bearing file highlight.
//
// On a PR "Files changed" page, flags the few "load-bearing" files — dependency
// manifests, install/lifecycle scripts, CI config, build config, and otherwise
// security-sensitive files — that are easy to miss when buried in a large diff.
// A small malicious change to one of these (a postinstall script, a CI workflow,
// a registry redirect in .npmrc) has outsized impact, so we surface them.
//
// The classification (classifyPath) is pure path-matching: no token, no network,
// no profiling of the author. The DOM layer only appends a badge — it never
// mutates GitHub's own structure. Modeled on file-age-color.ts.
import { isPRFilesChangedPage } from "../lib/page-detect";
import { t } from "../lib/i18n";

export type LoadBearingCategory = "deps" | "install" | "ci" | "build" | "sensitive";

interface Rule {
  category: LoadBearingCategory;
  /** Receives the lowercased full path and the (original-case) basename. */
  test: (lowerPath: string, basename: string) => boolean;
}

function baseOf(path: string): string {
  const clean = path.replace(/[\\/]+$/, "");
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? clean : clean.slice(idx + 1);
}

// Dependency manifests & lockfiles — a changed/added dependency is the classic
// supply-chain vector.
const DEP_FILES = new Set([
  "package.json",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "yarn.lock",
  "bun.lockb",
  "deno.lock",
  "cargo.toml",
  "cargo.lock",
  "go.mod",
  "go.sum",
  "requirements.txt",
  "pyproject.toml",
  "poetry.lock",
  "pipfile",
  "pipfile.lock",
  "gemfile",
  "gemfile.lock",
  "composer.json",
  "composer.lock",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "package.swift",
  "podfile",
  "podfile.lock",
]);

// Scripts that execute on install/build — arbitrary code execution at a moment
// reviewers rarely scrutinize.
const INSTALL_FILES = new Set(["makefile", "gnumakefile", "rakefile", "setup.py", "binding.gyp"]);

// Bundler/build tooling whose config can execute arbitrary code or rewrite the
// shipped artifact. Deliberately conservative — common-but-benign configs such
// as tsconfig.json are excluded to keep the signal high.
const BUILD_BASENAME_RE =
  /^(?:vite|webpack|rollup|rspack|esbuild|babel|tsup|turbo|gulpfile|metro)\.config\.[cm]?[jt]s$/;

// Rules are evaluated in order; the first match wins. Higher-scrutiny categories
// come first.
const RULES: Rule[] = [
  // --- sensitive: secrets, ownership, registry/auth config ---
  {
    category: "sensitive",
    test: (_p, base) =>
      base === "codeowners" ||
      base === ".npmrc" ||
      base === ".yarnrc" ||
      base === ".yarnrc.yml" ||
      /\.(?:pem|key|p12|pfx|keystore|jks)$/.test(base) ||
      base === "id_rsa" ||
      base === "id_ed25519",
  },
  // --- ci: runs in a privileged context with access to secrets ---
  {
    category: "ci",
    test: (p, base) =>
      p.includes("/.github/workflows/") ||
      p.startsWith(".github/workflows/") ||
      p.includes("/.github/actions/") ||
      p.startsWith(".github/actions/") ||
      base === "action.yml" ||
      base === "action.yaml" ||
      base === ".gitlab-ci.yml" ||
      base === ".travis.yml" ||
      base === "jenkinsfile" ||
      base === "azure-pipelines.yml" ||
      base === "dependabot.yml" ||
      p.includes("/.circleci/") ||
      p.startsWith(".circleci/"),
  },
  // --- install: executes during install / git lifecycle ---
  {
    category: "install",
    test: (p, base) =>
      INSTALL_FILES.has(base) ||
      base.endsWith(".gyp") ||
      p.includes("/.husky/") ||
      p.startsWith(".husky/"),
  },
  // --- deps: dependency manifests & lockfiles ---
  {
    category: "deps",
    test: (_p, base) => DEP_FILES.has(base),
  },
  // --- build: docker + bundler/tooling config ---
  {
    category: "build",
    test: (_p, base) =>
      base === "dockerfile" ||
      base.endsWith(".dockerfile") ||
      /^docker-compose.*\.ya?ml$/.test(base) ||
      BUILD_BASENAME_RE.test(base),
  },
];

/**
 * Classify a repository file path. Returns the load-bearing category, or null
 * for ordinary files. Pure and case-insensitive (paths are matched lowercased).
 */
export function classifyPath(path: string): LoadBearingCategory | null {
  if (!path) return null;
  const lowerPath = path.toLowerCase();
  const basename = baseOf(lowerPath);
  for (const rule of RULES) {
    if (rule.test(lowerPath, basename)) return rule.category;
  }
  return null;
}

const BADGE_CLASS = "better-github-load-bearing";
const MARKER = "bgLoadBearing"; // dataset key marking a processed container

// Short label shown in the badge, by category.
function labelKey(category: LoadBearingCategory): string {
  return {
    deps: "lbLabelDeps",
    install: "lbLabelInstall",
    ci: "lbLabelCi",
    build: "lbLabelBuild",
    sensitive: "lbLabelSensitive",
  }[category];
}

// Tooltip explaining why the file warrants scrutiny, by category.
function tipKey(category: LoadBearingCategory): string {
  return {
    deps: "lbTipDeps",
    install: "lbTipInstall",
    ci: "lbTipCi",
    build: "lbTipBuild",
    sensitive: "lbTipSensitive",
  }[category];
}

// Diff file containers carry the path on `data-tagsearch-path` (blob/diff views)
// or `data-path` on classic `.file` blocks. We deliberately do NOT match bare
// `[data-path]` — the file-tree sidebar uses it too and would get false badges.
// NOTE: GitHub's diff DOM shifts between the server-rendered and React views;
// verify these selectors against a live "Files changed" page before trusting.
function findFileContainers(root: ParentNode): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  root.querySelectorAll<HTMLElement>("[data-tagsearch-path]").forEach((el) => seen.add(el));
  root
    .querySelectorAll<HTMLElement>(".file[data-path], .js-file[data-path]")
    .forEach((el) => seen.add(el));
  return [...seen];
}

function pathOf(container: HTMLElement): string | null {
  return (
    container.getAttribute("data-tagsearch-path") ?? container.getAttribute("data-path") ?? null
  );
}

// Where to drop the badge: next to the filename if we can find it, else the
// header, else the container itself.
function badgeTarget(container: HTMLElement): HTMLElement {
  return (
    container.querySelector<HTMLElement>(".file-info") ??
    container.querySelector<HTMLElement>(".file-header") ??
    container
  );
}

function buildBadge(category: LoadBearingCategory): HTMLElement {
  const badge = document.createElement("span");
  badge.className = `${BADGE_CLASS} ${BADGE_CLASS}--${category}`;
  badge.dataset.category = category;
  badge.title = t(tipKey(category));

  const icon = document.createElement("span");
  icon.className = `${BADGE_CLASS}-icon`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "⚠";

  const text = document.createElement("span");
  text.textContent = t(labelKey(category));

  badge.append(icon, text);
  return badge;
}

function processContainer(container: HTMLElement): void {
  if (container.dataset[MARKER]) return;
  const path = pathOf(container);
  if (!path) return;
  const category = classifyPath(path);
  // Mark regardless of outcome so we don't re-classify the same container.
  container.dataset[MARKER] = "1";
  if (!category) return;

  const target = badgeTarget(container);
  if (target.querySelector(`.${BADGE_CLASS}`)) return;
  target.appendChild(buildBadge(category));
}

function scan(root: ParentNode = document): void {
  for (const container of findFileContainers(root)) processContainer(container);
}

let observer: MutationObserver | null = null;
let rafId = 0;

function scheduleScan(): void {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    scan();
  });
}

export function injectLoadBearingFiles(): void {
  cleanupLoadBearingFiles();
  if (!isPRFilesChangedPage()) return;

  scan();

  // Files render incrementally; coalesce mutation bursts into one pass per frame.
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          scheduleScan();
          return;
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function cleanupLoadBearingFiles(): void {
  observer?.disconnect();
  observer = null;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  // Clear processing markers so a re-enable re-injects badges (the badge
  // elements themselves are stripped by removeFeatureElements()). MARKER
  // "bgLoadBearing" maps to the attribute data-bg-load-bearing.
  document
    .querySelectorAll<HTMLElement>("[data-bg-load-bearing]")
    .forEach((el) => delete el.dataset[MARKER]);
}
