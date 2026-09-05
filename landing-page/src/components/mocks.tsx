import type { ReactNode } from 'react';
import { LOGO_URL } from '../assets';
import {
  IconArrowUpRight,
  IconBranch,
  IconBug,
  IconCamera,
  IconCheck,
  IconConsole,
  IconLayers,
  IconLock,
  IconNetwork,
  IconPen,
  IconRecord,
  IconRocket,
  IconSparkle,
} from './icons';

/** 产品示意卡的公共外壳：浏览器标题栏 + 内容 + 底部状态条 */
function Window({
  url,
  children,
  foot,
}: {
  url: string;
  children: ReactNode;
  foot?: ReactNode;
}) {
  return (
    <div className="mk">
      <div className="mk__bar">
        <div className="mk__dots">
          <i />
          <i />
          <i />
        </div>
        <div className="mk__url">
          <IconLock size={11} />
          <span>{url}</span>
        </div>
        <img className="mk__ext" src={LOGO_URL} alt="" />
      </div>
      <div className="mk__body">{children}</div>
      {foot ? <div className="mk__foot">{foot}</div> : null}
    </div>
  );
}

/** 截图区：框选遮罩 + 页内批注工具条（与插件实际交互一致） */
function Shot() {
  return (
    <div className="mk-shot">
      <div className="mk-shot__page">
        <div className="mk-shot__head" />
        <div className="mk-shot__cols">
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="mk-shot__mask" />
      <div className="mk-shot__select" />
      <div className="mk-shot__toolbar">
        <i>
          <IconLayers size={13} />
        </i>
        <i>
          <IconPen size={13} />
        </i>
        <i>
          <IconArrowUpRight size={13} />
        </i>
        <i>
          <IconCamera size={13} />
        </i>
        <i>
          <IconCheck size={13} />
        </i>
      </div>
    </div>
  );
}

export function FlowMock() {
  const nodes = [
    { ico: <IconBug size={14} />, title: '插件上报', sub: '现场一键提交' },
    { ico: <IconNetwork size={14} />, title: '现场还原', sub: 'Network · Console · 录屏' },
    { ico: <IconSparkle size={14} />, title: 'AI 诊断', sub: '日志 + 源码补全证据', hot: true },
    { ico: <IconBranch size={14} />, title: '审批 → 修复', sub: 'LLM 产出 PR' },
    { ico: <IconRocket size={14} />, title: 'Merge → UAT', sub: 'JIRA 自动 Done' },
  ];
  return (
    <Window
      url="app.company.com/checkout"
      foot={
        <>
          <span>Case SH-20260901-A8F31 · 账户中心 · PROD</span>
          <span className="mk-tag mk-tag--brand">
            <IconCheck size={11} /> 端到端闭环 6m42s
          </span>
        </>
      }
    >
      <div className="mk-flow">
        {nodes.map((n) => (
          <div key={n.title} className={`mk-flow__node${n.hot ? ' mk-flow__node--hot' : ''}`}>
            <div className="mk-flow__ico">{n.ico}</div>
            <div className="mk-flow__title">{n.title}</div>
            <div className="mk-flow__sub">{n.sub}</div>
          </div>
        ))}
      </div>
    </Window>
  );
}

export function ReportMock() {
  return (
    <Window
      url="AI Sherlock · 新建问题单"
      foot={
        <>
          <span>截图 · 录屏 · Network · Console 提交</span>
          <span className="mk-btn">提交并生成 JIRA</span>
        </>
      }
    >
      <Shot />
      <div className="mk-field">
        <span className="mk-label">描述</span>
        <div className="mk-input mk-input--focus">
          点击「查询」后页面白屏，控制台抛 TypeError
        </div>
      </div>
      <div className="mk-field">
        <span className="mk-label">复现步骤</span>
        <div className="mk-input">
          <span className="mk-mono">1.</span> 进入账户详情页
          <span className="mk-mono">2.</span> 输入账号点击查询
        </div>
      </div>
      <div className="mk-row">
        <span className="mk-tag mk-tag--danger">Network 500 ×1</span>
        <span className="mk-tag mk-tag--danger">Console error ×3</span>
        <span className="mk-tag">用户事件 ×24</span>
        <span className="mk-tag">Chrome 138 · 1440×900</span>
        <span className="mk-tag">rrweb 00:18</span>
      </div>
    </Window>
  );
}

