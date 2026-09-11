// 数据接收页：展示最近一次提交的问题包及 Root Cause 分析结果
import React, { useEffect, useState } from 'react';
import {
  Alert,
  App,
  Card,
  Descriptions,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { loadCase, loadReport } from '../core/db';
import { BRAND_LOGO_URL } from './BrandLogo';
import type { IssuePackage } from '../core/types';
import ReplayPlayer from './ReplayPlayer';

const GREEN_TAG_STYLE: React.CSSProperties = {
  background: 'var(--sh-accent-soft)',
  color: 'var(--sh-accent-dark)',
  borderColor: 'var(--sh-accent-line)',
};

export default function ReportApp() {
  const { message } = App.useApp();
  const [report, setReport] = useState<IssuePackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get('caseId');
    const loader = caseId ? loadCase(caseId) : loadReport();
    loader
      .then((r) => {
        if (r) {
          console.log('[AI Sherlock] issue payload:', r);
          console.log('[AI Sherlock] payload JSON:', JSON.stringify(r, null, 2));
        }
        setReport(r);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="report-page">
        <div className="sh-hint">Loading…</div>
      </div>
    );
  if (!report) {
    return (
      <div className="report-page report-empty">
        <Alert
          type="info"
          message="Nothing submitted yet — send an issue from the Side Panel first."
        />
      </div>
    );
  }

  const networkColumns = [
    { title: 'Method', dataIndex: 'method', width: 80 },
    {
      title: 'URL',
      dataIndex: 'url',
      render: (url: string) => (
        <Typography.Text style={{ wordBreak: 'break-all' as const }}>
          {url}
        </Typography.Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 90,
      render: (s: number | undefined, row: any) =>
        row.error ? (
          <Tag color="red">ERR</Tag>
        ) : s == null ? (
          '-'
        ) : (
          <Tag style={s >= 300 && s < 400 ? GREEN_TAG_STYLE : undefined} color={s >= 400 ? 'red' : s >= 300 ? undefined : 'green'}>
            {s}
          </Tag>
        ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      width: 90,
      render: (d?: number) => (d != null ? `${d}ms` : '-'),
    },
    {
      title: 'Time',
      dataIndex: 'startedAt',
      width: 120,
      render: (t: number) => fmtTime(t),
    },
  ];

  const consoleColumns = [
    {
      title: 'Level',
      dataIndex: 'level',
      width: 90,
      render: (l: string) => (
        <Tag color={l === 'error' ? 'red' : l === 'warn' ? 'orange' : 'default'}>
          {l}
        </Tag>
      ),
    },
    { title: 'Time', dataIndex: 'ts', width: 120, render: (t: number) => fmtTime(t) },
    { title: 'Message', dataIndex: 'message' },
  ];

  return (
    <div className="report-page">
      <header className="report-head">
        <div className="sh-brand">
          <img className="sh-brand-logo" src={BRAND_LOGO_URL} alt="AI Sherlock" />
          <span className="sh-brand-name">AI Sherlock Report</span>
        </div>
        <span className="sh-pill sh-pill--brand" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {report.caseKey ?? report.issueId}
          <CopyOutlined
            style={{ cursor: 'pointer', color: '#999', fontSize: 12 }}
            onClick={() => {
              navigator.clipboard.writeText(report.caseKey ?? report.issueId).then(() => {
                message.success('Copied');
              });
            }}
          />
        </span>
      </header>

      <Tabs
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {report.evidenceError && (
                  <Alert
                    type="warning"
                    showIcon
                    message="Page evidence capture failed"
                    description={report.evidenceError}
                  />
                )}
                <Card size="small" title="Issue">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="Title">
                      {report.title}
                    </Descriptions.Item>
                    <Descriptions.Item label="Description">
                      {report.description}
                    </Descriptions.Item>
                    {report.steps && (
                      <Descriptions.Item label="Steps to reproduce">
                        {report.steps}
                      </Descriptions.Item>
                    )}
                    {report.expectedResult && (
                      <Descriptions.Item label="Expected result">
                        {report.expectedResult}
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Status">
                      {report.status ? (
                        <Tag
                          color={report.status === 'RECEIVED' ? 'blue' : report.status === 'DIAGNOSED' ? undefined : 'default'}
                          style={report.status === 'DIAGNOSED' ? GREEN_TAG_STYLE : undefined}
                        >
                          {report.status}
                        </Tag>
                      ) : (
                        '-'
                      )}
                    </Descriptions.Item>
                    {report.recordingSeconds != null &&
                      report.recordingSeconds > 0 && (
                        <Descriptions.Item label="Recording">
                          {report.recordingSeconds}s
                        </Descriptions.Item>
                      )}
                  </Descriptions>
                </Card>
                <Card size="small" title="Page context">
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="URL">
                      {report.pageContext.url}
                    </Descriptions.Item>
                    <Descriptions.Item label="Route">
                      {report.pageContext.route}
                    </Descriptions.Item>
                    <Descriptions.Item label="Title">
                      {report.pageContext.title}
                    </Descriptions.Item>
                    <Descriptions.Item label="Viewport">
                      {report.pageContext.viewport.width}×
                      {report.pageContext.viewport.height}
                    </Descriptions.Item>
                    <Descriptions.Item label="Language">
                      {report.pageContext.language}
                    </Descriptions.Item>
                    <Descriptions.Item label="Submitted at">
                      {report.pageContext.submittedAt}
                    </Descriptions.Item>
                    <Descriptions.Item label="UA">
                      {report.pageContext.userAgent}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
                <Card size="small" title="Evidence">
                  <Space>
                    <Tag color="blue">Screenshots {report.screenshots.length}</Tag>
                    <Tag color="blue">Network {report.network.length}</Tag>
                    <Tag color="orange">Console {report.consoleErrors.length}</Tag>
                    <Tag color="red">Stacks {report.stacks.length}</Tag>
                    <Tag color="purple">
                      Replay events {report.rrwebEvents?.length ?? 0}
                    </Tag>
                  </Space>
                </Card>
              </Space>
            ),
          },
          {
            key: 'shots',
            label: `Screenshots(${report.screenshots.length})`,
            children: (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {report.screenshots.length === 0 && 'No screenshots'}
                {report.screenshots.map((s, i) => (
                  <div key={i} style={{ maxWidth: 480 }}>
                    <a href={s.dataUrl} target="_blank" rel="noreferrer">
                      <img
                        src={s.dataUrl}
                        style={{
                          maxWidth: '100%',
                          border: '1px solid var(--sh-line)',
                          borderRadius: 'var(--sh-radius-sm)',
                        }}
                      />
                    </a>
                    {s.note && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--sh-text)',
                          marginTop: 4,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {s.annotated && '[annotated] '}
                        {s.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ),
          },
          {
            key: 'network',
            label: `Network(${report.network.length})`,
            children: (
              <Table
                size="small"
                rowKey="id"
                columns={networkColumns as any}
                dataSource={report.network}
                pagination={{ pageSize: 20 }}
                expandable={{
                  expandedRowRender: (row: any) => (
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {[
                        `kind: ${row.kind}`,
                        row.error && `error: ${row.error}`,
                        row.traceIds && `traceIds: ${JSON.stringify(row.traceIds)}`,
                        row.requestSummary && `request: ${row.requestSummary}`,
                        row.responseSummary && `response: ${row.responseSummary}`,
                      ]
                        .filter(Boolean)
                        .join('\n')}
                    </pre>
                  ),
                  rowExpandable: (row: any) =>
                    !!(
                      row.error ||
                      row.requestSummary ||
                      row.responseSummary ||
                      row.traceIds
                    ),
                }}
              />
            ),
          },
          {
            key: 'console',
            label: `Console(${report.consoleErrors.length})`,
            children: (
              <Table
                size="small"
                rowKey="id"
                columns={consoleColumns as any}
                dataSource={report.consoleErrors}
                pagination={{ pageSize: 30 }}
              />
            ),
          },
          {
            key: 'stacks',
            label: `Error stacks(${report.stacks.length})`,
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                {report.stacks.length === 0 && 'No uncaught errors'}
                {report.stacks.map((e) => (
                  <Card
                    key={e.id}
                    size="small"
                    title={
                      <Space>
                        <Tag color="red">{e.kind}</Tag>
                        <span>{fmtTime(e.ts)}</span>
                      </Space>
                    }
                  >
                    <div style={{ marginBottom: 4 }}>{e.message}</div>
                    {e.source && (
                      <div style={{ color: 'var(--sh-muted)', fontSize: 12 }}>
                        {e.source}:{e.line}:{e.column}
                      </div>
                    )}
                    {e.stack && (
                      <pre
                        style={{
                          whiteSpace: 'pre-wrap',
                          fontSize: 12,
                          background: 'var(--sh-sunken)',
                          padding: 8,
                          borderRadius: 4,
                        }}
                      >
                        {e.stack}
                      </pre>
                    )}
                  </Card>
                ))}
              </Space>
            ),
          },
          {
            key: 'replay',
            label: `Replay(${report.rrwebEvents?.length ?? 0})`,
            children: (
              <ReplayPlayer
                events={(report.rrwebEvents ?? []) as any}
                hideHint
                onReady={syncAudio(report.audio, report.rrwebEvents ?? [])}
              />
            ),
          },
          {
            key: 'root-cause',
            label: `Root Cause(${rootCauseCount(report.diagnosis)})`,
            children: report.diagnosis ? (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {report.diagnosis.findings.map((f) => (
                  <Card
                    key={f.id}
                    size="small"
                    title={
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'normal', minWidth: 0 }}>{f.title ?? f.id}</span>
                        {(f.type || f.severity) && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            {f.type && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: '#e6f4ff',
                                color: '#1677ff',
                                letterSpacing: 0.5,
                              }}>
                                {f.type}
                              </span>
                            )}
                            {f.severity && (
                              <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: f.severity === 'HIGH' ? '#fff1f0' : f.severity === 'MEDIUM' ? '#fff7e6' : '#f6ffed',
                                color: f.severity === 'HIGH' ? '#cf1322' : f.severity === 'MEDIUM' ? '#d46b08' : '#389e0d',
                              }}>
                                {f.severity}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    }
                  >
                    {f.rootCause && (
                      <div style={{ marginBottom: f.recommendedFix ? 8 : 0 }}>
                        <b>Root cause</b>
                        {splitSentences(f.rootCause).map((s, i) => (
                          <div key={i} style={{ wordBreak: 'break-word' }}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                    {f.recommendedFix && (
                      <div>
                        <b>Recommended fix</b>
                        {splitSentences(f.recommendedFix).map((s, i) => (
                          <div key={i} style={{ wordBreak: 'break-word' }}>
                            {s}
                          </div>
                        ))}
                      </div>
                    )}
                    {f.file && (
                      <div style={{ color: 'var(--sh-muted)', fontSize: 12, marginTop: 6 }}>
                        {f.repository && `${f.repository} · `}
                        {f.file}
                        {f.lineStart != null && `:${f.lineStart}`}
                      </div>
                    )}
                  </Card>
                ))}
                {report.diagnosis.findings.length === 0 && (
                  <div style={{ color: 'var(--sh-muted)' }}>
                    No root cause analysis available yet.
                  </div>
                )}
              </Space>
            ) : (
              <div style={{ color: 'var(--sh-muted)' }}>
                No root cause analysis available yet.
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

/** 让音频跟随 rrweb 回放：start/play-back/resume 时播放，pause/finish 时暂停，rAF 同步进度 */
function syncAudio(audio: IssuePackage['audio'], events: unknown[]) {
  return (player: any) => {
    if (!audio?.dataUrl || !events.length) return;
    const el = new Audio(audio.dataUrl);
    const replayer = player.getReplayer?.() ?? player;
    const firstTs = (events[0] as any)?.timestamp ?? 0;
    const offsetMs = Math.max(0, audio.startedAt - firstTs);

    let playing = false;
    let raf = 0;
    const tick = () => {
      if (!replayer.wrapper?.isConnected) return;
      if (playing) {
        const expected = (offsetMs + replayer.getCurrentTime()) / 1000;
        el.playbackRate = replayer.config?.speed ?? 1;
        if (Number.isFinite(expected) && Math.abs(el.currentTime - expected) > 0.3) {
          try {
            el.currentTime = expected;
          } catch {
            // ignore
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const play = () => {
      playing = true;
      void el.play().catch(() => {});
    };
    const stop = () => {
      playing = false;
      el.pause();
    };
    replayer.on('start', play);
    replayer.on('play-back', play);
    replayer.on('resume', play);
    replayer.on('pause', stop);
    replayer.on('finish', stop);
    raf = requestAnimationFrame(tick);
  };
}

/** 有 findings 按 findings 计数；没有但分析有总结文本也算 1 条结果 */
function rootCauseCount(d: IssuePackage['diagnosis']): number {
  if (!d) return 0;
  return d.findings.length;
}

/** 按句子边界拆分诊断文本，避免长文挤成一坨 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?。！？；;])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('en-GB', { hour12: false })}.${String(
    d.getMilliseconds()
  ).padStart(3, '0')}`;
}
