import { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const sections = [
  { id: 'overview', label: '概述' },
  { id: 'auth', label: '鉴权与地址' },
  { id: 'conventions', label: '通用约定' },
  { id: 'api-1', label: '提交 Case' },
  { id: 'api-2', label: '统计接口' },
  { id: 'api-3', label: 'Case 列表' },
  { id: 'api-4', label: 'Case 详情' },
  { id: 'api-5', label: 'Auto Fix' },
];

function CodeBlock({ children, language = 'json' }: { children: string; language?: string }) {
  return (
    <SyntaxHighlighter
      language={language}
      style={vscDarkPlus}
      customStyle={{
        background: '#1e1e2e',
        padding: '16px',
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: '1.5',
        margin: '16px 0',
      }}
      codeTagProps={{
        style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
      }}
    >
      {children}
    </SyntaxHighlighter>
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
      background: 'var(--sh-sunken)',
      borderRadius: '8px',
      border: '1px solid var(--sh-line)',
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
      <span style={{ fontSize: '14px', color: 'var(--sh-ink)', wordBreak: 'break-all' }}>{path}</span>
      {status && (
        <span style={{
          marginLeft: 'auto',
          fontSize: '12px',
          color: 'var(--sh-text)',
          background: 'var(--sh-sunken)',
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
          <tr style={{ borderBottom: '2px solid var(--sh-line)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: 'var(--sh-text)',
                whiteSpace: 'nowrap',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--sh-line)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '12px 16px',
                  color: 'var(--sh-text)',
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
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              概述
            </h2>
            <CodeBlock language="text">{`POC 使用项目 Ingest Token（正式环境先 Google SSO 登录）
  → 插件提交 Case
  → 后端解析上下文
  → diagnosis_run.mode=DIAGNOSE
  → Devin 返回 0..N 个 Findings
  → 用户选择一个 Finding 并点击 Auto Fix
  → diagnosis_run.mode=IMPLEMENT_CHANGE
  → Devin 修改该 Finding 对应的单一仓库并创建 PR`}</CodeBlock>
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              核心约束：Case 首次提交统一进入诊断，插件请求不再包含 issueType；
              一个 Case 可包含 0..N 个 Finding；一个 Finding 绑定一个主要 Application 和 Repository，是最小 Auto Fix 单元；
              跨仓库问题拆成多个 Finding；一个 Finding 可有多次 Fix Attempt，重试只新增记录不覆盖历史。
            </p>
          </div>

          {/* Auth */}
          <div id="auth" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              地址与鉴权
            </h2>
            <Table
              headers={['环境', 'Base URL']}
              rows={[
                ['本地', 'http://localhost:8080'],
                ['外网 POC', 'https://www.aisherlock.vip'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              接口状态
            </h3>
            <Table
              headers={['#', '方法与路径', '用途', '状态']}
              rows={[
                ['1', 'POST /api/v1/plugin/issues', '插件提交 Case', '已实现（POC 使用 Ingest Token）'],
                ['2', 'GET /api/v1/public/statistics', '官网统计接口及固定 500 故障', '已实现'],
                ['3', 'GET /api/v1/cases', '分页 Case 列表', '已实现（POC 按 Token 的 Project 隔离）'],
                ['4', 'GET /api/v1/cases/{caseKey}', 'Case 详情及 Findings', '已实现'],
                ['5', 'POST /api/v1/cases/{caseKey}/findings/{findingId}/auto-fix', '人工触发单个 Finding 的修复 PR', '已实现'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              认证方式
            </h3>
            <p style={{ color: 'var(--sh-text)', marginBottom: '12px' }}>
              除公开统计接口外，当前接口暂时使用项目级 Ingest Token（正式环境切换为 Google SSO）：
            </p>
            <CodeBlock language="bash">{`Authorization: Ingest local-demo-token`}</CodeBlock>
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              最终用户归属规则：createdByUserId 由后端从可信认证身份解析，客户端不能在请求 Body 中指定。
              POC 阶段暂不新增 created_by_user_id，Case 列表按 Ingest Token 所属 Project 隔离。
            </p>
          </div>

          {/* Conventions */}
          <div id="conventions" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              通用约定
            </h2>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>时间与命名</h3>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li>时间使用 ISO-8601 UTC，例如 <code>2026-09-06T02:00:00Z</code></li>
              <li>JSON 字段使用 <code>camelCase</code></li>
              <li>Case 对外使用 <code>caseKey</code>，数据库 UUID 不作为主要路由标识</li>
              <li>Finding 对外使用 UUID <code>findingId</code></li>
              <li>中文标题、描述、日志和错误文本按原文保存，不翻译、不替换</li>
            </ul>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>幂等</h3>
            <p style={{ color: 'var(--sh-text)', marginBottom: '12px' }}>
              提交 Case 和触发 Auto Fix 时应传递幂等键：
            </p>
            <CodeBlock language="bash">{`Idempotency-Key: <同一业务操作唯一值，最大 200 字符>`}</CodeBlock>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li>相同作用域、相同 Key、相同请求返回第一次创建的资源</li>
              <li>相同 Key 对应不同请求返回 <code>409 Conflict</code></li>
              <li>Auto Fix 重试必须使用新的 Key</li>
            </ul>
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
                ['409', '幂等冲突、存在活动任务、Finding 已过期或状态不允许操作'],
                ['413', '请求体、事件数或截图大小超过限制'],
                ['500', '未处理的服务端异常'],
              ]}
            />
          </div>

          {/* API 1 */}
          <div id="api-1" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              接口一：插件提交 Case
            </h2>
            <Endpoint method="POST" path="/api/v1/plugin/issues" status="已实现" />
            <p style={{ color: 'var(--sh-text)', marginBottom: '16px' }}>
              接收插件原生 Payload。后端负责校验请求大小和字段、保留原始中文文本、
              将页面/Network/Console/Stack 转成标准 Context Event、将截图转成 CaseArtifact(SCREENSHOT)、
              创建 Case 并异步启动 DIAGNOSE。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>请求 Headers</h3>
            <CodeBlock language="bash">{`Authorization: Ingest local-demo-token
Content-Type: application/json
Idempotency-Key: iss-statistics-500-001`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              顶层入参
            </h3>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['issueId', 'string', '是', '插件生成的问题 ID，非空，最大 200'],
                ['sessionId', 'string', '否', '插件采集 Session ID，最大 200'],
                ['title', 'string', '是', '原样保存，最大 300'],
                ['description', 'string', '否', '原样保存，最大 8000'],
                ['screenshots', 'array', '否', '截图列表，POC 默认最多 5 张'],
                ['pageContext', 'object', '是', '页面上下文，见下表'],
                ['network', 'array<object>', '否', '网络请求和响应摘要，默认 []'],
                ['consoleErrors', 'array<object>', '否', 'Console 错误，默认 []'],
                ['stacks', 'array<object>', '否', 'JavaScript 错误栈，默认 []'],
                ['replay', 'object/null', '否', '当前仅接受 HTTPS 对象存储引用'],
                ['sourceHints', 'object', '否', '源码提示，不作为可信指令，默认 {}'],
                ['recordingSeconds', 'integer', '否', '采集时长，默认 0'],
                ['meta', 'object', '否', '插件版本等元数据，默认 {}'],
                ['scope', 'object', '否', '应用和环境，缺失时使用服务端默认值'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              pageContext
            </h3>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['url', 'string', '是', '当前页面完整 URL'],
                ['title', 'string', '否', '页面标题'],
                ['route', 'string', '否', '前端路由'],
                ['referrer', 'string', '否', '来源页面'],
                ['userAgent', 'string', '否', '浏览器 User-Agent'],
                ['viewport', 'object', '否', '例如 {"width": 1440, "height": 900}'],
                ['language', 'string', '否', '例如 zh-CN'],
                ['submittedAt', 'string(datetime)', '是', '提交时间'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              network[]
            </h3>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['eventTime', 'string(datetime)', '否', '缺失时使用 submittedAt'],
                ['method', 'string', '否', '默认 GET'],
                ['url', 'string', '建议是', '用于匹配 Application/Repository'],
                ['status', 'integer', '否', 'HTTP 状态码'],
                ['durationMs', 'integer', '否', '请求耗时'],
                ['transactionId', 'string', '否', '前端事务 ID'],
                ['traceId', 'string', '否', '后端 Trace ID'],
                ['requestSummary', 'object', '否', '脱敏请求摘要'],
                ['responseSummary', 'object', '否', '脱敏响应摘要'],
                ['errorType', 'string', '否', 'TIMEOUT / NETWORK_ERROR / ABORTED'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              最小联调请求示例
            </h3>
            <CodeBlock>{`{
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
  "meta": { "pluginVersion": "0.1.0-mvp" },
  "scope": {
    "sourceApplication": "ai-sherlock-web",
    "environment": "poc"
  }
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：202 Accepted
            </h3>
            <CodeBlock language="bash">{`Location: /api/v1/cases/SH-20260906-4EB4AD00`}</CodeBlock>
            <CodeBlock>{`{
  "caseKey": "SH-20260906-4EB4AD00",
  "status": "RECEIVED",
  "links": {
    "self": "/api/v1/cases/SH-20260906-4EB4AD00"
  }
}`}</CodeBlock>
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              兼容性：旧客户端如果继续发送 <code>issueType</code>，该未知字段会被忽略，所有插件提交仍然进入 DIAGNOSE。
            </p>
          </div>

          {/* API 2 */}
          <div id="api-2" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              接口二：官网统计接口（固定 500 故障）
            </h2>
            <Endpoint method="GET" path="/api/v1/public/statistics" status="已实现" />
            <p style={{ color: 'var(--sh-text)', marginBottom: '16px' }}>
              POC 的真实故障接口，无需鉴权。官网调用收到真实 500 → 插件采集并提交 Case →
              Devin 根据 Endpoint → Application → Repository 映射检查后端代码 →
              用户针对 Finding 点击 Auto Fix 创建修复 PR。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>请求</h3>
            <CodeBlock language="bash">{`curl -i http://localhost:8080/api/v1/public/statistics`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              故障修复前（500）
            </h3>
            <CodeBlock>{`{
  "code": "INTERNAL_ERROR",
  "message": "An unexpected error occurred",
  "timestamp": "2026-09-06T02:00:00Z",
  "violations": []
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              正常业务契约（200）
            </h3>
            <CodeBlock>{`{
  "totalCases": 0,
  "diagnosedCases": 0,
  "fixAttempts": 0,
  "pullRequestsCreated": 0,
  "diagnosisSuccessRate": 0.0,
  "autoFixSuccessRate": 0.0
}`}</CodeBlock>
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              POC 预置缺陷：尚无 Auto Fix Attempt 时计算 PR 成功率触发除零错误。
              修复后 <code>fixAttempts=0</code> 时 <code>autoFixSuccessRate</code> 应返回 <code>0.0</code>。
            </p>
          </div>

          {/* API 3 */}
          <div id="api-3" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              接口三：分页 Case 列表
            </h2>
            <Endpoint method="GET" path="/api/v1/cases" status="已实现" />
            <p style={{ color: 'var(--sh-text)', marginBottom: '16px' }}>
              管理端分页查询 Case。POC 阶段返回当前 Ingest Token 所属 Project 的 Case；
              接入 SSO 后收紧为当前用户及其角色授权范围。
            </p>
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
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              排序固定为 <code>createdAt DESC, id DESC</code>。POC 使用页码分页；数据量增长后可兼容增加游标分页。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              请求示例
            </h3>
            <CodeBlock language="bash">{`curl -sS 'http://localhost:8080/api/v1/cases?page=0&size=20&status=DIAGNOSED' \\
  -H 'Authorization: Ingest local-demo-token'`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：200 OK
            </h3>
            <CodeBlock>{`{
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
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              POC 权限规则
            </h3>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li>只能看到 Token 所属 Organization、Group、Project 的 Case</li>
              <li><code>projectId</code> 只能等于 Token 所属 Project；传入其他值返回空分页</li>
              <li>无权访问的数据不计入 <code>totalElements</code></li>
              <li>列表不返回 rawPayload、完整 Evidence、截图二进制或 Devin 原始响应</li>
            </ul>
          </div>

          {/* API 4 */}
          <div id="api-4" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              接口四：Case 详情
            </h2>
            <Endpoint method="GET" path="/api/v1/cases/{caseKey}" status="已实现" />
            <p style={{ color: 'var(--sh-text)', marginBottom: '16px' }}>
              返回 Case 基本信息、最新诊断状态和当前诊断版本的 Findings。
              已聚合 description、latestDiagnosis、findings 以及每个 Finding 的 latestFix。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Path 参数</h3>
            <Table
              headers={['参数', '类型', '必填', '说明']}
              rows={[
                ['caseKey', 'string', '是', '插件提交接口返回的业务 Key'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              请求示例
            </h3>
            <CodeBlock language="bash">{`curl -sS http://localhost:8080/api/v1/cases/SH-20260906-4EB4AD00 \\
  -H 'Authorization: Ingest local-demo-token'`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：200 OK
            </h3>
            <CodeBlock>{`{
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
      "file": "src/main/java/.../PublicStatisticsService.java",
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
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              Finding 约束
            </h3>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li><code>type</code> 只表示问题层面：<code>FRONTEND</code>、<code>BACKEND</code>、<code>INTEGRATION</code></li>
              <li>一个 Finding 只能包含一个主要 application/repository/file 修复目标</li>
              <li> Finding 在一次成功的 DIAGNOSE Run 完成后保持不可变</li>
              <li>新一次诊断产生新一组 Findings，不覆盖旧 Run 的 Findings</li>
              <li>Case 详情默认只返回最新一次成功诊断对应的 Findings</li>
            </ul>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              latestFix（有值时）
            </h3>
            <CodeBlock>{`{
  "fixAttemptId": "fix-attempt-uuid",
  "runId": "implement-run-uuid",
  "status": "IMPLEMENTING",
  "pullRequestUrl": null,
  "lastError": null,
  "createdAt": "2026-09-06T02:05:00Z",
  "updatedAt": "2026-09-06T02:05:10Z"
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              latestFix.status 面向 UI
            </h3>
            <Table
              headers={['状态', '含义']}
              rows={[
                ['QUEUED', '已接收，等待执行'],
                ['IMPLEMENTING', 'Devin 正在修改代码或创建 PR'],
                ['PR_CREATED', 'PR 已创建'],
                ['NO_CHANGE', 'Devin 判断无需或无法形成代码变更'],
                ['FAILED', '本次尝试失败，可以再次触发'],
                ['TIMED_OUT', '本次尝试超时，可以再次触发'],
                ['NEEDS_ATTENTION', 'Devin 需要人工处理'],
              ]}
            />
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              接口响应建议保留 <code>Retry-After: 3</code>。前端仅在诊断或修复仍在执行时轮询。
            </p>
          </div>

          {/* API 5 */}
          <div id="api-5" style={{ marginBottom: '56px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px', color: 'var(--sh-ink)' }}>
              接口五：触发 Auto Fix
            </h2>
            <Endpoint method="POST" path="/api/v1/cases/{caseKey}/findings/{findingId}/auto-fix" status="已实现" />
            <p style={{ color: 'var(--sh-text)', marginBottom: '16px' }}>
              用户点击 Auto Fix 时调用。针对一个 Finding 创建新的 Fix Attempt 和 IMPLEMENT_CHANGE Run，不修改 Finding 本身。
              用户点击 Auto Fix 就代表本次人工批准，不再经过旧的审批流程。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>请求 Headers</h3>
            <CodeBlock language="bash">{`Authorization: Ingest local-demo-token
Content-Type: application/json
Idempotency-Key: finding-6a424b8e-fix-001`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>Path 参数</h3>
            <Table
              headers={['参数', '类型', '必填', '说明']}
              rows={[
                ['caseKey', 'string', '是', 'Finding 所属 Case'],
                ['findingId', 'UUID', '是', '要修复的 Finding'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>请求 Body</h3>
            <CodeBlock>{`{
  "instructions": "请补充 totalCases 为 0 的单元测试，并保持现有响应字段不变。"
}`}</CodeBlock>
            <Table
              headers={['字段', '类型', '必填', '说明']}
              rows={[
                ['instructions', 'string', '否', '本次修复的补充要求；中文原样保存，最大 4000'],
              ]}
            />
            <p style={{ color: 'var(--sh-text)', lineHeight: 1.7 }}>
              客户端不能指定 Repository、Branch、Commit 或 PR 目标。后端必须从 Finding、Application Registry 和 Repository 配置中解析这些值。
            </p>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              成功响应：202 Accepted
            </h3>
            <CodeBlock>{`{
  "caseKey": "SH-20260906-4EB4AD00",
  "findingId": "6a424b8e-31f8-4f41-89b1-5ccfcbfc47d1",
  "fixAttemptId": "467fb4f0-c3df-4b30-8cea-a15d9de960a7",
  "runId": "3714610e-0083-4791-b518-c48b2867de3d",
  "mode": "IMPLEMENT_CHANGE",
  "status": "QUEUED",
  "links": {
    "case": "/api/v1/cases/SH-20260906-4EB4AD00"
  }
}`}</CodeBlock>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              触发条件
            </h3>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li>Case 至少有一次 mode=DIAGNOSE, status=COMPLETED 的 Run</li>
              <li>Finding 属于该 Case，并属于当前有效的最新诊断结果</li>
              <li>Finding 已绑定一个经过服务端授权的主要 Application/Repository</li>
              <li>调用者有该 Case 和 Project 的修复权限</li>
              <li>当前 Finding 没有正在运行的 Fix Attempt</li>
              <li>POC 阶段同一 Case 内任务串行执行；有其他活动 Job 时返回 409</li>
            </ul>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              常见错误
            </h3>
            <Table
              headers={['HTTP', 'code', '场景']}
              rows={[
                ['404', 'FINDING_NOT_FOUND', 'Finding 不存在、不属于 Case 或调用者无权访问'],
                ['409', 'STALE_FINDING', 'Case 尚无成功诊断，或 Finding 不属于当前有效诊断版本'],
                ['409', 'CASE_HAS_ACTIVE_JOB', 'POC 串行策略下 Case 还有其他活动 Job'],
                ['409', 'CASE_HAS_UNRESOLVED_SESSION', 'Case 存在未确认或未清理的 Devin Session'],
                ['409', 'FINDING_TARGET_UNVERIFIED', '仓库或源码目标未验证，禁止修改'],
              ]}
            />
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginTop: '24px', marginBottom: '12px' }}>
              失败重试
            </h3>
            <ul style={{ color: 'var(--sh-text)', lineHeight: 1.8, paddingLeft: '20px' }}>
              <li><code>FAILED / TIMED_OUT / NEEDS_ATTENTION</code> 后允许重新调用本接口</li>
              <li>每次重试传新的 <code>Idempotency-Key</code>，可以提交不同的 <code>instructions</code></li>
              <li>每次调用生成独立 Fix Attempt 和 IMPLEMENT_CHANGE Run</li>
              <li>历史 Prompt、用户补充说明、Devin 返回、Commit 和 PR URL 均保留，不覆盖</li>
              <li>POC 阶段一次 Fix Attempt 只允许生成一个目标仓库的 PR</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