export function CaptureMock() {
  const rows = [
    {
      ico: <IconNetwork size={13} />,
      key: 'GET /api/account/info',
      val: '500',
      tag: 'danger' as const,
      sub: 'traceId abc-123 · 14:22:07',
    },
    {
      ico: <IconConsole size={13} />,
      key: 'Uncaught TypeError: Cannot read properties of null',
      val: 'error',
      tag: 'danger' as const,
      sub: 'AccountService.java:184',
    },
    {
      ico: <IconLayers size={13} />,
      key: 'Click → 查询按钮 (button.query-btn)',
      val: 'event',
      tag: 'brand' as const,
      sub: '用户事件序列 #21-24',
    },
    {
      ico: <IconCamera size={13} />,
      key: 'annotated-screenshot-01.png',
      val: 'shot',
      tag: 'brand' as const,
      sub: '框选区域 + 2 处批注',
    },
    {
      ico: <IconRecord size={13} />,
      key: 'rrweb 会话录制',
      val: '00:18',
      tag: 'brand' as const,
      sub: '可回放，含 DOM 变化',
    },
  ];
  return (
    <Window
      url="account.company.com/detail"
      foot={
        <>
          <span>自动采集，无需切换上下文</span>
          <span className="mk-tag mk-tag--brand">证据 5 类 · 已随单</span>
        </>
      }
    >
      {rows.map((r) => (
        <div key={r.key} className="mk-row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <span className="mk-row" style={{ minWidth: 0 }}>
            <span className="mk-flow__ico">{r.ico}</span>
            <span className="mk-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.key}
            </span>
          </span>
          <span className="mk-row" style={{ flexShrink: 0 }}>
            <span className={`mk-tag mk-tag--${r.tag}`}>{r.val}</span>
            <span className="mk-mono" style={{ color: 'var(--sh-muted)' }}>
              {r.sub}
            </span>
          </span>
        </div>
      ))}
    </Window>
  );
}

