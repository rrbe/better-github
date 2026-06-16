# PR / 贡献者信号 — 设计与路线图

> 状态:**思路已定,范围已收敛。** 当前只落地一个独立 feature(load-bearing
> 文件高亮),其余信号体系**全部待定**——不是不做,而是先看这一个的效果再决定。
>
> 本文是讨论的固化档,目的是不丢掉已经想清楚的规则与权衡。后续任何相关
> feature 都应回到这里对照,而不是重新发散。

---

## 1. 背景 / 动机

开源维护者最近的真实痛点:大量用 AI 批量生成的低质量("vibe code"/slop)PR
与 issue,消耗维护者注意力。curl(Daniel Stenberg)反复吐槽过 AI slop 报告;
更早的 Hacktoberfest 也出现过整波刷 PR。

最初设想:做一个"垃圾鉴别器",靠"注册时间短 / 绿点稀疏 / 集中刷几个项目"
来识别这类账号。

**这个最初设想是危险的**,见第 2、4 节。我们把它重构成了"客观事实展示"
而非"对人下结论",并把范围收敛到一个零伦理风险的安全功能先做。

---

## 2. 核心设计原则(无论做哪一部分都成立)

1. **展示事实,不下结论。** 产品形态是"贡献者背景卡 / PR 信号"(context
   card),把**客观事实**低调地摆在维护者面前,判断权交还给人。**绝不**给任何
   人打"vibe coder"之类的标签——那本身可能构成骚扰/诽谤的载体,也极易误伤。

2. **置信分,不是硬规则。** 永远不要用 `注册<30天 → spam` 这种硬阈值。若将来
   做评分,用**加权置信分**(0–100)+ 一组"触发原因",并允许用户调灵敏度。

3. **体量是放大器,不是证据。** 代码量大 **本身不加分**;它只**放大其它负面
   信号的权重**(交互项/乘数)。老贡献者 + 关联 issue + 描述清晰的 8000 行 PR
   分数应当正常;同样 8000 行换成新账号 + 无关联 issue + 模板腔描述,体量才变
   红灯。把 size 当独立加分项会把最有价值的贡献者误伤得最狠。

4. **新 ≠ 垃圾。** 学生、隐藏私有贡献者、网络条件差地区的开发者、刚换号的老
   手,画像都和刷子高度重合。任何把"新人"直接判负的逻辑都伤害开源最需要的群体。

5. **贴合 better-github 既有纪律**(见 CLAUDE.md):
   - **fetch lazily, scoped to what's visible** —— 决定成败的一条线。
   - **不改 GitHub 原生 DOM**,只追加元素 / CSS 覆盖。
   - 网络请求走 service worker 的 `cachedFetch`(缓存 + in-flight 合并)。

---

## 3. 信号分类汇总(完整知识库 — 大多"待定")

按"是谁 / 怎么提 / PR 长什么样 / 是否团伙"四个维度。**权重方向**仅为记录,
真正启用前需重新校准。

### 3.1 账号画像信号("这个人是谁")—— 权重低,易误伤

- 账号年龄 **且** 突然爆发(注册三天就给五个高星项目各提一个 PR)。单看"新"
  无意义,要看"新 + 爆发"的组合。
- 粉丝/关注比异常(0 粉丝、互关环 follow-for-follow)。
- 资料信号:默认 identicon、空 bio、或堆满 buzzword 的 bio。
- 仓库组合:全是 fork / 教程克隆 / `my-portfolio` 模板 / `todo-app`,无原创且
  持续维护的项目。
- Pinned repo 是否空壳。

> ⚠️ 这一整类伦理风险最高、判别力最弱。即便将来做,权重也要压到很低,且只作
> "事实展示"(如"账号创建于 X")不作"判负"。

### 3.2 行为/时间信号("他怎么提的")—— 比静态画像强

