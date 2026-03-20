# Better GitHub

一个增强 GitHub 界面的 Chrome 扩展。

灵感来自 [Refined GitHub](https://github.com/refined-github/refined-github)——功能强大，但部分 bug 长期未修复（如 Releases Tab），一些实用的 feature request 也未被采纳（因为 refined-github 功能已经太多了，要控制复杂度）。Better GitHub 补上了这些缺口。
还有一个点是 refined-github 有太多的功能是和 github 界面强绑定的，github 又经常改界面，所以很多功能都经常失效。只有保持功能足够少，并且尽量用 github api，少和 DOM 元素绑定，才能长期维护下去。

## 功能

- **PR 分支名显示** — 在 PR 标题旁显示源分支名，点击即可复制。

  <img src="docs/screenshots/branch-name-and-resolve-status.png" alt="PR 分支名与 Review 状态" width="400" />

- **PR Review 状态** — 在 PR 列表展示 review thread 的解决状态（已解决 / 未解决）。仅在 PR 存在 review thread 时显示，没有 review 评论的 PR 不会出现标记，draft pr 也不会。
- **Releases Tab** — 在仓库导航栏添加 Releases 标签页，快速访问。

   <img src="docs/screenshots/releases-tab.png" alt="Releases Tab" width="600" />

所有功能均可在扩展选项中单独开关。

## 安装

1. 克隆仓库并构建：

   ```sh
   pnpm install
   pnpm build
   ```

2. 打开 `chrome://extensions`，开启**开发者模式**，点击**加载已解压的扩展程序**，选择 `dist` 目录。

## 配置

右键扩展图标 → **选项**：

- **GitHub Token** — 用于访问私有仓库和获取 review 状态。需要 **classic** 类型的 token，勾选 `repo` 权限。[点此创建](https://github.com/settings/tokens)。
- **功能开关** — 独立控制每个功能的启用/禁用，修改后即时生效。
