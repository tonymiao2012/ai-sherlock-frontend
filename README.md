# AI Sherlock

AI 驱动的问题诊断平台：从浏览器一键采集问题现场，自动补全日志与源码证据，LLM 定位根因并生成 JIRA 工单，人工审批后由 AI 自动修复、创建 PR，合并即发布 UAT。

> 让每一个 Bug 都有迹可循。

## 组成与现状

| 模块 | 说明 | 状态 |
| --- | --- | --- |
| Chrome 插件 | 问题现场采集与提报（本仓库当前实现） | MVP 已可用 |
| 后端服务 | Context 解析、Evidence 补全、AI 诊断编排、JIRA 集成（Spring Boot + PostgreSQL） | 技术设计完成，待开发 |
| 中台 | 项目管理、JIRA 看板、人工审批 → LLM 自动修复 → PR → UAT 自动发布 | PRD 完成，待开发 |

## 插件功能

- **区域截图 + 批注**：微信式页内工具条，框选即截，方框 / 马赛克 / 文字标注
- **rrweb 录屏**：问题操作过程完整录制，报告内回放
- **自动采证**（MAIN world 注入，无感采集）：
  - Network 请求与错误（含请求/响应体摘要）
  - Console 日志（log / warn / error）
  - 未捕获异常与 Promise rejection
  - 容量上限：Network 300 条 / Console 300 条 / Error 100 条 / rrweb 40000 事件，防内存膨胀
- **侧边栏编辑器式提报**：标题、描述、截图、录制草稿自动落盘，面板重开后不丢失
- **报告单预览**：Report 页汇总全部证据（当前 payload 输出到 console，后端对接中）

## 目录结构

```
├── extension/            # Chrome 插件（WXT + React 19 + antd v6 + rrweb）
│   ├── entrypoints/
│   │   ├── background/       # Service Worker
│   │   ├── content/          # 内容脚本（截图、采集中转）
│   │   ├── injected.content/ # MAIN world 采集脚本（monkey-patch fetch/XHR/console）
│   │   ├── sidepanel/        # 侧边栏提报编辑器
│   │   └── report/           # 报告单预览页
│   ├── components/       # ReportApp、ReplayPlayer、BrandLogo 等
│   ├── core/             # 类型、消息协议、本地草稿存储、主题
│   └── scripts/preview.mjs # 一键调试环境
├── docs/                 # 设计文档（HTML）
├── test-page/            # 本地测试页
└── assets/               # LOGO 与视觉规范
```

## 快速开始

环境要求：[Bun](https://bun.sh)（包管理）、Chrome / Edge 浏览器。

```bash
cd extension
bun install          # 安装依赖
bun run dev          # 开发模式（构建到 .output/chrome，改动热更）
```

在 Chrome 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `extension/.output/chrome`。

### 一键调试环境

```bash
bun run preview       # 生产构建 + 本地服务测试页 + 启动即自检注入
bun run preview:fast  # 跳过构建，直接复用现有产物
```

`preview` 会自动打开本地测试页并注入采集脚本做自检，适合发布前快速验证证据链是否完整。

### 生产构建

```bash
bun run build         # 构建到 .output/chrome
bun run zip           # 打包为 zip，可直接上传应用商店
```

## Web 前端持续集成

`landing-page` 和 `admin-page` 使用根目录的 pnpm workspace。使用 Node.js 24
以及 `package.json` 中指定的 pnpm 版本，在根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm build
```

`.github/workflows/build.yml` 在代码合并或直接推送到 `main` 后自动构建，
也可在 GitHub Actions 的 **Frontend Build → Run workflow** 手动触发。
构建包含两个 Web 应用的 TypeScript 检查，产物分别为 `landing-page/dist/`
和 `admin-page/dist/`，可在运行页面下载，保留 7 天。此流程不部署站点，
也不构建使用独立 Bun 配置的 `extension`。

CI 默认按官网 `/`、中台 `/admin/`、API `/api/v1` 构建。在仓库
**Settings → Secrets and variables → Actions → Variables** 可配置
`VITE_API_BASE`、`VITE_GOOGLE_CLIENT_ID`、`VITE_DOCS_URL` 和
`VITE_CHROME_STORE_URL`。这些值会写入浏览器端产物，不能用于存放密钥。
Google Client ID 未配置时仍可构建，但 Google 登录不可用。

## 设计文档

`docs/` 目录下的 HTML 文档，浏览器直接打开：

| 文档 | 内容 |
| --- | --- |
| `issue-diagnosis-prd.html` | 产品设计：插件采集 → 后端诊断 → JIRA 工单全链路 |
| `ai-sherlock-backend-technical-design.html` | 后端技术设计 V1.2：领域模型、Evidence 补全、AI 编排、API 与状态机 |
| `middle-platform-prd.html` | 中台 PRD V1.1：双通道登录、项目管理、JIRA 看板、LLM 自动修复流水线、UAT 发布 |

## Roadmap

- [ ] 插件 payload 上报后端（替换 console 输出）
- [ ] 后端 MVP：Case / Context / Evidence / JIRA 自动建单
- [ ] 中台 MVP：Google 登录、项目管理、JIRA 看板
- [ ] 人工审批 → Devin 自动修复 → PR 回写 JIRA
- [ ] PR Merge 后自动发布 UAT

## 参与贡献

1. Fork 本仓库并新建 `feat_xxx` 分支
2. 提交代码，保持提交信息符合 `feat: / fix: / docs:` 规范
3. 新建 Pull Request
