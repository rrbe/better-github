# 可疑账号识别 · 贡献者背景卡 — 设计

> 状态:**MVP 设计已闭环**(经讨论逐项确认),尚未实现。本文是共识记录 +
> 信号知识库。后续相关 feature 都回到这里对照,不重新发散。
>
> 草稿,未提交。

---

## 0. 一句话

在 hover 用户名时,往 GitHub 原生 hovercard 底部**追加一块客观事实**,帮看的人
判断"**这个账号可不可疑**"——而不是替他下结论。

---

## 1. 目标与边界

**要解决的真实痛点**:GitHub 上大量用 AI 批量生成的低质量("vibe code"/slop)
PR,消耗维护者注意力。我们想帮人快速识别**可疑账号**。

**明确的边界(MVP 只做左边):**

| MVP 做 | MVP 不做(待定,见第 6 节) |
|--------|--------------------------|
| 识别**可疑账号**(关于"人"的事实) | 识别**可疑 PR**(关于"这次改动"的事实) |
| 展示客观事实 | 打分 / 风险等级 |
| 单个账号按需查询(hover) | 跨账号网络/团伙分析 |

> 为什么先做"账号"不做"PR":选了 hovercard 形态(见第 3 节),它是**作者卡**,
> 只能放关于人的信号;PR 级信号(是否关联 issue、体量、描述质量)是 PR 页才有的
> 落点,属于另一个 feature。

---

## 2. 核心原则(伦理护栏 — 任何阶段都不能破)

1. **展示事实,不下结论。** 形态是"背景卡 / context card",把客观事实低调摆出,
   判断权交给看的人。**绝不**贴"vibe coder"之类标签——那本身可能成为骚扰/诽谤
   载体,也极易误伤。
2. **MVP 不打分。** 不输出"可疑分 / 风险等级"。打分既易误伤,又把工具推向网暴。
   纯事实、中性配色、不标红。
3. **新 ≠ 垃圾。** 学生、隐藏私有贡献者、网络差地区开发者、刚换号的老手,画像
   都和刷子重合。所以"账号 3 天"只平铺直叙地显示,不染红、不暗示可疑。
4. **不持久化、不对外发布个人画像。** 缓存只为省 rate limit,且仅本地、短时。
5. **贴合 better-github 纪律**:fetch lazily/scoped(hover 才查、一次一人);不改
   原生 DOM(只追加);请求走 service worker 的 `cachedFetch`(缓存 + 合并)。

---

## 3. MVP 设计(逐项已确认)

### 3.1 形态:增强原生 hovercard

hover 用户名时 GitHub 自己会弹原生 hovercard(头像/名字/bio/followers/Follow)。
我们**往它底部追加一块**,而不是另做一张卡。

- ✅ 体验原生、不会两张卡打架、契合"只追加不改原生"。
- ⚠️ **已知技术风险点**:原生 hovercard 异步加载,DOM 结构与出现时机刁钻,需用
  observer 等它出现再注入。**实现时务必先在真实页面核对 DOM 再写代码**(吸取
  上一轮"臆测选择器"的教训)。
- 覆盖面广:PR 列表、Issue、评论区——任何出现用户名的地方都生效。

### 3.2 信号(4 个)

| 信号 | 数据来源 | 是否要 token |
|------|----------|-------------|
| **账号年龄** | REST `/users/{login}` 的 `created_at` | 否 |
| **与本仓库/组织关系** | PR 的 `author_association`(`FIRST_TIME_CONTRIBUTOR` / `NONE` / `CONTRIBUTOR` / `MEMBER` / `OWNER`) | 否 |
| **历史 merge 率 / 拒绝率** | Search API:`type:pr author:X is:merged` vs `is:closed is:unmerged` 的 `total_count` | 否(匿名限额低) |
| **活跃度 / 绿点总数** | GraphQL `contributionsCollection` | **是** |

(followers + 公开 repo 数:信号弱,暂不纳入;需要可随时加。)

### 3.3 token 降级

- **无 token**:显示前三个免费事实;活跃度行显示"🔒 连接 token 查看"。
- **有 token**:活跃度行显示真实贡献数。

### 3.4 卡片样子(追加块,纯事实/中性)

```
   （GitHub 原生 hovercard：头像 / 名字 / bio / followers…）
  ─── Better GitHub ───────────────
   账号年龄    3 天（2026-06 创建）
   本仓库      首次贡献者
   历史 PR     8 提交 · 2 合并（25%）
   活跃度      🔒 连接 token 查看        ← 无 token 时
```

