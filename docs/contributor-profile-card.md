# Contributor Profile Card

Contributor Profile Card 在 GitHub 原生用户 hovercard 底部追加一组贡献者资料，
帮助用户快速了解不熟悉的贡献者。它只展示来自 GitHub 的客观信息，不打分、不贴
标签，也不判断账号或贡献质量。

## 展示内容

| 项目       | 内容                                                               | 数据来源                                                                            |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 账号年龄   | 账号创建至今的时间及创建月份                                       | REST `GET /users/{login}`                                                           |
| 本仓库关系 | Owner、Member、Collaborator、Contributor 或 First-time contributor | REST `GET /repos/{owner}/{repo}/issues?creator={login}` 返回的 `author_association` |
| 历史 PR    | PR 总数、已合并数、关闭但未合并数                                  | Search API                                                                          |
| 活跃度     | 过去一年的贡献数                                                   | GraphQL `contributionsCollection`                                                   |

本仓库关系仅在仓库页面且 GitHub 返回有效关系时展示。历史 PR 总数为零或查询失败
时不展示该行。

活跃度需要 GitHub token。未配置 token 时，卡片保留该行并提示用户连接 token；
其他公开资料仍可匿名获取，但受 GitHub API 匿名限额约束。

## 交互行为

- 功能默认开启，可在扩展设置的 Profile 分组中关闭。
- 只有用户 hovercard 出现时才按需请求当前用户的数据。
- 请求期间先展示与最终布局一致的 skeleton，避免内容加载造成布局跳动。
- 卡片接在 GitHub 原生 hovercard 下方，并跟随原卡片宽度、位置和明暗主题。
- GitHub 在头像与用户名之间切换或进行 SPA 导航时会重建 hovercard 内容；卡片挂载
  在稳定的外层容器上，避免重复请求和闪烁。
- 非用户 hovercard 不会被修改。

## 缓存与失败处理

- Service worker 使用 `chrome.storage.session` 缓存每项 GitHub API 结果 5 分钟，并
  合并相同 key 的并发请求。
- Content script 按 `仓库 + 用户` 缓存成功结果，避免跨仓库复用错误的贡献者关系。
- 网络错误、API 限流或未知用户不会渲染错误数据；失败请求冷却 60 秒后允许重试。
- 关闭功能时会断开 observer、清除内存缓存并移除已注入的卡片。

## 数据边界

- 所有资料都直接从 GitHub API 获取，不发送给第三方服务。
- GitHub token 保存在 Chrome 本地存储中，只用于请求 GitHub API。
- 功能不生成风险分数、可疑标签或颜色警告。
- Followers 和 public repository 数量虽然随用户资料一起返回，但当前不会展示。

## 代码位置

- 卡片渲染与 hovercard 集成：`src/features/contributor-card.ts`
- 账号年龄与仓库关系转换：`src/lib/contributor-signals.ts`
- GitHub API 请求与缓存：`src/service-worker.ts`
- Content script 请求桥接：`src/lib/github-api.ts`
- 请求和响应类型：`src/lib/messages.ts`
- 样式：`src/styles/content.css`
- 设置入口：`static/options.html`
- 文案：`src/_locales/*/messages.json`
