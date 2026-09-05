import { Button, Card, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import type { Case, Ticket } from '../types';
import * as api from '../services/api';
import { FINDING_TYPE_META, SEVERITY_META, stageOf } from '../domain/ticket';
import { fmtShort, timeAgo } from '../domain/format';
import { useSession } from '../context/Session';
import { CaseDrawer } from '../components/CaseDrawer';
import { StageTag } from '../components/StageTag';

const CASE_STATUS: Record<Case['status'], string> = {
  RECEIVED: '已接收',
  PARSING: '解析中',
  ENRICHING: '补全证据',
  ANALYZING: '分析中',
  DIAGNOSED: '已诊断',
  JIRA: '已建单',
  DONE: '已关单',
  FAILED: '失败',
};

/** §7 Case 列表：插件上报的原始上下文，诊断结论与 JIRA 工单在此汇合 */
export function CasesPage() {
  const { visibleProjects, user, can, userName } = useSession();
  const [cases, setCases] = useState<Case[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [projectId, setProjectId] = useState<string>();
  const [status, setStatus] = useState<Case['status']>();
  const [active, setActive] = useState<Ticket>();

  useEffect(() => {
    Promise.all([api.listCases(), api.listTickets()]).then(([c, t]) => {
      setCases(c.filter((x) => visibleProjects.some((p) => p.id === x.projectId)));
      setTickets(t);
      setLoading(false);
    });
  }, [visibleProjects]);

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return cases
      .filter((c) => (projectId ? c.projectId === projectId : true))
      .filter((c) => (status ? c.status === status : true))
      .filter((c) => !kw || `${c.caseKey}${c.title}${c.pageUrl}`.toLowerCase().includes(kw))
      .sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt));
  }, [cases, keyword, projectId, status]);

  const ticketOf = (c: Case) => tickets.find((t) => t.caseKey === c.caseKey);

  const columns: ColumnsType<Case> = [
    {
      title: 'Case',
      dataIndex: 'caseKey',
      width: 108,
      render: (v: string, c) => (
        <div>
          <Typography.Link strong onClick={() => ticketOf(c) && setActive(ticketOf(c))}>
            {v}
          </Typography.Link>
          <div className="ac-meta">
            <span>{c.findings[0]?.findingKey}</span>
          </div>
        </div>
      ),
    },
    {
      title: '问题',
      dataIndex: 'title',
      render: (v: string, c) => (
        <div>
          <div className="ac-ticket__title">{v}</div>
          <div className="ac-meta" style={{ marginTop: 2 }}>
            <span>{c.pageUrl.replace(/^https?:\/\//, '').slice(0, 40)}</span>
            <span>{c.buildVersion}</span>
          </div>
        </div>
      ),
    },
    { title: '项目', dataIndex: 'projectId', width: 96, render: (id: string) => visibleProjects.find((p) => p.id === id)?.name ?? '—' },
    {
      title: '类型 / 严重',
      key: 'sev',
      width: 118,
      render: (_, c) => {
        const t = ticketOf(c);
        return (
          <Space size={4}>
            <Tag>{t ? FINDING_TYPE_META[t.findingType].short : '—'}</Tag>
            <span style={{ color: SEVERITY_META[c.severity].color }}>{c.severity}</span>
          </Space>
        );
      },
    },
    { title: '环境', dataIndex: 'environment', width: 66 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 96,
      render: (v: Case['status'], c) => {
        const t = ticketOf(c);
        return (
          <Space size={4} direction="vertical">
            <Tag color={v === 'FAILED' ? 'error' : v === 'DONE' ? 'success' : 'processing'}>{CASE_STATUS[v]}</Tag>
            {t && <StageTag stage={stageOf(t)} />}
          </Space>
        );
      },
    },
    { title: '上报人', dataIndex: 'reporter', width: 110 },
    {
      title: '时间',
      dataIndex: 'reportedAt',
      width: 104,
      render: (v: string) => (
        <div>
          <div>{fmtShort(v)}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {timeAgo(v)}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'ops',
      fixed: 'right',
      width: 128,
      render: (_, c) => {
        const t = ticketOf(c);
        return (
          <Space size={2}>
            <Button size="small" type="link" disabled={!t} onClick={() => t && setActive(t)}>
              证据详情
            </Button>
            {t && (
              <Button size="small" type="link" onClick={() => window.open(t.jiraUrl, '_blank', 'noopener')}>
                JIRA
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card
      variant="borderless"
      title="Case 列表"
      styles={{ body: { paddingTop: 14 } }}
      extra={
        <Typography.Text type="secondary">
          当前身份：{userName(user.id)}（{user.role}）· 可见项目 {visibleProjects.length} 个
          {!can('ticket.approve') && ' · 只读'}
        </Typography.Text>
      }
    >
      <Space wrap style={{ marginBottom: 12 }}>
        <Input
          allowClear
          style={{ width: 240 }}
          prefix={<SearchOutlined />}
          placeholder="搜索 Case Key / 标题 / 页面"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          allowClear
          style={{ width: 158 }}
          placeholder="全部项目"
          value={projectId}
          onChange={setProjectId}
          options={visibleProjects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          allowClear
          style={{ width: 132 }}
          placeholder="全部状态"
          value={status}
          onChange={setStatus}
          options={Object.entries(CASE_STATUS).map(([v, label]) => ({ value: v as Case['status'], label }))}
        />
      </Space>
      <Table<Case>
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={rows}
        scroll={{ x: 1120 }}
        pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 条 Case` }}
      />
      <CaseDrawer
        ticket={active}
        open={Boolean(active)}
        onClose={() => setActive(undefined)}
        canApprove={can('ticket.approve', active && visibleProjects.find((p) => p.id === active.projectId))}
        onApprove={async (t) => {
          const next = await api.approveFix(t.id, user.email);
          setTickets((prev) => prev.map((x) => (x.id === t.id ? next : x)));
          setActive(undefined);
        }}
        onReject={async (t) => {
          const next = await api.rejectFix(t.id, '证据不足，需补充复现路径', user.email);
          setTickets((prev) => prev.map((x) => (x.id === t.id ? next : x)));
          setActive(undefined);
        }}
      />
    </Card>
  );
}
