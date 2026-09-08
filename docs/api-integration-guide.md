# AI Sherlock 前后端联调接口文档

文档版本：`0.2-draft`  
更新时间：`2026-09-06`  
接口版本：`v2`

本文是浏览器插件、管理端和后端之间的联调契约，重点覆盖当前主流程所需的 5 个接口。文档同时标明“当前已实现”和“已对齐、待实现”，避免把目标设计误认为当前可调用能力。

## 1. 主流程与设计约束

```text
POC 使用项目 Ingest Token（正式环境先 Google SSO 登录）
  → 插件提交 Case
  → 后端解析上下文
  → diagnosis_run.mode=DIAGNOSE
  → Devin 返回 0..N 个 Findings
  → 用户选择一个 Finding 并点击 Auto Fix
  → diagnosis_run.mode=IMPLEMENT_CHANGE
  → Devin 修改该 Finding 对应的单一仓库并创建 PR
```

本轮对齐的约束：

- Case 首次提交统一进入诊断；插件请求不再包含 `issueType`。
- `diagnosis_run.mode` 继续使用 `DIAGNOSE`、`IMPLEMENT_CHANGE`，它表示任务类型，不是运行状态。
- 一个 Case 可以包含 `0..N` 个 Finding。
- 一个 Finding 绑定一个主要 Application 和一个主要 Repository，是最小 Auto Fix 单元。
- 跨仓库问题拆成多个 Finding；其他仓库的信息只作为 Evidence 或诊断上下文。
- 一个 Finding 可以有多次 Fix Attempt；重试只新增记录，不覆盖原 Finding 或历史结果。
- 用户点击 Auto Fix 就代表本次人工批准，不再经过旧的 `/change-request/approval` 主流程。
- Elastic 日志检索暂不实现，只保留扩展位置。

## 2. 地址、鉴权与可用性

| 环境 | Base URL |
|---|---|
| 本地 | `http://localhost:8080` |
| 外网 POC | `https://www.aisherlock.vip` |

接口状态：

| # | 方法与路径 | 用途 | 状态 |
|---:|---|---|---|
| 1 | `POST /api/v1/plugin/issues` | 插件提交 Case | 已实现（POC 使用 Ingest Token） |
| 2 | `GET /api/v1/public/statistics` | 官网统计接口及固定 500 故障 | 已实现 |
| 3 | `GET /api/v1/cases` | 分页 Case 列表 | 已实现（POC 按 Token 的 Project 隔离） |
| 4 | `GET /api/v1/cases/{caseKey}` | Case 详情及 Findings | 已实现 |
| 5 | `POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix` | 人工触发单个 Finding 的修复 PR | 已实现 |

为了先完成当天 POC 部署，除公开统计接口外，当前接口暂时继续使用项目级 Ingest Token：

```http
Authorization: Ingest local-demo-token
```

最终用户归属规则保持不变，但放到后续 SSO 阶段实施：

- `createdByUserId` 由后端从可信认证身份解析，客户端不能在请求 Body 中指定。
- 正式环境中插件未登录时不允许提交 Case。
- 正式环境创建 Case 时写入 `diagnosis_case.created_by_user_id`。
- POC 阶段暂不新增 `created_by_user_id`，Case 列表按照 Ingest Token 所属 Project 隔离。
- POC Token 只用于验证主链路，不能被解释为最终用户权限模型。

## 3. 通用约定

### 3.1 时间与字段命名

- 时间使用 ISO-8601 UTC，例如 `2026-09-06T02:00:00Z`。
- JSON 字段使用 `camelCase`。
- Case 对外使用 `caseKey`，数据库 UUID 不作为主要路由标识。
- Finding 对外使用 UUID `findingId`。
- 中文标题、描述、日志和错误文本按原文保存，不翻译、不替换。

### 3.2 幂等

提交 Case 和触发 Auto Fix 时应传递：

```http
Idempotency-Key: <同一业务操作唯一值，最大 200 字符>
```

- 相同作用域、相同 Key、相同请求返回第一次创建的资源。
- 相同 Key 对应不同请求返回 `409 Conflict`。
- Auto Fix 重试必须使用新的 Key。

