// Render consistent, code-informed GitHub examples for the README and store.
// Requires Google Chrome on macOS. The repository names and PR titles come from
// rrbe/better-github; status/count combinations illustrate extension features.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const temp = mkdtempSync(join(tmpdir(), "better-github-shots-"));
const logo = readFileSync(resolve(here, "../../static/icons/icon128.png")).toString("base64");
const icon = `data:image/png;base64,${logo}`;
const optionsHTML = readFileSync(resolve(here, "../../static/options.html"), "utf8")
  .replace('src="icons/icon48.png"', `src="${icon}"`)
  .replace('<script src="options.js"></script>', "");
const optionsData = `data:text/html;base64,${Buffer.from(optionsHTML).toString("base64")}`;

const css = `
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;color:#1f2328;background:#fff;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.top{height:64px;background:#0d1117;color:#f0f6fc;display:flex;align-items:center;gap:28px;padding:0 32px;font-size:15px}.top .mark{font-size:33px;line-height:1}.top .search{margin-left:auto;width:255px;border:1px solid #59636e;border-radius:6px;padding:8px 11px;color:#9198a1;font-size:13px}.top .signin{border:1px solid #59636e;border-radius:6px;padding:8px 13px}
.repo{height:65px;display:flex;align-items:center;padding:0 32px;gap:9px;background:#f6f8fa;border-bottom:1px solid #d1d9e0;font-size:20px}.repo a{color:#0969da;text-decoration:none}.repo strong{font-weight:600}.repo .public{font-size:12px;border:1px solid #d1d9e0;border-radius:20px;color:#59636e;padding:3px 8px;margin-left:6px}.repo .actions{margin-left:auto;display:flex;gap:8px}.button{background:#f6f8fa;border:1px solid #d1d9e0;border-radius:6px;padding:7px 12px;color:#1f2328;white-space:nowrap;font-size:13px}.button.green{background:#1f883d;color:white;border-color:#1f883d}.button .count{background:#eaeef2;border-radius:20px;padding:2px 7px;margin-left:6px}
.tabs{height:53px;display:flex;align-items:stretch;gap:26px;padding:0 32px;border-bottom:1px solid #d1d9e0;background:#f6f8fa}.tab{display:flex;align-items:center;gap:7px;padding:0 3px;color:#59636e;white-space:nowrap}.tab.active{color:#1f2328;border-bottom:2px solid #fd8c73;font-weight:600}.tab .counter{border-radius:20px;padding:1px 7px;background:#eaeef2;font-size:12px}
.body{padding:24px 32px}.titlebar{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}.h1{font-size:22px;font-weight:600}.query{border:1px solid #d1d9e0;border-radius:6px;padding:10px 13px;color:#59636e;margin-bottom:20px;height:38px}.query b{color:#1f2328;font-weight:500}.query .highlight{color:#0969da;background:#ddf4ff}.list{border:1px solid #d1d9e0;border-radius:6px;overflow:hidden}.listhead{height:48px;display:flex;align-items:center;gap:18px;background:#f6f8fa;padding:0 17px;border-bottom:1px solid #d1d9e0}.listhead .spacer{flex:1}.listhead .muted{color:#59636e}.row{height:92px;padding:13px 18px 10px;display:flex;gap:13px;border-bottom:1px solid #d1d9e0}.row:last-child{border-bottom:none}.row .pricon{color:#1a7f37;font-size:20px;width:20px}.rowcontent{min-width:0;flex:1}.rowtitle{display:flex;align-items:center;gap:6px;font-weight:600;font-size:16px;white-space:nowrap}.rowtitle .link{overflow:hidden;text-overflow:ellipsis}.rowmeta{color:#59636e;font-size:12px;margin-top:7px}.info{display:flex;align-items:center;gap:5px;margin-top:7px;font-size:12px;white-space:nowrap}.badge{display:inline-flex;align-items:center;border-radius:12px;padding:2px 8px;font-size:11px;line-height:16px;font-weight:600}.branch{background:#ddf4ff;color:#0969da;border:1px solid #b6e3ff}.label{background:#eaeef2;color:#343b43}.label.purple{background:#ede8ff;color:#6f42c1}.label.green{background:#dafbe1;color:#1a7f37}.review{background:#fff8c5;color:#9a6700}.resolved{background:#dafbe1;color:#1a7f37}.conflict{background:#fbca04;color:#000;border:1px solid #fbca04}.diff{background:#f6f8fa;color:#1a7f37}.diff .del{color:#cf222e;margin-left:5px}.diff .files{color:#59636e;margin-left:5px}.muted{color:#59636e}.blue{color:#0969da}.divider{height:1px;background:#d8dee4;margin:16px 0}
.note{position:absolute;right:34px;bottom:28px;background:#fff;border:1px solid #d1d9e0;box-shadow:0 12px 35px #1f232820;border-radius:10px;padding:17px 20px;max-width:345px}.note strong{display:block;margin-bottom:7px;font-size:15px}.note p{margin:0;color:#59636e;line-height:1.5}.callout{box-shadow:0 0 0 3px #54aeff55;border-radius:5px}
.panel{border:1px solid #d1d9e0;border-radius:7px;background:#fff;overflow:hidden}.panelhead{padding:13px 17px;background:#f6f8fa;border-bottom:1px solid #d1d9e0;font-weight:600}.panelbody{padding:18px}.grid{display:grid;grid-template-columns:1fr 300px;gap:24px}.prtitle{font-size:28px;margin:8px 0 8px;font-weight:500}.state{background:#1f883d;color:white;border-radius:20px;padding:6px 14px;display:inline-block}.sideitem{padding:14px 0;border-bottom:1px solid #d8dee4}.sideitem:last-child{border-bottom:0}.reviewers{display:flex;justify-content:space-between;align-items:center}.reviewers a{color:#0969da;text-decoration:underline}.filebar{display:flex;justify-content:space-between;align-items:center;background:#f6f8fa;padding:12px 16px;border:1px solid #d1d9e0;border-radius:6px 6px 0 0}.code{height:160px;background:repeating-linear-gradient(to bottom,#fff 0 28px,#f6f8fa 28px 29px);border:1px solid #d1d9e0;border-top:0;font:13px ui-monospace,SFMono-Regular,monospace;color:#57606a;padding:16px 45px;line-height:29px}.code .add{background:#dafbe1;color:#1a7f37}.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.commits .row{height:77px}.tag{background:#dafbe1;color:#1a7f37;border-radius:20px;padding:3px 9px;font-size:12px;font-weight:500}.age{color:#bc4c00}.age.old{color:#9a6700}.asset{display:flex;justify-content:space-between;padding:11px 16px;border-bottom:1px solid #d1d9e0}.asset:last-child{border:0}.download{color:#1a7f37;background:#dafbe1;border-radius:12px;padding:3px 8px}
.dash{display:grid;grid-template-columns:290px 1fr;gap:25px;padding:22px 32px}.dash h2{font-size:16px}.repoitem{padding:11px 3px;border-bottom:1px solid #eaeef2;color:#0969da}.pin{float:right;color:#0969da}.feeditem{padding:16px 0;border-bottom:1px solid #d1d9e0;color:#59636e}
.hover{position:absolute;background:#fff;border:1px solid #d1d9e0;border-radius:8px;box-shadow:0 12px 30px #1f232830;width:310px;z-index:3}.hover .hh{padding:15px;border-bottom:1px solid #d1d9e0}.hover .hb{padding:14px}.hover .hf{border-top:1px solid #d1d9e0;text-align:center;padding:10px;color:#0969da;font-weight:600}.avatar{width:28px;height:28px;background:#dbeafe;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;color:#0969da}.settings{width:530px;margin:35px auto}.settings h1{font-size:23px}.setting{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid #d8dee4}.setting small{display:block;color:#59636e;line-height:1.35;margin-top:4px}.switch{width:34px;height:20px;border-radius:15px;background:#1f883d;flex:none;margin-top:2px}.switch:after{content:'';display:block;width:14px;height:14px;border-radius:50%;background:#fff;margin:3px 0 0 17px}.token{border:1px solid #d1d9e0;border-radius:6px;padding:10px;color:#59636e;margin-top:8px}
.feature-only .top{display:none}.feature-only .repo{height:56px}.feature-only .tabs{height:44px}.feature-only .body{padding:14px 24px}.feature-only .row{height:90px}.feature-only .h1{font-size:19px}.feature-only .query{margin-bottom:13px}.feature-only .listhead{height:40px}.feature-only .dash{padding:15px 24px}.feature-only .prtitle{font-size:23px}
.num{margin-right:4px}.focus-contributor .hover{top:160px!important}.focus-number .row:nth-child(2) .num{position:relative;cursor:copy}.focus-number .row:nth-child(2) .num::after{content:"Click to copy PR number";position:absolute;left:0;top:23px;padding:6px 9px;background:#24292f;color:white;border-radius:5px;white-space:nowrap;z-index:2}.focus-sort .query,.focus-branch .row:nth-child(2) .branch,.focus-conflict .row:nth-child(2) .conflict,.focus-review .row:nth-child(2) .review,.focus-diff .row:nth-child(2) .diff,.focus-label .row:nth-child(2) .label,.focus-number .row:nth-child(2) .num,.focus-approve .reviewers a,.focus-collapse .toolbar .button.callout,.focus-tags .commits .tag,.focus-commit-diff .commits .diff,.focus-downloads .download,.focus-tab .tab:last-child,.focus-age .age,.focus-top .pin{box-shadow:0 0 0 3px #54aeff88;border-radius:5px}
`;

