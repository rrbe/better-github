# Better GitHub

[English](README.md) | [中文](README_CN.md)

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/annimelofpkbcphbdikipjlconehbnpb)](https://chromewebstore.google.com/detail/better-github/annimelofpkbcphbdikipjlconehbnpb)

一个增强 GitHub 界面的 Chrome 扩展。

灵感来自 [Refined GitHub](https://github.com/refined-github/refined-github)——功能强大，但部分 bug 长期未修复（如 Releases Tab），一些实用的 feature request 也未被采纳（因为 refined-github 功能已经太多了，要控制复杂度）。Better GitHub 补上了这些缺口。
还有一个点是 refined-github 有太多的功能是和 github 界面强绑定的，github 又经常改界面，所以很多功能都经常失效。只有保持功能足够少，并且尽量用 github api，少和 DOM 元素绑定，才能长期维护下去。

> **注意：** 由于 GitHub 经常灰度测试功能，并且在 Feature Preview 中还有一些额外的功能开关，一些难以维护或经常变动的功能可能就不会加了，尽量控制项目在一个可维护的复杂度。

## 功能

### 首页

- **Better Top Repositories** — 自动展开侧边栏 "Top repositories" 列表，并支持将常用仓库置顶。适用于 Dashboard、Feed 页面和导航抽屉。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/better-top-repositories.png" alt="Better Top Repositories" width="300" />
   </details>

### Pull Requests

- **PR 分支名显示** — 在 PR 标题旁显示源分支名，点击即可复制。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-branch-name.png" alt="PR 分支名与 Review 状态" width="600" />
   </details>

- **PR Review 状态** — 在 PR 列表展示 review thread 的解决状态（已解决 / 未解决）。仅在 PR 存在 review thread 时显示，没有 review 评论的 PR 不会出现标记，draft PR 也不会。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-review-status.png" alt="PR Review 状态" width="430" />
   </details>

- **PR Label 前置** — 将 PR 标签移到标题前方，提升可读性和浏览效率。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-label-position.png" alt="PR Label 前置" width="500" />
   </details>

- **PR 快速 Approve** — 在 PR 详情页的 Reviewers 侧边栏添加"approve now"快捷按钮，快速通过 PR。需要 token。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-quick-approve.png" alt="PR 快速 Approve" width="300" />
   </details>

- **一键折叠/展开所有文件** — 在 diff 工具栏添加按钮，一键折叠或展开所有文件 diff；同时在文件树侧边栏添加按钮，一键折叠或展开所有目录。适用于 PR、commit 和 compare 页面，兼容新旧两种 "Files changed" 体验。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-collapse-expand-1.png" alt="一键折叠/展开所有文件" width="600" />
      <img src="docs/screenshots/pr-collapse-expand-2.png" alt="一键折叠/展开所有文件" width="300" />
   </details>

### PR & Issue 列表

- **默认按更新时间排序** — PR 和 Issue 列表默认按最近更新排序，而非 GitHub 默认的创建时间。不再错过活跃的 PR。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/pr-issue-default-sort.png" alt="默认按更新时间排序" width="600" />
   </details>

### 仓库页面

- **Releases Tab** — 在仓库导航栏添加 Releases 标签页，快速访问。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/releases-tab.png" alt="Releases Tab" width="800" />
   </details>

- **Watch/Fork/Star 悬浮预览** — 在仓库页面悬停 Watch、Fork 或 Star 的数字，即可弹出预览列表，展示关注者、Fork 者或 Star 用户，并提供 "View all" 链接跳转完整页面。结果缓存 5 分钟，减少 API 请求。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/watch-fork-star-popup.png" alt="Watch/Fork/Star 悬浮预览" width="400" />
   </details>

- **Commit 标签显示** — 在 commits 列表页展示 git tag 标记，一眼看出哪些 commit 对应了 release 版本。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/commit-tags.png" alt="Commit 标签显示" width="300" />
   </details>

- **最近提交 Commit Message 颜色** — 根据提交时间为最近的几个 commit message 添加颜色，帮助快速定位最新提交。常驻开启。

   <details>
      <summary>示例截图</summary>
      <img src="docs/screenshots/file-age-color.png" alt="最近修改文件颜色" width="600" />
   </details>

除"最近提交 Commit Message 颜色"外，所有功能均可在扩展选项中单独开关。

## 自行打包安装

1. 克隆仓库并构建：

   ```sh
   pnpm install
   pnpm build
   ```

2. 打开 `chrome://extensions`，开启**开发者模式**，点击**加载已解压的扩展程序**，选择 `dist` 目录。

## Chrome Web Store 中安装

[Chrome Web Store - Better Github](https://chromewebstore.google.com/detail/better-github/annimelofpkbcphbdikipjlconehbnpb)

## 配置

右键扩展图标 → **选项**：

- **GitHub Token** — 用于访问私有仓库和获取 review 状态。需要 **classic** 类型的 token，勾选 `repo` 权限。[点此创建](https://github.com/settings/tokens)。
- **功能开关** — 独立控制每个功能的启用/禁用，修改后即时生效。