export function DiagnoseMock() {
  const chain = [
    { k: 'C', title: 'CTX-101 · Network 500', sub: 'GET /api/account/info 响应异常' },
    { k: 'E', title: 'EVD-301 · Elastic NPE 日志', sub: 'account-ms-* · 14:22:07.412' },
    { k: 'E', title: 'EVD-302 · 源码窗口', sub: 'AccountService.java:176-192' },
    { k: 'F', title: 'FND-401 · 空值未处理', sub: 'Backend Finding · 置信度 92%' },
  ];
  return (
    <Window
      url="console.internal/admin/cases/SH-20260901-A8F31"
      foot={
        <>
          <span>Evidence 已自动关联日志系统与源码仓库</span>
          <span className="mk-row">
            <span className="mk-btn mk-btn--ghost">查看详情</span>
            <span className="mk-btn">批准修复</span>
          </span>
        </>
      }
    >
      <div className="mk-card mk-card--sunken">
        <div className="mk-row" style={{ justifyContent: 'space-between' }}>
          <span className="mk-title">Root Cause</span>
          <span className="mk-tag mk-tag--brand">Confidence 92%</span>
        </div>
        <p className="mk-text" style={{ marginTop: 6 }}>
          <code className="mk-mono">AccountInfo</code>
          {' 在无缓存命中时返回 null，调用方未做判空，序列化阶段抛 NPE 并向前端返回 500。'}
        </p>
        <div className="mk-bar" style={{ marginTop: 10 }}>
          <i style={{ width: '92%' }} />
        </div>
      </div>
      <div className="mk-chain">
        {chain.map((c) => (
          <div key={c.title} className="mk-chain__item">
            <span className="mk-chain__rail">
              <b>{c.k}</b>
            </span>
            <span>
              <span className="mk-title" style={{ display: 'block' }}>
                {c.title}
              </span>
              <span className="mk-mono" style={{ color: 'var(--sh-muted)' }}>
                {c.sub}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Window>
  );
}

/** 示意 diff：AccountService.java 空值分支 */
const DIFF: { n: string; text: string; kind?: 'add' | 'del' }[] = [
  { n: '182', text: ' AccountInfo info = repository.find(id);' },
  { n: '183', text: '- String name = info.getDisplayName();', kind: 'del' },
  { n: '183', text: '+ if (info == null) {', kind: 'add' },
  { n: '184', text: '+   return AccountInfo.empty(id);', kind: 'add' },
  { n: '185', text: '+ }', kind: 'add' },
];

export function FixMock() {
  return (
    <Window
      url="console.internal/admin/jira-board?project=ACCOUNT"
      foot={
        <>
          <span>JIRA ACCOUNT-845 · Fix Approved</span>
          <span className="mk-tag mk-tag--brand">PR #127 已创建</span>
        </>
      }
    >
      <div className="mk-row" style={{ justifyContent: 'space-between' }}>
        <span className="mk-title">Devin 修复会话</span>
        <span className="mk-row">
          <span className="mk-tag">be/account-ms</span>
          <span className="mk-tag mk-tag--brand">修复中</span>
        </span>
      </div>
      <div className="mk-diff">
        {DIFF.map((row) => (
          <div
            key={`${row.n}-${row.text}`}
            className={`mk-diff__row${row.kind ? ` mk-diff__row--${row.kind}` : ''}`}
          >
            <span>{row.n}</span>
            {row.text}
          </div>
        ))}
      </div>
      <div className="mk-card">
        <div className="mk-row" style={{ justifyContent: 'space-between' }}>
          <span className="mk-row">
            <IconBranch size={14} />
            <span className="mk-title">PR #127 · fix/ACCOUNT-845-null-check</span>
          </span>
          <span className="mk-tag">待审</span>
        </div>
        <p className="mk-text" style={{ marginTop: 6 }}>
          {'仅修改 '}
          <span className="mk-mono">AccountService.java:176-192</span>
          {'，新增空值分支与默认返回，测试用例 +2。'}
        </p>
      </div>
    </Window>
  );
}

export function PipelineMock() {
  const steps = [
    { title: 'PR Merge', sub: '8f31a2c' },
    { title: '构建', sub: '1m12s' },
    { title: 'UAT 部署', sub: 'account-ms' },
    { title: '健康检查', sub: 'health 200' },
  ];
  return (
    <Window
      url="jenkins.company.com/job/account-ms-deploy-uat/207"
      foot={
        <>
          <span>09-02 14:32 · 触发人 merge hook</span>
          <span className="mk-tag mk-tag--brand">
            <IconCheck size={11} /> UAT 已发布
          </span>
        </>
      }
    >
      <div className="mk-pipe">
        {steps.map((s) => (
          <div key={s.title} className="mk-pipe__step mk-pipe__step--done">
            <i>
              <IconCheck size={10} />
            </i>
            <span>{s.title}</span>
            <span className="mk-mono" style={{ color: 'var(--sh-muted)' }}>
              {s.sub}
            </span>
          </div>
        ))}
        <div className="mk-pipe__step mk-pipe__step--done mk-flow__node--hot">
          <i>
            <IconCheck size={10} />
          </i>
          <span>JIRA Done</span>
          <span className="mk-mono" style={{ color: 'var(--sh-muted)' }}>
            #845
          </span>
        </div>
      </div>
      <div className="mk-card mk-card--sunken">
        <div className="mk-mono">
          deploy: image tag 207 · canary 100%<br />
          health: db ok, redis ok, jira transition → Done
        </div>
      </div>
    </Window>
  );
}

export function AgentsMock() {
  const lines: [string, string, string?][] = [
    ['case', 'SH-20260901-A8F31', '完整 Context + Evidence 快照'],
    ['chain', 'CTX-101 → EVD-301 → EVD-302 → FND-401'],
    ['repo', 'be/account-ms @ 8f31a2c', '默认分支已锁定'],
    ['scope', 'AccountService.java:176-192', '仅此范围可写'],
    ['output', 'diff +6 -2 · PR #127', '结论回写 JIRA'],
  ];
  return (
    <div className="mk-dark">
      <div className="mk-dark__bar">
        <span className="mk-tag mk-tag--dark">Devin Fix Session</span>
        <span className="mk-tag mk-tag--dark">MCP Context</span>
      </div>
      <div className="mk-dark__body">
        {lines.map(([k, v, note]) => (
          <div key={k} className="mk-dark__line">
            <b>{k}</b>
            <span>
              {v} {note ? <em>{note}</em> : null}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