const top = `<div class="top"><img src="${icon}" width="32" height="32" alt=""><span>Platform ▾</span><span>Solutions ▾</span><span>Resources ▾</span><span>Open Source ▾</span><div class="search">⌕ &nbsp; Search or jump to...</div><span class="signin">Sign in</span></div>`;
const repo = `<div class="repo">▣ &nbsp;<a>rrbe</a> / <a><strong>better-github</strong></a><span class="public">Public</span><div class="actions"><span class="button">♧ &nbsp; Notifications</span><span class="button">⑂ &nbsp; Fork <span class="count">1</span></span><span class="button">☆ &nbsp; Star <span class="count">1</span></span></div></div>`;
function tabs(active = "Pull requests", enhanced = true, prCount = 1) {
  return `<div class="tabs">${["Code", "Issues", "Pull requests", "Actions", "Projects", "Security", "Insights", ...(enhanced ? ["Releases"] : [])].map((t) => `<div class="tab ${t === active ? "active" : ""}">${({ Code: "⌘", Issues: "◉", "Pull requests": "⑂", Actions: "◉", Projects: "▦", Security: "⬡", Insights: "⌁", Releases: "♢" })[t]} &nbsp;${t}${t === "Pull requests" ? `<span class="counter">${prCount}</span>` : t === "Releases" ? '<span class="counter">28</span>' : ""}</div>`).join("")}</div>`;
}
const titles = [
  [58, "feat: show in-progress Actions count", "feat/actions-in-progress-count"],
  [57, "fix: support current pull request list app", "fix/pr-list-repo-app"],
  [56, "fix: support compact pull request dashboard density", "fix/compact-pr-dashboard"],
  [55, "fix: support repository pull request dashboard preview", "fix/pr-dashboard-preview"],
  [54, "feat: add release count to Releases tab", "feat/release-tab-count"],
];
function prRow(i, enhanced = true) {
  const [n, title, branch] = titles[i];
  const label = i === 0 ? "enhancement" : i === 1 ? "bug" : "documentation";
  const conflict = i === 2;
  return `<div class="row"><div class="pricon">⑂</div><div class="rowcontent"><div class="rowtitle">${enhanced ? `<span class="badge label ${i === 0 ? "green" : "purple"}">${label}</span>` : ""}<span class="link">${title}</span>${enhanced ? `<span class="badge branch">${branch}</span>` : ""}</div><div class="rowmeta"><span class="num">#${n}</span> opened by rrbe · updated ${i + 1} days ago${!enhanced ? ` · ${label}` : ""}</div>${enhanced ? `<div class="info"><span class="badge ${i === 1 ? "review" : "resolved"}">${i === 1 ? "1 unresolved" : "All resolved"}</span><span class="badge diff">+${[458, 347, 182, 316, 329][i]}<span class="del">−${[34, 40, 8, 59, 6][i]}</span><span class="files">· ${[17, 17, 9, 11, 7][i]} files</span></span>${conflict ? '<span class="badge conflict">Conflicts</span>' : ""}</div>` : ""}</div></div>`;
}
function prList(enhanced = true, order = [0, 1, 2, 3, 4]) {
  return `${top}${repo}${tabs("Pull requests", enhanced, 5)}<div class="body"><div class="titlebar"><span class="h1">All pull requests</span><span class="button green">New pull request</span></div><div class="query">⌕ &nbsp; <b>is:pr state:open ${enhanced ? '<span class="highlight">sort:updated-desc</span>' : ""}</b></div><div class="list"><div class="listhead"><strong>Open <span class="count">5</span></strong><span class="muted">Closed <span class="count">57</span></span><span class="spacer"></span><span class="muted">Author &nbsp; ▾</span><span class="muted">Label &nbsp; ▾</span><span class="muted">Reviews &nbsp; ▾</span><span class="muted">Sort &nbsp; ▾</span></div>${order.map((i) => prRow(i, enhanced)).join("")}</div></div>`;
}
function detail(kind) {
  return `${top}${repo}${tabs()}<div class="body"><div class="prtitle">feat: show in-progress Actions count <span class="muted">#58</span></div><div style="margin-bottom:22px"><span class="state">⑂ Open</span> &nbsp; <strong>rrbe</strong> wants to merge 1 commit into <span class="badge branch">main</span> from <span class="badge branch">feat/actions-in-progress-count</span></div><div class="tabs" style="padding:0;gap:25px;background:#fff;height:42px"><div class="tab ${kind === "approve" ? "active" : ""}">Conversation</div><div class="tab">Commits <span class="counter">1</span></div><div class="tab">Checks <span class="counter">2</span></div><div class="tab ${kind === "collapse" ? "active" : ""}">Files changed <span class="counter">5</span></div></div><div class="grid" style="margin-top:20px"><div>${kind === "collapse" ? `<div class="toolbar"><span class="button">Filter files...</span><span><span class="button callout">▤ &nbsp; Collapse all files</span> &nbsp; <span class="button green">Submit review</span></span></div><div class="filebar"><span>▾ &nbsp; src/features/actions-in-progress-count.ts</span><span class="muted">+42 −3</span></div><div class="code"><div>23&nbsp; export function renderActionsCount() {</div><div class="add">+ &nbsp; const count = await fetchCount();</div><div class="add">+ &nbsp; updateNavigationBadge(count);</div><div>26&nbsp; }</div></div>` : `<div class="panel"><div class="panelhead">Conversation</div><div class="panelbody" style="height:240px"><span class="avatar">r</span><strong>rrbe</strong> opened this pull request<div class="divider"></div>Show the number of running workflows in repository navigation.</div></div>`}</div><div class="panel" style="padding:8px 16px;height:235px"><div class="sideitem reviewers"><strong>Reviewers</strong>${kind === "approve" ? '<a class="callout">approve now</a>' : ""}</div><div class="sideitem">No reviews yet</div><div class="sideitem"><strong>Labels</strong><div style="margin-top:10px"><span class="badge label green">enhancement</span></div></div></div></div></div>`;
}
function commits(kind) {
  return `${top}${repo}${tabs("Code")}<div class="body"><div class="h1" style="margin-bottom:20px">Commits</div><div class="panel commits"><div class="panelhead">Commits on Sep 22, 2026</div>${[
    ["chore: bump version to 1.18.4", "v1.18.4", "+2 −2 · 2 files"],
    ["fix: preserve trailing space in PR search input", "", "+18 −5 · 3 files"],
    ["docs: sync English README with Chinese updates", "", "+30 −12 · 2 files"],
    ["feat: support issue number copy", "", "+45 −3 · 4 files"],
  ].map(([title, tag, stats], i) => `<div class="row"><span class="pricon">●</span><div class="rowcontent"><div class="rowtitle">${title}</div><div class="rowmeta"><span class="avatar" style="width:17px;height:17px;font-size:10px;margin:0 4px 0 0">r</span> rrbe committed ${i + 1} days ago</div><div class="info">${tag ? `<span class="tag">◇ ${tag}</span>` : ""}${kind === "stats" ? `<span class="badge diff">${stats}</span>` : ""}</div></div><span class="muted">${["536607f", "9c7472f", "c310beb", "a2eba71"][i]}</span></div>`).join("")}</div></div>`;
}
function releases(kind) {
  return `${top}${repo}${tabs(kind === "tab" ? "Code" : "Releases")}<div class="body"><div class="h1" style="margin-bottom:20px">${kind === "tab" ? "better-github" : "Releases"}</div>${kind === "tab" ? `<div class="panel"><div class="panelhead">Files and folders</div><div class="panelbody" style="line-height:3">📁 .github<br>📁 docs<br>📁 src<br>📄 README.md</div></div>` : `<div class="panel"><div class="panelhead">v1.18.4 &nbsp; <span class="badge green">Latest</span></div><div class="panelbody"><div class="h1">v1.18.4</div><p class="muted">Published by rrbe</p><div class="divider"></div><strong>Assets <span class="count">1</span></strong><div style="margin-top:15px;border:1px solid #d1d9e0;border-radius:6px"><div class="asset"><span class="blue">better-github-v1.18.4.zip</span><span class="download callout">1 ⇩</span></div><div class="asset"><span class="muted">Source code (zip)</span></div><div class="asset"><span class="muted">Source code (tar.gz)</span></div></div></div></div>`}</div>`;
}
function dashboard() {
  return `${top}<div class="dash"><div class="panel"><div class="panelhead">Top repositories &nbsp; ⌕</div><div class="panelbody" style="padding-top:3px">${["rrbe/better-github", "rrbe/raycast-plugin-format-graphql", "rrbe/coding-island", "rrbe/grove", "rrbe/dev-tools"].map((r) => `<div class="repoitem">◉ &nbsp; ${r}<span class="pin">◆</span></div>`).join("")}</div></div><div><h2>Home</h2><div class="panel"><div class="panelhead">Activity</div><div class="panelbody">${["rrbe pushed to better-github", "rrbe opened a pull request in better-github", "rrbe released v1.18.4"].map((a) => `<div class="feeditem">◉ &nbsp; ${a}</div>`).join("")}</div></div></div>`;
}
function hover(kind) {
  const base = prList(true).replace(/<div class="note">.*$/s, "");
  if (kind === "contributor") return `${base}<div class="hover" style="left:165px;top:275px;width:330px"><div class="hh"><span class="avatar">r</span><strong>rrbe</strong><div class="muted" style="margin-top:8px">Building small tools for GitHub.</div></div><div class="hb"><strong>Better GitHub</strong><div class="divider"></div><div>Account age &nbsp; <strong>6 years</strong></div><div style="margin-top:10px">This repo &nbsp; <strong>Returning contributor</strong></div><div style="margin-top:10px">PR history &nbsp; <strong>57 PRs · 54 merged</strong></div><div style="margin-top:10px">Activity &nbsp; <strong>Active this year</strong></div></div></div>`;
  return `${top}${repo}${tabs("Code")}<div class="body"><div class="h1">better-github</div><p>A Chrome extension that enhances the GitHub experience.</p><div class="panel" style="width:760px;margin-top:22px"><div class="panelhead">Repository</div><div class="panelbody" style="height:230px">📁 &nbsp; docs<br><br>📁 &nbsp; src<br><br>📄 &nbsp; README.md</div></div></div><div class="hover" style="right:30px;top:120px"><div class="hh"><strong>Stargazers</strong><span style="float:right">1</span></div><div class="hb"><span class="avatar">r</span> rrbe</div><div class="hf">View all</div></div>`;
}
function settings() {
  return `${prList(true)}<div style="position:absolute;inset:0;background:#0d111755"></div><div style="position:absolute;right:80px;top:78px;background:#fff;border:1px solid #d1d9e0;border-radius:12px;box-shadow:0 24px 60px #0d111755;padding:12px"><iframe title="Better GitHub settings" src="${optionsData}" style="width:392px;height:620px;border:0;background:#fff"></iframe></div>`;
}
function bodyFor(id) {
  switch (id) {
    case "main_screenshot_without_better_github": return prList(false);
    case "main_screenshot_with_better_github": return prList(true);
    case "better-top-repositories": return dashboard();
    case "pr-issue-default-sort": return prList(true);
    case "pr-branch-name": return prList(true);
    case "pr-conflict-indicator": return prList(true, [2, 0, 1, 3, 4]);
    case "pr-review-status": return prList(true, [1, 0, 2, 3, 4]);
    case "pr-diff-stats": return prList(true);
    case "pr-label-position": return prList(true);
    case "pr-quick-approve": return detail("approve");
    case "pr-collapse-expand": return detail("collapse");
    case "contributor-card": return hover("contributor");
    case "commit-tags": return commits("tags");
    case "commit-diff-stats": return commits("stats");
    case "release-asset-downloads": return releases("assets");
    case "releases-tab": return releases("tab");
    case "watch-fork-star-popup": return hover("popup");
    case "file-age-color": return `${top}${repo}${tabs("Code")}<div class="body"><div class="panel"><div class="panelhead">Latest commit &nbsp; <span class="age">fix: preserve trailing space in PR search input</span> &nbsp; <span class="muted">2 days ago</span></div>${[".github", "docs", "src", "static", "README.md"].map((n, i) => `<div class="asset"><span class="blue">${n}</span><span class="${i < 2 ? "age" : "age old"}">${["2 days ago", "3 days ago", "7 days ago", "2 weeks ago", "last month"][i]}</span></div>`).join("")}</div></div>`;
    case "number-copy": return prList(true);
    case "store-pr-list": return prList(true);
    case "store-pr-detail": return detail("collapse");
    case "store-releases": return releases("assets");
    case "store-contributor": return hover("contributor");
    case "store-settings": return settings();
    default: throw Error(`Unknown screenshot: ${id}`);
  }
}

