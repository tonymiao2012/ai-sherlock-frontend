import { useState, useEffect } from 'react';

const sections = [
  { id: 'overview', label: '概述' },
  { id: 'auth', label: '鉴权与地址' },
  { id: 'conventions', label: '通用约定' },
  { id: 'api-1', label: '提交 Case' },
  { id: 'api-2', label: '统计接口' },
  { id: 'api-3', label: 'Case 列表' },
  { id: 'api-4', label: 'Case 详情' },
  { id: 'api-5', label: 'Auto Fix' },
  { id: 'workflow', label: '联调顺序' },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: '#1e1e2e',
      color: '#cdd6f4',
      padding: '16px',
      borderRadius: '8px',
      overflow: 'auto',
      fontSize: '13px',
      lineHeight: '1.5',
      margin: '16px 0',
    }}>
      <code>{children}</code>
    </pre>
  );
}

function Endpoint({ method, path, status }: { method: string; path: string; status?: string }) {
  const methodColors: Record<string, string> = {
    GET: '#22c55e',
    POST: '#3b82f6',
    PUT: '#f59e0b',
    DELETE: '#ef4444',
  };
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
      marginBottom: '16px',
      fontFamily: 'monospace',
      flexWrap: 'wrap',
    }}>
      <span style={{
        background: methodColors[method] || '#64748b',
        color: '#fff',
        padding: '4px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        flexShrink: 0,
      }}>
        {method}
      </span>
      <span style={{ fontSize: '14px', color: '#1e293b', wordBreak: 'break-all' }}>{path}</span>
      {status && (
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: '#64748b',
          background: '#e2e8f0',
          padding: '2px 8px',
          borderRadius: '4px',
          flexShrink: 0,
        }}>
          {status}
        </span>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="apidocs-table" style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '14px',
      }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: '#475569',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '12px 16px',
                  color: '#334155',
                  wordBreak: 'break-word',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-100px 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const navLinks = sections.map((s) => (
    <a
      key={s.id}
      href="#"
      className={activeSection === s.id ? 'active' : ''}
      onClick={(e) => {
        e.preventDefault();
        setActiveSection(s.id);
        document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
      }}
    >
      {s.label}
    </a>
  ));

  return (
    <section className="lp-section apidocs">
      <div className="lp-container apidocs__inner">
        {/* Sidebar — desktop only */}
        <aside className="apidocs__sidebar">
          <nav>{navLinks}</nav>
        </aside>

        {/* Content */}
        <div className="apidocs__content">
          {/* Overview */}
          <div id="overview" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              概述
            </h2>
            <CodeBlock>{`用户通过 Google SSO 登录
  → 插件提交 Case
  → 后端解析上下文
  → diagnosis_run.mode=DIAGNOSE
  → Devin 返回 0..N 个 Findings
  → 用户选择一个 Finding 并点击 Auto Fix
  → diagnosis_run.mode=IMPLEMENT_CHANGE
  → Devin 修改该 Finding 对应的单一仓库并创建 PR`}</CodeBlock>
            <p style={{ color: '#475569', lineHeight: 1.7 }}>
              核心约束：Case 首次提交统一进入诊断；一个 Case 可包含 0..N 个 Finding；
              一个 Finding 绑定一个主要 Application 和 Repository，是最小 Auto Fix 单元。
            </p>
          </div>

          {/* Auth */}
          <div id="auth" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              地址与鉴权
            </h2>
            <Table
              headers={['环境', 'Base URL']}
              rows={[
                ['本地', 'http://localhost:8080'],
                ['外网 POC', 'https://api.aisherlock.vip'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              接口状态
            </h3>
            <Table
              headers={['#', '方法与路径', '用途', '状态']}
              rows={[
                ['1', 'POST /api/v1/plugin/issues', '插件提交 Case', '已实现'],
                ['2', 'GET /api/v1/public/statistics', '官网统计接口', '待实现'],
                ['3', 'GET /api/v1/cases', '当前用户 Case 列表', '待实现'],
                ['4', 'GET /api/v1/cases/{caseKey}', 'Case 详情', '部分实现'],
                ['5', 'POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix', '触发 Auto Fix', '待实现'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              认证方式
            </h3>
            <p style={{ color: '#475569', marginBottom: '12px' }}>
              除公开统计接口外，所有业务接口需要 Google SSO 登录后使用 Bearer Token：
            </p>
            <CodeBlock>{`Authorization: Bearer <access-token>`}</CodeBlock>
          </div>

          {/* Conventions */}
          <div id="conventions" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              通用约定
            </h2>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>时间与命名</h3>
            <ul style={{ color: '#475569', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li>时间使用 ISO-8601 UTC，例如 <code>2026-09-06T02:00:00Z</code></li>
              <li>JSON 字段使用 <code>camelCase</code></li>
              <li>Case 对外使用 <code>caseKey</code>，数据库 UUID 不作为主要路由标识</li>
            </ul>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>幂等</h3>
            <p style={{ color: '#475569', marginBottom: '12px' }}>
              提交 Case 和触发 Auto Fix 时应传递幂等键：
            </p>
            <CodeBlock>{`Idempotency-Key: <同一业务操作唯一值，最大 200 字符>`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              错误结构
            </h3>
            <CodeBlock>{`{
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "timestamp": "2026-09-06T02:00:00Z",
  "violations": [
    { "field": "title", "message": "must not be blank" }
  ]
}`}</CodeBlock>
            <Table
              headers={['HTTP', '含义']}
              rows={[
                ['200', '查询成功'],
                ['202', '已接收，后台异步处理'],
                ['400', 'JSON、参数或字段校验失败'],
                ['401/403', '未登录、Token 无效或没有操作权限'],
                ['404', '资源不存在，或当前调用方无权看到该资源'],
                ['409', '幂等冲突、存在活动任务、Finding 已过期'],
                ['413', '请求体、事件数或截图大小超过限制'],
                ['500', '未处理的服务端异常'],
              ]}
            />
          </div>

          {/* API 1 */}
          <div id="api-1" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              接口一：插件提交 Case
            </h2>
            <Endpoint method="POST" path="/api/v1/plugin/issues" status="已实现" />
            <p style={{ color: '#475569', marginBottom: '16px' }}>
              接收插件原生 Payload。后端负责校验请求、保留原始中文文本、转换 Context Event、
              创建 Case 并异步启动 DIAGNOSE。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>请求 Headers</h3>
            <CodeBlock>{`Authorization: Bearer <access-token>
Content-Type: application/json
Idempotency-Key: iss-statistics-500-001`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              顶层入参
            </h3>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['issueId', 'string', '是', '插件生成的问题 ID，最大 200'],
                ['sessionId', 'string', '否', '插件采集 Session ID'],
                ['title', 'string', '是', '原样保存，最大 300'],
                ['description', 'string', '否', '原样保存，最大 8000'],
                ['screenshots', 'array', '否', '截图列表，POC 最多 5 张'],
                ['pageContext', 'object', '是', '页面上下文'],
                ['network', 'array', '否', '网络请求和响应摘要'],
                ['consoleErrors', 'array', '否', 'Console 错误'],
                ['stacks', 'array', '否', 'JavaScript 错误栈'],
                ['replay', 'object', '否', 'Replay 视频（对象存储引用）'],
                ['scope', 'object', '否', '应用和环境'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：202 Accepted
            </h3>
            <CodeBlock>{`{
  "caseKey": "SH-20260906-4EB4AD00",
  "status": "RECEIVED",
  "links": {
    "self": "/api/v1/cases/SH-20260906-4EB4AD00"
  }
}`}</CodeBlock>
          </div>

          {/* API 2 */}
          <div id="api-2" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              接口二：官网统计接口
            </h2>
            <Endpoint method="GET" path="/api/v1/public/statistics" status="待实现" />
            <p style={{ color: '#475569', marginBottom: '16px' }}>
              POC 的真实故障接口，无需鉴权。用于演示插件采集 → 后端诊断 → Auto Fix 的完整流程。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              故障修复前（500）
            </h3>
            <CodeBlock>{`{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "timestamp": "2026-09-06T02:00:00Z"
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              正常业务契约（200）
            </h3>
            <CodeBlock>{`{
  "totalCases": 0,
  "diagnosedCases": 0,
  "pullRequestsCreated": 0,
  "diagnosisSuccessRate": 0.0
}`}</CodeBlock>
          </div>

          {/* API 3 */}
          <div id="api-3" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              接口三：当前用户 Case 列表
            </h2>
            <Endpoint method="GET" path="/api/v1/cases" status="待实现" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Query 参数</h3>
            <Table
              headers={['参数', '类型', '必填', '说明']}
              rows={[
                ['page', 'integer', '否', '从 0 开始，默认 0'],
                ['size', 'integer', '否', '1..100，默认 20'],
                ['status', 'string', '否', '精确过滤 Case 状态'],
                ['projectId', 'UUID', '否', '仅有相应 Project 权限时生效'],
                ['keyword', 'string', '否', '匹配 caseKey/title，最大 100'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：200 OK
            </h3>
            <CodeBlock>{`{
  "items": [
    {
      "caseKey": "SH-20260906-4EB4AD00",
      "title": "官网统计信息加载失败",
      "status": "DIAGNOSED",
      "sourceApplication": "ai-sherlock-web",
      "environment": "poc",
      "findingCount": 1,
      "createdAt": "2026-09-06T02:00:00Z"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "hasNext": false
}`}</CodeBlock>
          </div>

          {/* API 4 */}
          <div id="api-4" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              接口四：Case 详情
            </h2>
            <Endpoint method="GET" path="/api/v1/cases/{caseKey}" status="部分实现" />
            <p style={{ color: '#475569', marginBottom: '16px' }}>
              返回 Case 基本信息、最新诊断状态和当前诊断版本的 Findings。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
              成功响应：200 OK
            </h3>
            <CodeBlock>{`{
  "caseKey": "SH-20260906-4EB4AD00",
  "title": "官网统计信息加载失败",
  "description": "打开官网后统计区域加载失败",
  "status": "DIAGNOSED",
  "latestDiagnosis": {
    "runId": "9b38d808-7855-466c-9407-70db98564562",
    "mode": "DIAGNOSE",
    "status": "COMPLETED",
    "summary": "The statistics endpoint divides by zero..."
  },
  "findings": [
    {
      "id": "6a424b8e-31f8-4f41-89b1-5ccfcbfc47d1",
      "type": "BACKEND",
      "title": "Statistics calculation divides by zero",
      "application": "ai-sherlock-api",
      "repository": "tonymiao2012/ms-ai-sherlock",
      "file": "src/main/java/.../PublicStatisticsService.java",
      "lineStart": 31,
      "rootCause": "The success-rate calculation divides by totalCases...",
      "aiConfidence": 0.96,
      "severity": "HIGH",
      "latestFix": null
    }
  ]
}`}</CodeBlock>
          </div>

          {/* API 5 */}
          <div id="api-5" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              接口五：触发 Auto Fix
            </h2>
            <Endpoint method="POST" path="/api/v1/cases/{caseKey}/findings/{findingId}/auto-fix" status="待实现" />
            <p style={{ color: '#475569', marginBottom: '16px' }}>
              用户点击 Auto Fix 时调用。针对一个 Finding 创建新的 Fix Attempt 和 IMPLEMENT_CHANGE Run。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>请求 Body</h3>
            <CodeBlock>{`{
  "instructions": "请补充 totalCases 为 0 的单元测试，并保持现有响应字段不变。"
}`}</CodeBlock>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['instructions', 'string', '否', '本次修复的补充要求，最大 4000'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：202 Accepted
            </h3>
            <CodeBlock>{`{
  "caseKey": "SH-20260906-4EB4AD00",
  "findingId": "6a424b8e-31f8-4f41-89b1-5ccfcbfc47d1",
  "fixAttemptId": "467fb4f0-c3df-4b30-8cea-a15d9de960a7",
  "runId": "3714610e-0083-4791-b518-c48b2867de3d",
  "mode": "IMPLEMENT_CHANGE",
  "status": "QUEUED"
}`}</CodeBlock>
          </div>

          {/* Workflow */}
          <div id="workflow" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: '#1e293b' }}>
              推荐联调顺序
            </h2>
            <CodeBlock>{`1. GET /api/v1/public/statistics
   → 收到真实 500

2. POST /api/v1/plugin/issues
   → 提交浏览器采集结果
   → 保存 caseKey

3. GET /api/v1/cases?page=0&size=20
   → 在"我的 Case"列表看到新 Case

4. GET /api/v1/cases/{caseKey}
   → 诊断期间按 pollAfterSeconds 轮询
   → status=DIAGNOSED 后展示 0..N Findings

5. POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix
   → 用户明确选择一个 Finding
   → 保存 fixAttemptId/runId

6. GET /api/v1/cases/{caseKey}
   → 轮询 finding.latestFix.status
   → PR_CREATED 后展示 pullRequestUrl`}</CodeBlock>
          </div>
        </div>
      </div>
    </section>
  );
}