- **集中度**:只打高星/trending 项目,从不碰小众仓库(刷简历/刷曝光特征)。
- **velocity/节奏**:短时间跨多个无关仓库提 PR;提交时间点过于规律(自动化)。
- **不跟进**:提完 PR 对 review comment 不回应、不改 —— **判别力很强**,真人会
  争论,刷子会消失。
- **拒绝率** `closed-unmerged / total PR` —— 单一信号里最强之一。可用 Search
  API 算(`type:pr author:X is:closed is:unmerged`)。
- 被维护者打过 spam/invalid 标签的历史。

### 3.3 内容信号("PR 本身长什么样")—— 最值钱,证据在 diff 里

- 改动琐碎:纯空白/格式化、给 contributors 加自己名字、README 改错别字、纯注释。
- **描述与 diff 错位**:描述声称"修复并发 bug",实际只动缩进 —— AI 生成 PR 的
  强指纹。
- AI 模板腔:description 复述 diff、emoji 满天飞、营销口吻
  ("This PR improves the codebase by...")。
- **幻觉引用**:引用不存在的 issue 编号 / 函数名 / 文件。
- **跨仓库雷同**:同一人在多个仓库提几乎一样的改动。
- CI 直接挂 / 没测试 / 误提交 `node_modules`、lockfile churn。

### 3.4 网络信号("团伙")—— 最高阶,成本高,几乎不误判

- 同日注册、命名类似(`user1234`)、互相在对方 PR 下点赞/评论的账号簇
  (sockpuppet ring)。需图分析,成本高。识别出来后误判率极低。

### 3.5 大 PR 信号(单独处理,逻辑与上面相反)

体量大是**放大器**(见原则 3)。大 PR 特有维度:

1. **有效体量 vs 名义体量**(最该做的指标)。剥掉生成物/vendored/纯空白后再
   算真实改动量。"8000 行"很可能 = 7200 行 lockfile + `dist/` + 300 行源码。两
   个数都摆出来,维护者一眼判断。剥离靠**路径启发式**即可(见第 6.3 节)。
2. **加法型 vs churn 型**。纯增不删(巨大 `+`、近 0 `-`)→ 倒进来的生成物/
   vendored/dump,污染仓库;对已有文件大 churn(又增又删)→ AI 全量重写/重排
   版,引入回归。两种 failure mode 不同。
3. **流程信号(对大 PR 权重最高)**。合理的大改动几乎一定**事先有
   issue/discussion/RFC** 且维护者点头(很多 CONTRIBUTING.md 明文要求)。真正
   的反模式 = "空降大 PR + 无前置讨论 + 还是此人在本仓库的第一个 PR"。
   "是否关联 issue" + "是否首次给本仓库提 PR" 组合,判别力强过行数本身。
4. **review 成本不对称即滥用**。大 PR 生成极便宜(AI 一句话),review 极贵。把
   "预计 review 负担"显性化,本身就帮维护者省了最贵的一步。
5. **安全:大 diff 是藏私货的最佳掩护(本插件独特价值点 → 见第 5 节)**。对
   构建/CI/依赖清单/安装脚本的微小恶意改动,可埋在几千行重排版/翻译里。
   xz/liblzma 供应链事件就是"在噪声里藏关键改动"的极端版。

---

## 4. 伦理与合规护栏(硬约束,任何阶段都不能破)

- 不公开给人贴标签;只展示客观事实。
- 不把"新人"判负。
- **不持久化存储、不对外发布个人画像**(规避 ToS 与法律风险)。缓存只为省
  rate limit,且仅本地、短时。
- 任何评分必须带"为什么(触发原因)",并可由用户调灵敏度。
- 见仓库 `PRIVACY.md`,新功能不得与其冲突。

---

## 5. ✅ 当前决定要做的:Load-bearing 文件高亮(独立 feature)

**为什么先挑它(从整个构想里抽出的最优子集):**

