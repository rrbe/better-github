export interface RepoInfo {
  owner: string;
  repo: string;
}

export function getRepoInfo(): RepoInfo | null {
  const match = location.pathname.match(/^\/([^/]+)\/([^/]+)/);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];

  // Exclude non-repo pages
  const excluded = [
    "settings",
    "organizations",
    "notifications",
    "new",
    "login",
    "signup",
    "explore",
    "topics",
    "trending",
    "collections",
    "events",
    "sponsors",
    "features",
    "marketplace",
  ];
  if (excluded.includes(owner)) return null;

  return { owner, repo };
}

export function isPRListPage(): boolean {
  const info = getRepoInfo();
  if (!info) return false;
  // Match /{owner}/{repo}/pulls or /{owner}/{repo}/pulls?...
  return /^\/[^/]+\/[^/]+\/pulls(\/)?(\?.*)?$/.test(
    location.pathname + location.search
  );
}

export function isRepoPage(): boolean {
  return getRepoInfo() !== null;
}

export function isReleasesPage(): boolean {
  const info = getRepoInfo();
  if (!info) return false;
  return /^\/[^/]+\/[^/]+\/releases/.test(location.pathname);
}

export function getPRListParams(): {
  state: string;
  page: number;
  query: string;
} {
  const params = new URLSearchParams(location.search);
  const q = params.get("q") || "is:pr is:open";
  const page = parseInt(params.get("page") || "1", 10);
  const state = q.includes("is:closed") ? "closed" : "open";
  return { state, page, query: q };
}