有 token 时末行:`活跃度   近一年 1,240 次贡献`。

### 3.5 落地接入提示(供实现时参考,尚未写)

- 复用 `src/lib/page-detect.ts`、service worker 的 `cachedFetch`(**每个 user 缓存
  一次**,hover 重复同一人直接命中)。
- i18n 走 `src/lib/i18n.ts`,中/英/繁三套。
- 作为可开关 feature 注册(`content.ts` 的 FEATURE_KEYS + `options.ts` + options.html
  + locale 文案),默认行为待定(考虑到要 token,可能默认关或首次提示)。
- 测试:数据解析(年龄/比率计算)纯函数优先做成可单测的;DOM 注入用 happy-dom。

---

## 4. 信号知识库(完整,大多待定)

> 讨论中梳理过的全部信号,留档备用。**权重方向仅为记录,启用前需重新校准。**

### 4.1 账号画像(关于"人")—— 权重低,易误伤

账号年龄(单看无意义,要"新 + 突然爆发")、粉丝/关注比异常、空 bio/默认头像/
buzzword bio、仓库全是 fork/模板、pinned 空壳。**MVP 只取"账号年龄"**,其余待定且
权重要低。

### 4.2 行为/时间(关于"人")—— 比静态画像强

集中只打高星项目、velocity 异常/时间点规律(自动化)、**提完不跟进 review**(判别
力强)、**拒绝率 closed-unmerged/total**(单信号最强之一)、被打 spam 标签史。
**MVP 取"历史 merge/拒绝率"。** 其余待定。

### 4.3 内容(关于"PR 本身")—— 最值钱,但属 PR 级,MVP 不做

改动琐碎、**描述与 diff 错位**(AI 强指纹)、模板腔、**幻觉引用**(不存在的 issue/
函数)、跨仓库雷同、CI 直接挂/误提交 node_modules。**全部待定**(需 PR 页落点)。

### 4.4 网络/团伙 —— 最高阶,成本最高,最后考虑

同日注册、命名类似、互相点赞评论的 sockpuppet ring。需图分析。**待定。**

### 4.5 大 PR —— 待定

有效体量 vs 名义体量(剥离生成物/vendored/lockfile)、加法 vs churn、流程信号
(是否关联 issue/RFC、是否首次给本仓库)、review 成本不对称。属 PR 级,**待定。**

---

## 5. 与本目标无关的旁支(显式记录,避免再走偏)

- **Load-bearing 文件高亮**(在大 PR diff 里标 build/CI/deps/install 文件):它是
  **通用安全审查辅助**,对所有 PR 一视同仁,**不判断可疑性**,因此**不属于"可疑
  账号识别"这个目标**。曾被探索并实现后回滚。若将来想做,应作为**独立的安全向
  feature**,不要混进本设计。

---

## 6. 待定(Deferred — 看 MVP 效果再决定,不是放弃)

| 项 | 内容 | 门槛 |
|----|------|------|
| D1 | **PR 级"垃圾 PR"信号**:是否关联 issue、有效体量、描述与 diff 错位、模板腔、幻觉引用 | 需 PR 页落点;描述类靠启发式,准确度待验 |
| D2 | 更多账号画像信号(粉丝比、仓库组合等) | 权重低、易误伤,需谨慎 |
| D3 | followers + 公开 repo 数 | 信号弱 |
| D4 | 置信分模型(若做,size 作乘数,带触发原因 + 灵敏度调节) | 需多数信号就位才有意义;且与"不打分"原则冲突,需重新决策 |
| D5 | 网络/sockpuppet 分析 | 图分析,成本最高 |

---

## 7. API / 成本备忘

- **REST 匿名可用**:`/users/{login}` → `created_at`、`followers`、`public_repos`;
  PR 对象自带 `author_association`(常已在页面 DOM 里)。
- **Search API**:merge/拒绝数用 `total_count`;匿名约 10 req/min,带 token 30/min。
  hovercard 按需(一次一人)+ `cachedFetch`,够用。
- **GraphQL**:`contributionsCollection`(绿点)**强制 token**。
- 所有"按 user"的结果**必须缓存**;匿名 REST 仅 60/hr。
- 不持久化对外画像(见第 2 节)。