- **是安全功能,不是对人画像 → 零伦理风险。** 不碰第 3.1/3.2/3.4 那些雷区。
- **完全客观** —— 纯路径匹配,不需要 token,匿名可跑。
- **几乎零成本** —— 在 PR "Files changed" 页,文件路径与每文件 `+/-` **已渲染
  在 DOM 里**,核心高亮**连 API 都不用调**,比 `file-age-color` 还轻。
- **完美贴合现有模型** —— 套 `file-age-color.ts` 的"MutationObserver 限定
  `addedNodes` + 追加元素/CSS"套路,不改原生 DOM。
- **立刻见效** —— 验证手感后,再决定要不要往更重的 contributor card 走。

> 一句话:**风险最低、最快见效、可独立交付,与争议部分完全解耦。**

详细规格见第 6 节。

---

## 6. Feature 规格:Load-bearing 文件高亮

### 6.1 行为(MVP)

在 PR **Files changed** 页(`isPRFilesChangedPage()`),自动识别"承重文件"
(构建/CI/依赖/安装脚本等),在其文件头(file header)追加一个醒目角标
(如 ⚠️ "load-bearing" pill),并可选地把该行高亮,**即使它在整个 diff 里只占
几行**,也能让 reviewer 一眼看到。

- 纯追加元素 + CSS,不动 GitHub 原生 DOM。
- 不需要 token,公共/私有 PR 均匿名可用(信息全来自页面已渲染内容)。
- 受 options 开关控制,可关闭(沿用现有 feature flag 机制)。

### 6.2 Load-bearing 路径启发式(初版清单,后续可调)

> 命中即标记。匹配文件**全路径 + basename**。

- 依赖清单 / lockfile:`package.json`、`pnpm-lock.yaml`、`yarn.lock`、
  `package-lock.json`、`Cargo.toml`、`go.mod`、`go.sum`、`requirements.txt`、
  `pyproject.toml`、`poetry.lock`、`Gemfile(.lock)`、`composer.json(.lock)`、
  `pom.xml`、`build.gradle(.kts)`。
- 安装/生命周期脚本:`package.json` 内的 `scripts`(尤其 `postinstall`/
  `preinstall`/`prepare`)—— MVP 先按文件名标 `package.json`,深入到脚本字段
  属增强项(见 6.5)。`*.gyp`、`binding.gyp`、`setup.py`、`Makefile`。
- CI / 自动化:`.github/workflows/**`、`.github/actions/**`、`.gitlab-ci.yml`、
  `.circleci/**`、`Jenkinsfile`、`azure-pipelines.yml`、
  `.github/dependabot.yml`。
- 构建/工具配置:`Dockerfile`、`docker-compose*.yml`、`*.Dockerfile`、
  `vite.config.*`、`webpack.config.*`、`rollup.config.*`、`tsconfig*.json`、
  `.npmrc`、`.yarnrc*`、`esbuild*`。
- 发布/权限敏感:`.github/CODEOWNERS`、`.git*` 钩子相关、`*.pem`/密钥类
  (命中即高亮,通常不该出现在 PR)。

### 6.3 生成物 / vendored 路径启发式(用于"有效体量",见第 7 节待定项)

> 与 load-bearing 相反,这些是"应被剥离"的体量。

- `node_modules/`、`dist/`、`build/`、`out/`、`vendor/`、`third_party/`、
  `*.min.js`、`*.min.css`、`*.map`、`*.generated.*`、`*.pb.go`、
  `.gitattributes` 标了 `linguist-generated` 的路径、大数据文件
  (`*.csv`/`*.json` 超阈值)、各类 lockfile(同时也是 load-bearing,展示时归
  "依赖"类别更合适)。

### 6.4 落地接入(贴现有结构)

- **新文件**:`src/features/load-bearing-files.ts`,导出 `injectLoadBearingFiles()`
  (+ 必要的 `cleanup...()`)。
- **模板**:`src/features/file-age-color.ts`(MutationObserver 限定
  `mutation.addedNodes`,`requestAnimationFrame` 合并;PR 文件列表是增量渲染的)。