### 3.3 通用错误结构

```json
{
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "timestamp": "2026-09-06T02:00:00Z",
  "violations": [
    {
      "field": "title",
      "message": "must not be blank"
    }
  ]
}
```

| HTTP | 含义 |
|---:|---|
| `200` | 查询成功 |
| `202` | 已接收，后台异步处理 |
| `400` | JSON、参数或字段校验失败 |
| `401/403` | 未登录、Token 无效或没有操作权限 |
| `404` | 资源不存在，或当前调用方无权看到该资源 |
| `409` | 幂等冲突、存在活动任务、Finding 已过期或状态不允许操作 |
| `413` | 请求体、事件数或截图大小超过限制 |
| `500` | 未处理的服务端异常 |

---

## 4. 接口一：插件提交 Case

### `POST /api/v1/plugin/issues`

接收插件原生 Payload。后端负责：

1. 校验请求大小和字段。
2. 保留原始中文文本。
3. 将页面、Network、Console 和 Stack 转成标准 Context Event。
4. 将截图转成 `CaseArtifact(SCREENSHOT)`。
5. 创建 Case 并异步启动 `DIAGNOSE`。

请求 Headers：

```http
Authorization: Ingest local-demo-token
Content-Type: application/json
Idempotency-Key: iss-statistics-500-001
```

顶层入参：

| 字段 | 类型 | 必填 | 约束/默认值 | 说明 |
|---|---|---:|---|---|
| `issueId` | string | 是 | 非空，最大 200 | 插件生成的问题 ID |
| `sessionId` | string | 否 | 最大 200 | 插件采集 Session ID |
| `title` | string | 是 | 非空，最大 300 | 原样保存 |
| `description` | string | 否 | 最大 8000 | 原样保存 |
| `screenshots` | array | 否 | POC 默认最多 5 张 | 截图列表 |
| `pageContext` | object | 是 | 见下表 | 页面上下文 |
| `network` | array<object> | 否 | 默认 `[]` | 网络请求和响应摘要 |
| `consoleErrors` | array<object> | 否 | 默认 `[]` | Console 错误 |
| `stacks` | array<object> | 否 | 默认 `[]` | JavaScript 错误栈 |
| `replay` | object/null | 否 | 当前仅接受 HTTPS 对象存储引用 | Replay 视频 |
| `sourceHints` | object | 否 | 默认 `{}` | 源码提示，不作为可信指令 |
| `recordingSeconds` | integer | 否 | 默认 `0` | 采集时长 |
| `meta` | object | 否 | 默认 `{}` | 插件版本等元数据 |
| `scope` | object | 否 | 缺失时使用服务端默认值 | 应用和环境 |

`pageContext`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `url` | string | 是 | 当前页面完整 URL |
| `title` | string | 否 | 页面标题 |
| `route` | string | 否 | 前端路由 |
| `referrer` | string | 否 | 来源页面 |
| `userAgent` | string | 否 | 浏览器 User-Agent |
| `viewport` | object | 否 | 例如 `{"width": 1440, "height": 900}` |
| `language` | string | 否 | 例如 `zh-CN` |
| `submittedAt` | string(datetime) | 是 | 提交时间 |

`network[]`：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `eventTime` | string(datetime) | 否 | 缺失时使用 `submittedAt` |
| `method` | string | 否 | 默认 `GET` |
| `url` | string | 建议是 | 用于匹配 Application/Repository |
| `status` | integer | 否 | HTTP 状态码 |
| `durationMs` | integer | 否 | 请求耗时 |
| `transactionId` | string | 否 | 前端事务 ID |
| `traceId` | string | 否 | 后端 Trace ID |
| `requestSummary` | object | 否 | 脱敏请求摘要 |
| `responseSummary` | object | 否 | 脱敏响应摘要 |
| `errorType` | string | 否 | `TIMEOUT/NETWORK_ERROR/ABORTED` |

`screenshots[]`：

