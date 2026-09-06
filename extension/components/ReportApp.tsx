// 数据接收页：展示最近一次提交的问题包，并提供后端接口联调能力
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import { loadCase, loadReport } from '../core/db';
import { BRAND_LOGO_URL } from './BrandLogo';
import type { IssuePackage } from '../core/types';
import ReplayPlayer from './ReplayPlayer';

const ENDPOINT_KEY = 'sherlock-backend-endpoint';

export default function ReportApp() {
  const [report, setReport] = useState<IssuePackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [endpoint, setEndpoint] = useState(
    () => localStorage.getItem(ENDPOINT_KEY) ?? ''
  );
  const [postResult, setPostResult] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const caseId = params.get('caseId');
    const loader = caseId ? loadCase(caseId) : loadReport();
    loader
      .then((r) => {
        if (r) {
          // 数据接收页控制台可直接查看/复制 payload
          console.log('[AI Sherlock] issue payload:', r);
          console.log('[AI Sherlock] payload JSON:', JSON.stringify(r, null, 2));
        }
        setReport(r);
      })
      .finally(() => setLoading(false));
  }, []);

  const rawJson = useMemo(
    () => (report ? JSON.stringify(report, null, 2) : ''),
    [report]
  );

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
      message.success('Issue JSON copied');
    } catch {
      message.error('Copy failed — select the text manually');
    }
  };

  const downloadJson = () => {
    const blob = new Blob([rawJson], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${report?.issueId ?? 'issue'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const postToBackend = async () => {
    if (!endpoint.trim()) {
      message.warning('Enter the backend endpoint first');
      return;
    }
    localStorage.setItem(ENDPOINT_KEY, endpoint.trim());
    setPosting(true);
    setPostResult('');
    const startedAt = Date.now();
    try {
      const resp = await fetch(endpoint.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: rawJson,
      });
      const text = await resp.text();
      setPostResult(
        `HTTP ${resp.status} ${resp.statusText} (${Date.now() - startedAt}ms)\n\n${text.slice(0, 5000)}`
      );
    } catch (e) {
      setPostResult(`Request failed: ${String(e)}`);
    } finally {
      setPosting(false);
    }
  };

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
          <Tag color={s >= 400 ? 'red' : s >= 300 ? 'orange' : 'green'}>
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
        <span className="sh-pill sh-pill--brand">{report.issueId}</span>
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
                    <Descriptions.Item label="Severity">
                      {report.severity ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      {report.status ? (
                        <Tag color={report.status === 'RECEIVED' ? 'blue' : report.status === 'DIAGNOSED' ? 'green' : 'default'}>
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
            children: <ReplayPlayer events={(report.rrwebEvents ?? []) as any} />,
          },
          {
            key: 'raw',
            label: 'Raw JSON',
            children: (
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Button size="small" onClick={copyJson}>
                    Copy
                  </Button>
                  <Button size="small" onClick={downloadJson}>
                    Download JSON
                  </Button>
                  <span style={{ color: 'var(--sh-muted)', fontSize: 12 }}>
                    ~ {(rawJson.length / 1024).toFixed(1)} KB
                  </span>
                </Space>
                <pre
                  style={{
                    maxHeight: 560,
                    overflow: 'auto',
                    background: 'var(--sh-sunken)',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 12,
                  }}
                >
                  {rawJson}
                </pre>
              </div>
            ),
          },
          {
            key: 'backend',
            label: 'Backend',
            children: (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  type="info"
                  showIcon
                  message="POST the current package to any backend endpoint to check the payload (the address stays in localStorage)"
                />
                <Space.Compact style={{ width: '100%' }}>
                  <Input
                    placeholder="https://your-backend/api/issues"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                  />
                  <Button
                    type="primary"
                    loading={posting}
                    onClick={postToBackend}
                  >
                    Send
                  </Button>
                </Space.Compact>
                {postResult && (
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      background: 'var(--sh-sunken)',
                      padding: 12,
                      borderRadius: 4,
                      fontSize: 12,
                      maxHeight: 400,
                      overflow: 'auto',
                    }}
                  >
                    {postResult}
                  </pre>
                )}
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.toLocaleTimeString('en-GB', { hour12: false })}.${String(
    d.getMilliseconds()
  ).padStart(3, '0')}`;
}