- **页面判定**:`src/lib/page-detect.ts` 已有 `isPRFilesChangedPage()`、
  `isDiffPage()`、`isPRDetailPage()`、`getRepoInfo()`、`getPRNumber()`,直接复用。
- **注册**:在 `src/content.ts` 的 import 列表 + feature key 数组
  (`feature-...`)+ CSS class 清单中登记;feature 开关沿用现有机制。
- **样式**:`src/styles/content.css` 加角标/高亮样式;badge 尺寸须对齐
  GitHub 原生(见 memory: info-row badge sizing)。
- **i18n**:文案走 `src/lib/i18n.ts`,中/英两套(角标 tooltip、类别名)。
- **测试**:`src/features/load-bearing-files.test.ts`,vitest + happy-dom,断言
  "给定一组文件路径 → 正确识别 load-bearing 集合 + 注入角标"(行为断言,非纯
  覆盖)。
- **DOM 选择器**:PR Files changed 页每个文件块的 file header(含 `data-path`/
  文件名链接)。**实现前需在真实页面用 chrome-devtools 核对当前选择器**(GitHub
  DOM 会变),不要照搬本文档臆测的 class 名。

### 6.5 明确的非目标(本 feature 不做)

- 不抓取作者画像、不调任何账号/历史 API。
- 不算评分、不下结论。
- 不深入解析 `package.json` 的 `scripts` 字段 diff(MVP 只按文件名标记;
  解析具体脚本变更属后续增强)。
- 不做跨仓库比对。

---

## 7. 待定(Deferred — 看效果再决定,不是放弃)

按"价值/成本/风险"排序,从易到难:

| 项 | 内容 | 主要门槛 |
|----|------|----------|
| D1 | **PR 体量构成**:有效体量 vs 名义体量、加法 vs churn(第 3.5.1–2) | 可纯 DOM(Files changed 页有每文件 +/-),低成本;先看 D0 效果 |
| D2 | **本仓库流程信号**:是否关联 issue、是否首次给本仓库提 PR、本仓库历史 merge 率(第 3.5.3) | 需 API,但 scope 到当前 owner/repo,可控 |
| D3 | **contributor context card**(账号年龄、历史 merge 率、活跃度) | **必须带 token**(GraphQL 强制);多数用户没配 token → UX 悬崖。**只能在单 PR 页,不能进列表**(rate limit) |
| D4 | 拒绝率(Search API)、内容信号(描述/diff 错位、模板腔、幻觉引用) | API 成本 + 启发式准确度 |
| D5 | 置信分模型(size 作乘数)+ 灵敏度调节 | 需 D1–D4 多数信号就位后才有意义 |
| D6 | 网络/sockpuppet ring 分析 | 图分析,成本最高;最后考虑 |

> **决策记录(2026-06-16):** 先只做第 5/6 节的 load-bearing 高亮(记为 D0)。
> D1–D6 全部待定,以 D0 的实际反馈作为是否继续投入的依据。

---

## 8. API / 成本备忘(供 D1+ 启用时参考)

- 优先 **GraphQL**(一次拿 `createdAt`、`contributionsCollection`、按 state 分
  组 PR、followers、repositories,省 rate limit)。**注意 GraphQL 强制 token。**
- 拒绝率用 Search API:`type:pr author:X is:closed is:unmerged`。
- PR 对象自带 `additions`/`deletions`/`changed_files`/`commits` —— **不用拉
  diff 就能拿体量**。要算 composition 再拉 `pulls/{n}/files`(带每文件增删 +
  status,不强制 patch);只有少数 load-bearing 文件才需真拉 patch 内容。
- 所有"按 user/按 PR"的结果**必须缓存**(走 `cachedFetch`),否则 5000/hr 很快
  爆。匿名只有 60/hr。
- 不持久化对外画像(见第 4 节)。
