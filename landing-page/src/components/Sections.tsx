import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AgentsMock,
  CaptureMock,
  DiagnoseMock,
  FixMock,
  PipelineMock,
  ReportMock,
} from './mocks';
import {
  IconArrowUpRight,
  IconConsole,
  IconCursor,
  IconDevice,
  IconNetwork,
  IconPen,
  IconRecord,
} from './icons';

/** ④ 大字陈述 + 产品截图卡 */
export function Statement() {
  return (
    <section className="lp-section" id="features">
      <div className="lp-container lp-statement__grid">
        <div className="lp-statement__text">
          <h2 className="lp-h2">
            采集那一刻，
            <br />
            还原整个故事。
          </h2>
          <p className="lp-lead">
            {
              '一键提交 Bug，Network、Console、用户事件与设备信息随截图一起保存，工程师和 AI Agent 拿到即可开工。'
            }
          </p>
        </div>
        <ReportMock />
      </div>
    </section>
  );
}

type Feature = {
  eyebrow: string;
  title: string;
  copy: ReactNode;
  action?: { label: string; href: string };
  chips?: { icon: ReactNode; label: string }[];
  visual: ReactNode;
  flip?: boolean;
};

const FEATURES: Feature[] = [
  {
    eyebrow: '01 · 采集',
    title: '一键采集完整现场',
    copy: '安装插件即可捕获，不打断用户操作。截图批注与现场数据一起入库，Case 详情页即可回放。',
    action: { label: '安装 Chrome 插件', href: '#download' },
    chips: [
      { icon: <IconNetwork size={14} />, label: 'Network errors' },
      { icon: <IconConsole size={14} />, label: 'Console logs' },
      { icon: <IconCursor size={14} />, label: '用户事件' },
      { icon: <IconDevice size={14} />, label: '设备信息' },
      { icon: <IconPen size={14} />, label: '截图批注' },
      { icon: <IconRecord size={14} />, label: 'rrweb 录屏' },
    ],
    visual: <CaptureMock />,
  },
  {
    eyebrow: '02 · 诊断',
    title: 'AI 诊断，证据链完整',
    copy: (
      <>
        {'自动关联日志系统与源码仓库补全 Evidence，'}
        <span className="lp-nb">LLM 输出根因</span>与 Finding，每一条结论都能回溯到引用。
      </>
    ),
    action: { label: '看 Agent 如何读证据', href: '#agents' },
    visual: <DiagnoseMock />,
    flip: true,
  },
  {
    eyebrow: '03 · 修复',
    title: '人工审批 → LLM 自动修复',
    copy: '确认诊断后一键下发 Devin 修复，产出分支与 PR，结果回写 JIRA，Owner 只需审阅差异。',
    action: { label: '看端到端流程', href: '#workflow' },
    visual: <FixMock />,
  },
  {
    eyebrow: '04 · 发布',
    title: 'Merge 即发布 UAT',
    copy: 'PR 合并触发流水线，健康检查通过后 JIRA 自动流转 Done，问题从发现到验证全程留痕。',
    action: { label: '查看团队实践', href: '#voices' },
    visual: <PipelineMock />,
    flip: true,
  },
];

/** ⑤ Feature 交替区 */
export function Features() {
  return (
    <section className="lp-section lp-section--sunken" id="workflow">
      <div className="lp-container lp-features">
        {FEATURES.map((f) => (
          <article key={f.title} className={`lp-feature${f.flip ? ' lp-feature--flip' : ''}`}>
            <div className="lp-feature__text">
              <h2 className="lp-h2 lp-feature__head">
                {f.eyebrow}
                <span className="lp-feature__sub">{f.title}</span>
              </h2>
              <p className="lp-lead">{f.copy}</p>
              {f.chips ? (
                <div className="lp-feature__chips">
                  {f.chips.map((c) => (
                    <span key={c.label} className="lp-chip">
                      {c.icon}
                      {c.label}
                    </span>
                  ))}
                </div>
              ) : null}
              {f.action ? (
                <a className="lp-link" href={f.action.href}>
                  {f.action.label} <IconArrowUpRight size={14} />
                </a>
              ) : null}
            </div>
            <div className="lp-feature__visual">{f.visual}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** ⑥ 深色区 For Agents */
export function Agents() {
  return (
    <section className="lp-section" id="agents">
      <div className="lp-container">
        <div className="lp-agents">
          <div className="lp-agents__head">
            <span className="lp-eyebrow lp-eyebrow--brand">AI Sherlock for Agents</span>
            <h2 className="lp-h2">
              给 Agent 可信的上下文，
              <br />
              给人类可查的凭证。
            </h2>
          </div>
          <div className="lp-agents__grid">
            <div className="lp-agents__text">
              <p className="lp-agents__copy">
                Devin 修复会话读取完整 Case 证据链；每一次 AI
                结论都能回溯到日志、源码与工作流凭证。
              </p>
              <Link className="lp-link lp-agents__link" to="/blog">
                Learn more <IconArrowUpRight size={14} />
              </Link>
            </div>
            <AgentsMock />
          </div>
        </div>
      </div>
    </section>
  );
}

/** ⑦ Testimonial 大卡 */
const QUOTES = [
  { text: '一个可回溯的问题链接，胜过半小时的复现沟通。', who: 'QA 负责人', team: '团队 A', tone: 'green' },
  { text: '带诊断报告的工单，修复速度快了十倍。', who: 'Developer', team: '团队 B', tone: 'blue' },
];

export function Testimonials() {
  return (
    <section className="lp-section lp-section--sunken" id="voices">
      <div className="lp-container">
        <div className="lp-quotes">
          {QUOTES.map((q) => (
            <figure key={q.team} className={`lp-quote lp-quote--${q.tone}`}>
              <blockquote className="lp-quote__text">“{q.text}”</blockquote>
              <figcaption className="lp-quote__who">
                <span className="lp-quote__avatar">{q.who.slice(0, 1)}</span>
                {q.who} · {q.team}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/** ⑧ 底部 CTA 大卡 */
export function FinalCta() {
  return (
    <section className="lp-section" id="download">
      <div className="lp-container">
        <div className="lp-final">
          <div className="lp-final__inner">
            <h2 className="lp-h2">
              看看你的团队
              <br />
              能把修复提速多少
            </h2>
            <p className="lp-lead">500+ 内部用户正在使用</p>
            <div className="lp-hero__actions">
              <a className="lp-btn lp-btn--ghost lp-btn--lg" href="mailto:wonderwang@ocbc.com">
                联系平台组
              </a>
            </div>
          </div>
          <div className="lp-final__pills">
            <span className="lp-final__pill">线上问题</span>
            <span className="lp-final__pill">交互反馈</span>
            <span className="lp-final__pill">后端异常</span>
          </div>
        </div>
      </div>
    </section>
  );
}
