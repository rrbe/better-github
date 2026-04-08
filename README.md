# Better GitHub

A Chrome extension that enhances GitHub's UI with practical features.

Inspired by [Refined GitHub](https://github.com/refined-github/refined-github) — a great extension, but some bugs linger unfixed (e.g. the Releases tab) and certain feature requests go unaddressed due to scope control. Better GitHub fills those gaps.

Another motivation: Refined GitHub has too many features tightly coupled to GitHub's DOM, which breaks frequently as GitHub updates its UI. By keeping the feature set small and preferring the GitHub API over DOM manipulation, Better GitHub stays maintainable long-term.

## Features

- **PR Branch Names** — Display source branch name next to each PR title. Click to copy.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/pr-branch-name.png" alt="PR Branch Names" width="600" />
   </details>

- **PR Review Status** — Show review thread resolution status (resolved / unresolved) on the PR list. Only appears on PRs that have review threads; PRs without any review comments won't show a badge. Draft PRs are also excluded.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/pr-review-status.png" alt="PR Review Status" width="430" />
   </details>

- **Releases Tab** — Add a Releases tab to the repository navigation bar for quick access.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/releases-tab.png" alt="Releases Tab" width="800" />
   </details>

- **PR Label Position** — Move labels to the front of PR titles for better visibility and scanning.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/pr-label-position.png" alt="PR Label Position" width="500" />
   </details>

- **PR Approve Now** — Add an "approve now" shortcut to the Reviewers sidebar on PR detail pages for quick approval. Requires a token.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/pr-quick-approve.png" alt="PR Approve Now" width="300" />
   </details>

- **Default Sort by Updated** — Sort PR and issue lists by recently updated instead of GitHub's default creation time order. No more missing active PRs buried on page 2.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/pr-issue-default-sort.png" alt="Default Sort by Updated" width="600" />
   </details>

- **Commit Tags** — Show git tags as badges on the commits list page, so you can instantly see which commits are tagged releases.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/commit-tags.png" alt="Commit Tags" width="300" />
   </details>

- **Recent Commit Message Color** — Highlight recent commits with color based on their age, making it easy to spot the latest changes. This feature is always on.

   <details>
      <summary>Screenshot</summary>
      <img src="docs/screenshots/file-age-color.png" alt="Recent Commit Message Color" width="600" />
   </details>

All features except Recent Commit Message Color can be individually toggled on/off in the extension options.

## Install

1. Clone the repo and build:

   ```sh
   pnpm install
   pnpm build
   ```

2. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `dist` folder.

## Configuration

Right-click the extension icon → **Options**:

- **GitHub Token** — A **classic** personal access token for private repos and review status. Needs `repo` scope. [Create one here](https://github.com/settings/tokens).
- **Feature Toggles** — Enable or disable each feature individually. Changes take effect immediately.
