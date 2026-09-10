import { Card, Input, Select, Space, Table, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import type { CaseV2, CaseStatus } from '../types';
import * as api from '../services/api';
import { CASE_STATUS_META } from '../domain/caseLifecycle';
import { fmtShort } from '../domain/format';
import { useSession } from '../context/Session';
import { CaseStatusTag } from '../components/CaseStatusTag';
import { CaseDetailModal } from '../components/CaseDetailModal';

export function CasesPage() {
  const { visibleProjects, visibleCases, user, userName } = useSession();
  const [cases, setCases] = useState<CaseV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [projectId, setProjectId] = useState<string>();
  const [status, setStatus] = useState<CaseStatus>();
  const [onlyMine, setOnlyMine] = useState(false);
  const [active, setActive] = useState<CaseV2>();

  useEffect(() => {
    api.listCasesV2().then((c) => {
      setCases(c);
      setLoading(false);
    });
  }, []);

  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    let result = cases.length > 0 ? cases : visibleCases;
    return result
      .filter((c) => (projectId ? c.projectId === projectId : true))
      .filter((c) => (status ? c.status === status : true))
      .filter((c) => (onlyMine ? c.assigneeId === user.id : true))
      .filter((c) => !kw || `${c.caseKey}${c.title}${c.pageUrl}`.toLowerCase().includes(kw))
      .sort((a, b) => +new Date(b.reportedAt) - +new Date(a.reportedAt));
  }, [cases, visibleCases, keyword, projectId, status, onlyMine, user.id]);

  /* TODO: 操作列恢复时取消注释
  const handleAssign = async (caseId: string, assigneeId: string) => {
    const updated = await api.assignCase(caseId, assigneeId, user.email);
    setCases((prev) => prev.map((c) => (c.id === caseId ? updated : c)));
  };
  */

  const handleStatusChange = async (caseId: string, newStatus: CaseStatus) => {
    const updated = await api.changeCaseStatus(caseId, newStatus, user.email);
    setCases((prev) => prev.map((c) => (c.id === caseId ? updated : c)));
  };

  const columns: ColumnsType<CaseV2> = [
    {
      title: 'Case',
      dataIndex: 'caseKey',
      width: 240,
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Typography.Text strong>{v}</Typography.Text>
          <Typography.Text copyable={{ text: v }} style={{ fontSize: 12 }} />
        </div>
      ),
    },
    {
      title: '问题',
      dataIndex: 'title',
      render: (v: string) => <div className="ac-ticket__title">{v}</div>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
    },
    {
      title: '跟进人',
      dataIndex: 'assigneeId',
      width: 110,
      render: (id: string | undefined) => (id ? userName(id) : '—'),
    },
    {
      title: '上报时间',
      dataIndex: 'reportedAt',
      width: 160,
      render: (v: string) => fmtShort(v),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: CaseStatus) => <CaseStatusTag status={v} />,
    },
    // {
    //   title: '操作',
    //   key: 'ops',
    //   fixed: 'right',
    //   width: 160,
    //   render: (_, c) => (
    //     <CaseActions caseItem={c} onAssign={handleAssign} onStatusChange={handleStatusChange} />
    //   ),
    // },
  ];

  return (
    <Card
      variant="borderless"
      title="Case 列表"
      styles={{ body: { paddingTop: 14 } }}
      extra={
        <Space wrap>
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
            options={(Object.entries(CASE_STATUS_META) as [CaseStatus, { label: string }][]).map(([v, meta]) => ({
              value: v,
              label: meta.label,
            }))}
          />
          <Select
            allowClear
            style={{ width: 140 }}
            placeholder="全部人员"
            value={onlyMine ? 'mine' : undefined}
            onChange={(v) => setOnlyMine(v === 'mine')}
            options={[{ value: 'mine', label: '分配给我的' }]}
          />
        </Space>
      }
    >
      <Table<CaseV2>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={rows}
        onRow={(record) => ({
          onClick: () => setActive(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 条 Case` }}
      />
      <CaseDetailModal
        caseItem={active}
        open={Boolean(active)}
        onClose={() => setActive(undefined)}
        onStatusChange={handleStatusChange}
        onCaseUpdate={(updated) => {
          setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setActive(updated);
        }}
      />
    </Card>
  );
}