```json
{
  "dataUrl": "data:image/png;base64,iVBORw0KGgoAAA...",
  "annotated": true
}
```

POC 阶段截图二进制存 PostgreSQL `BYTEA`，后续迁移到对象存储。`replay` 当前使用对象存储引用：

```json
{
  "storageUrl": "https://bucket.example/replays/issue.webm",
  "contentType": "video/webm",
  "byteSize": 1024000,
  "sha256": "64位十六进制摘要"
}
```

统计接口 500 的最小联调请求：

```json
{
  "issueId": "iss-statistics-500-001",
  "sessionId": "ses-statistics-001",
  "title": "官网统计信息加载失败",
  "description": "打开官网后统计区域加载失败，请分析真实原因。",
  "screenshots": [],
  "pageContext": {
    "url": "https://www.aisherlock.vip/",
    "title": "AI Sherlock",
    "route": "/",
    "userAgent": "Mozilla/5.0",
    "language": "zh-CN",
    "submittedAt": "2026-09-06T02:00:00Z"
  },
  "network": [
    {
      "eventTime": "2026-09-06T02:00:00Z",
      "method": "GET",
      "url": "https://www.aisherlock.vip/api/v1/public/statistics",
      "status": 500,
      "durationMs": 86,
      "traceId": "statistics-trace-001",
      "responseSummary": {
        "code": "INTERNAL_ERROR",
        "message": "An unexpected error occurred"
      }
    }
  ],
  "consoleErrors": [
    {
      "eventTime": "2026-09-06T02:00:01Z",
      "level": "error",
      "message": "统计信息加载失败：An unexpected error occurred"
    }
  ],
  "stacks": [],
  "sourceHints": {},
  "recordingSeconds": 5,
  "meta": {
    "pluginVersion": "0.1.0-mvp"
  },
  "scope": {
    "sourceApplication": "ai-sherlock-web",
    "environment": "poc"
  }
}
```

成功响应：`202 Accepted`

```http
Location: /api/v1/cases/SH-20260906-4EB4AD00
```

```json
{
  "caseKey": "SH-20260906-4EB4AD00",
  "status": "RECEIVED",
  "links": {
    "self": "/api/v1/cases/SH-20260906-4EB4AD00"
  }
}
```

兼容性说明：插件请求使用宽松 JSON 解析。旧客户端如果继续发送 `issueType`，该未知字段会被忽略，所有插件提交仍然进入 `DIAGNOSE`。

---

## 5. 接口二：官网统计接口（固定 500 故障）

### `GET /api/v1/public/statistics`

这是 POC 的真实故障接口，无需鉴权。目标用途是：

1. 官网调用接口并收到真实 `500`。
2. 插件采集 Network/Console 信息并提交 Case。
3. Devin 根据 Endpoint → Application → Repository 映射检查后端代码。
4. 用户针对生成的 Finding 点击 Auto Fix，最终创建修复 PR。

请求无 Query 和 Body：

```bash
curl -i http://localhost:8080/api/v1/public/statistics
```

故障修复前预期响应：`500 Internal Server Error`

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "timestamp": "2026-09-06T02:00:00Z",
  "violations": []
}
```

正常业务契约应为：`200 OK`

```json
{
  "totalCases": 0,
  "diagnosedCases": 0,
  "fixAttempts": 0,
  "pullRequestsCreated": 0,
  "diagnosisSuccessRate": 0.0,
  "autoFixSuccessRate": 0.0
}
```

POC 的预置缺陷是尚无 Auto Fix Attempt 时计算 PR 成功率触发除零错误。该错误必须来自真实后端代码，不应由 Mock、网关规则或随机失败生成。它在已有 Case、但还没有执行过 Auto Fix 的联调数据库中仍可稳定复现；修复后 `fixAttempts=0` 时 `autoFixSuccessRate` 应返回 `0.0`。

---

## 6. 接口三：分页 Case 列表

### `GET /api/v1/cases`

目标用途：管理端分页查询 Case。POC 阶段返回当前 Ingest Token 所属 Project 的 Case；接入 SSO 后收紧为当前用户及其角色授权范围。

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 约束/说明 |
|---|---|---:|---:|---|
| `page` | integer | 否 | `0` | 从 0 开始 |
| `size` | integer | 否 | `20` | `1..100` |
| `status` | string | 否 | - | 精确过滤 Case 状态 |
| `projectId` | UUID | 否 | - | 仅有相应 Project 权限时生效 |
| `keyword` | string | 否 | - | 匹配 `caseKey/title`，最大 100 |

排序固定为 `createdAt DESC, id DESC`，避免客户端传入任意排序字段。POC 使用页码分页；数据量增长后可兼容增加游标分页。

```bash
curl -sS 'http://localhost:8080/api/v1/cases?page=0&size=20&status=DIAGNOSED' \
  -H 'Authorization: Ingest local-demo-token'