const readme = [
  "main_screenshot_without_better_github", "main_screenshot_with_better_github",
  "better-top-repositories", "pr-issue-default-sort", "pr-branch-name",
  "pr-conflict-indicator", "pr-review-status", "pr-diff-stats", "pr-label-position",
  "pr-quick-approve", "pr-collapse-expand", "contributor-card", "commit-tags",
  "commit-diff-stats", "release-asset-downloads", "releases-tab",
  "watch-fork-star-popup", "file-age-color", "number-copy",
];
const store = ["store-pr-list", "store-pr-detail", "store-releases", "store-contributor", "store-settings"];

try {
  const selected = process.argv.slice(2);
  for (const id of [...readme, ...store].filter((name) => selected.length === 0 || selected.includes(name))) {
    const isStore = id.startsWith("store-");
    const overview = id.startsWith("main_screenshot_");
    const width = isStore || overview ? 1280 : 1200;
    const height = isStore || overview ? 800 : 500;
    const focus = ({ "better-top-repositories": "top", "pr-issue-default-sort": "sort", "pr-branch-name": "branch", "pr-conflict-indicator": "conflict", "pr-review-status": "review", "pr-diff-stats": "diff", "pr-label-position": "label", "pr-quick-approve": "approve", "pr-collapse-expand": "collapse", "contributor-card": "contributor", "commit-tags": "tags", "commit-diff-stats": "commit-diff", "release-asset-downloads": "downloads", "releases-tab": "tab", "file-age-color": "age", "number-copy": "number" })[id] ?? "";
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body class="${isStore || overview ? "" : "feature-only"} focus-${focus}">${bodyFor(id)}</body></html>`;
    const source = join(temp, `${id}.html`);
    const output = resolve(here, isStore ? `chrome-web-store/${id.slice(6)}.png` : `${id}.png`);
    writeFileSync(source, html);
    rmSync(output, { force: true });
    await new Promise((resolveShot, rejectShot) => {
      const child = spawn(chrome, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${join(temp, id)}`, `--window-size=${width},${height}`, `--screenshot=${output}`, pathToFileURL(source).href], { stdio: "ignore", detached: true });
      const start = Date.now();
      const timer = setInterval(() => {
        if (existsSync(output) && statSync(output).size > 0) {
          clearInterval(timer);
          try { process.kill(-child.pid, "SIGTERM"); } catch { /* Chrome already exited. */ }
          resolveShot();
        } else if (Date.now() - start > 20000) {
          clearInterval(timer);
          try { process.kill(-child.pid, "SIGTERM"); } catch { /* Chrome already exited. */ }
          rejectShot(new Error(`Timed out rendering ${id}`));
        }
      }, 100);
      child.on("error", rejectShot);
    });
    console.log(`${id}: ${width}x${height}`);
  }
} finally {
  await new Promise((resolveDone) => setTimeout(resolveDone, 1000));
  rmSync(temp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