```

成功响应：`200 OK`

```json
{
  "items": [
    {
      "caseKey": "SH-20260906-4EB4AD00",
      "title": "官网统计信息加载失败",
      "issueType": "UNKNOWN",
      "status": "DIAGNOSED",
      "sourceApplication": "ai-sherlock-web",
      "environment": "poc",
      "findingCount": 1,
      "createdAt": "2026-09-06T02:00:00Z",
      "updatedAt": "2026-09-06T02:02:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false
}
```

POC 权限规则：

- 只能看到 Token 所属 Organization、Group、Project 的 Case。
- `projectId` 只能等于 Token 所属 Project；传入其他值返回空分页。
- 无权访问的数据不应计入 `totalElements`。
- 列表不返回 `rawPayload`、完整 Evidence、截图二进制或 Devin 原始响应。

性能要求：

- 查询必须在数据库完成过滤和分页，禁止先加载全部 Case 再在 Java 内分页。
- 当前复用 `(project_id, created_at DESC)` 索引；SSO 阶段再增加用户维度索引。
- `findingCount` 应使用聚合查询或预聚合，避免逐条 Case 触发 N+1 查询。

SSO 阶段再改成 `created_by_user_id=当前用户`；`userId` 始终不能由普通客户端传入。

---

## 7. 接口四：Case 详情

### `GET /api/v1/cases/{caseKey}`

返回 Case 基本信息、最新诊断状态和当前诊断版本的 Findings。当前实现已聚合 `description`、`latestDiagnosis`、`findings` 以及每个 Finding 的 `latestFix`。

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `caseKey` | string | 是 | 插件提交接口返回的业务 Key |

```bash
curl -sS http://localhost:8080/api/v1/cases/SH-20260906-4EB4AD00 \
  -H 'Authorization: Ingest local-demo-token'
```

成功响应：`200 OK`

```json
{
  "caseKey": "SH-20260906-4EB4AD00",
  "title": "官网统计信息加载失败",
  "description": "打开官网后统计区域加载失败，请分析真实原因。",
  "issueType": "UNKNOWN",
  "status": "DIAGNOSED",
  "sourceApplication": "ai-sherlock-web",
  "environment": "poc",
  "occurredAt": "2026-09-06T02:00:00Z",
  "createdAt": "2026-09-06T02:00:01Z",
  "updatedAt": "2026-09-06T02:02:00Z",
  "workerEnabled": true,
  "pollAfterSeconds": 3,
  "latestDiagnosis": {
    "runId": "9b38d808-7855-466c-9407-70db98564562",
    "mode": "DIAGNOSE",
    "provider": "devin",
    "status": "COMPLETED",
    "summary": "The statistics endpoint divides by zero when there are no Auto Fix attempts.",
    "providerSessionUrl": "https://app.devin.ai/sessions/...",
    "createdAt": "2026-09-06T02:00:02Z",
    "finishedAt": "2026-09-06T02:01:58Z"
  },
  "findings": [
    {
      "id": "6a424b8e-31f8-4f41-89b1-5ccfcbfc47d1",
      "type": "BACKEND",
      "title": "Statistics calculation divides by zero",
      "application": "ai-sherlock-api",
      "repository": "tonymiao2012/ms-ai-sherlock",
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "file": "src/main/java/vip/aisherlock/statistics/PublicStatisticsService.java",
      "method": "getStatistics",
      "lineStart": 31,
      "lineEnd": 31,
      "rootCause": "The Auto Fix success-rate calculation divides by fixAttempts without handling zero.",
      "recommendedFix": "Return a zero success rate when fixAttempts is zero.",
      "aiConfidence": 0.96,
      "severity": "HIGH",
      "validationStatus": "FILE_LINES_VERIFIED",
      "evidenceRefs": ["evidence-uuid"],
      "latestFix": null
    }
  ]
}
```

Finding 约束：

- `type` 只表示问题层面：`FRONTEND`、`BACKEND`、`INTEGRATION`。
- 一个 Finding 只能包含一个主要 `application/repository/file` 修复目标。
- `INTEGRATION` 不代表必须跨仓库；如果前后端都需要修改，应生成两个 Finding。
- Finding 在一次成功的 `DIAGNOSE` Run 完成后保持不可变。
- 新一次诊断产生新一组 Findings，不覆盖旧 Run 的 Findings。
- Case 详情默认只返回最新一次成功诊断对应的 Findings。

`latestFix` 有值时：

```json
{
  "fixAttemptId": "fix-attempt-uuid",
  "runId": "implement-run-uuid",
  "status": "IMPLEMENTING",
  "pullRequestUrl": null,
  "lastError": null,
  "createdAt": "2026-09-06T02:05:00Z",
  "updatedAt": "2026-09-06T02:05:10Z"
}
```

`latestFix.status` 面向 UI 使用：

| 状态 | 含义 |
|---|---|
| `QUEUED` | 已接收，等待执行 |
| `IMPLEMENTING` | Devin 正在修改代码或创建 PR |
| `PR_CREATED` | PR 已创建 |
| `NO_CHANGE` | Devin 判断无需或无法形成代码变更 |
| `FAILED` | 本次尝试失败，可以再次触发 |
| `TIMED_OUT` | 本次尝试超时，可以再次触发 |
| `NEEDS_ATTENTION` | Devin 需要人工处理 |

Case 状态只表达 Case 整体诊断阶段。单个 Finding 修复失败或成功，不应把整个 Case 的诊断结果覆盖成 `FAILED` 或 `PR_CREATED`；每个修复结果由 `latestFix` 和历史 Fix Attempts 表达。

接口响应建议保留：

```http
Retry-After: 3
```

前端仅在诊断或修复仍在执行时轮询。

---

## 8. 接口五：触发单个 Finding Auto Fix

### `POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix`

用户点击 Auto Fix 时调用。该操作针对一个 Finding 创建新的 Fix Attempt 和新的 `IMPLEMENT_CHANGE` Run，不修改 Finding 本身。

请求 Headers：

```http
Authorization: Ingest local-demo-token
Content-Type: application/json
Idempotency-Key: finding-6a424b8e-fix-001
```

Path 参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `caseKey` | string | 是 | Finding 所属 Case |
| `findingId` | UUID | 是 | 要修复的 Finding |

请求 Body：

```json
{
  "instructions": "请补充 totalCases 为 0 的单元测试，并保持现有响应字段不变。"
}
```

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---:|---|---|
| `instructions` | string | 否 | 最大 4000 | 本次修复的补充要求；中文原样保存 |

客户端不能指定 Repository、Branch、Commit 或 PR 目标。后端必须从 Finding、Application Registry 和 Repository 配置中解析这些值，防止越权修改其他仓库。

成功响应：`202 Accepted`

```json
{
  "caseKey": "SH-20260906-4EB4AD00",
  "findingId": "6a424b8e-31f8-4f41-89b1-5ccfcbfc47d1",
  "fixAttemptId": "467fb4f0-c3df-4b30-8cea-a15d9de960a7",
  "runId": "3714610e-0083-4791-b518-c48b2867de3d",
  "mode": "IMPLEMENT_CHANGE",
  "status": "QUEUED",
  "links": {
    "case": "/api/v1/cases/SH-20260906-4EB4AD00"
  }
}
```

触发条件：

- Case 至少有一次 `mode=DIAGNOSE,status=COMPLETED` 的 Run。
- Finding 属于该 Case，并属于当前有效的最新诊断结果。
- Finding 已绑定一个经过服务端授权的主要 Application/Repository；POC 可关闭 GitHub 文件行号二次校验。
- 调用者有该 Case 和 Project 的修复权限。
- 当前 Finding 没有正在运行的 Fix Attempt。
- POC 阶段同一 Case 内任务串行执行；Case 有其他活动 Job 时返回 `409`。

触发时写入审计信息：

```text
approvalPolicy = MANUAL
approvalStatus = APPROVED
approvedBy = 当前认证用户
approvedAt = 当前时间
```

常见错误：

| HTTP | code | 场景 |
|---:|---|---|
| `404` | `FINDING_NOT_FOUND` | Finding 不存在、不属于 Case 或调用者无权访问 |
| `409` | `STALE_FINDING` | Case 尚无成功诊断，或 Finding 不属于当前有效诊断版本 |
| `409` | `STALE_FINDING` | Finding 不属于当前有效诊断版本 |
| `409` | `CASE_HAS_ACTIVE_JOB` | POC 串行策略下 Case 还有其他活动 Job |
| `409` | `CASE_HAS_UNRESOLVED_SESSION` | Case 存在未确认或未清理的 Devin Session |
| `409` | `FINDING_TARGET_UNVERIFIED` | 仓库或源码目标未验证，禁止修改 |

失败重试：

- `FAILED/TIMED_OUT/NEEDS_ATTENTION` 后允许重新调用本接口。
- 每次重试传新的 `Idempotency-Key`，可以提交不同的 `instructions`。
- 每次调用生成独立 Fix Attempt 和 `IMPLEMENT_CHANGE` Run。
- 历史 Prompt、用户补充说明、Devin 返回、Commit 和 PR URL 均保留，不覆盖。
- POC 阶段一次 Fix Attempt 只允许生成一个目标仓库的 PR，不做跨仓库原子修复。

---

## 9. 前端推荐联调顺序

```text
1. GET /api/v1/public/statistics
   → 收到真实 500

2. POST /api/v1/plugin/issues
   → 提交浏览器采集结果
   → 保存 caseKey

3. GET /api/v1/cases?page=0&size=20
   → 在“我的 Case”列表看到新 Case

4. GET /api/v1/cases/{caseKey}
   → 诊断期间按 pollAfterSeconds 轮询
   → status=DIAGNOSED 后展示 0..N Findings

5. POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix
   → 用户明确选择一个 Finding
   → 保存 fixAttemptId/runId

6. GET /api/v1/cases/{caseKey}
   → 轮询 finding.latestFix.status
   → PR_CREATED 后展示 pullRequestUrl
```

## 10. 后续工作

### Chrome 插件跨域配置

外网 POC 允许当前 AI Sherlock Chrome Extension Origin：

```dotenv
SHERLOCK_ALLOWED_ORIGIN_PATTERNS=chrome-extension://ikbbilafgkgcndjaacmlcmpmiofiibii
```

该值使用 Spring 的 Origin Pattern 配置，仅允许这个插件 Origin。插件还必须在
`manifest.json` 中声明：

```json
{
  "host_permissions": ["https://www.aisherlock.vip/*"]
}
```

CORS 不是鉴权，插件仍需按接口约定传递认证 Header。如果插件 ID 发生变化，需要同步修改该
配置并重新部署后端。

五个接口完成本地和外网 POC 验证后，再实施正式权限模型：

1. 给 `diagnosis_case` 增加 `created_by_user_id` 及用户时间倒序索引。
2. 接入 Google SSO，并让插件提交、Case 列表、详情和 Auto Fix 切换为 Bearer 用户身份。
3. 增加 Group Admin、Project Maintainer 和邮件白名单权限校验。

现有 `/api/v1/cases/{caseKey}/runs`、`/events`、`/evidence`、`/artifacts` 等接口继续作为诊断和运维辅助接口，但不是本轮前端主流程的核心依赖。
