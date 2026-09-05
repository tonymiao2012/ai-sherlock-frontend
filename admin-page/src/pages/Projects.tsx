import { App as AntApp, Button, Card, Descriptions, Divider, Drawer, Dropdown, Empty, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { DownOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Project, Ticket } from '../types';
import * as api from '../services/api';
import { fmtDateTime } from '../domain/format';
import { useSession } from '../context/Session';
import { ProjectForm } from '../components/ProjectForm';

const CAP_LABEL: Record<string, string> = { aiDiagnosis: 'AI 诊断', sourceAnalysis: '源码分析', autoFix: '自动修复' };

type Row = Project & { openCount: number; doneCount: number };

/** §5 项目管理：Owner 建项目并绑定仓库 / JIRA / Kibana 索引，Admin 控制谁能建 */
export function ProjectsPage() {
  const { message, modal } = AntApp.useApp();
  const nav = useNavigate();
  const { user, users, groups, visibleProjects, can, groupName, userName, userEmail, refresh } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [detail, setDetail] = useState<Project>();
  const [accessDraft, setAccessDraft] = useState<Project['access']>();
  const [savingAccess, setSavingAccess] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; project?: Project }>({ open: false });

  useEffect(() => {
    api.listTickets().then(setTickets);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const kw = keyword.trim().toLowerCase();
    return visibleProjects
      .filter((p) => (status === 'ALL' ? true : status === p.status))
      .filter((p) => !kw || `${p.name}${p.projectKey}${p.jira.projectKey}`.toLowerCase().includes(kw))
      .map((p) => ({
        ...p,
        openCount: tickets.filter((t) => t.projectId === p.id && t.jiraStatus !== 'Done' && t.jiraStatus !== 'Rejected').length,
        doneCount: tickets.filter((t) => t.projectId === p.id && t.jiraStatus === 'Done').length,
      }));
  }, [visibleProjects, tickets, keyword, status]);

  const canCreate = can('project.create');

  const archive = (p: Project) =>
    modal.confirm({
      title: `归档 ${p.name}？`,
      content: '归档后不再出现在成员可见列表，历史 Case 与 JIRA 记录保留。',
      okText: '确认归档',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.archiveProject(p.projectKey, user.email);
        await refresh();
        setDetail(undefined);
        message.success('已归档');
      },
    });

  const columns: ColumnsType<Row> = [
    {
      title: '项目',
      dataIndex: 'name',
      width: 186,
      render: (_, p) => (
        <div>
          <Typography.Link strong onClick={() => setDetail(p)}>
            {p.name}
          </Typography.Link>
          <div className="ac-meta">
            <span>{p.projectKey}</span>
            {p.status === 'ARCHIVED' && <Tag>已归档</Tag>}
          </div>
        </div>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'ownerId',
      width: 128,
      render: (id: string) => (
        <div>
          <div>{userName(id)}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            默认 Assignee
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '代码仓库',
      key: 'repos',
      width: 176,
      render: (_, p) => {
        const fe = p.repos.filter((r) => r.repoType === 'FRONTEND').length;
        const be = p.repos.filter((r) => r.repoType === 'BACKEND').length;
        const bad = p.repos.filter((r) => r.verifyState !== 'VERIFIED').length;
        return (
          <div>
            <div>{`前端 ${fe} · 后端 ${be} · 映射 ${p.urlMappings.length}`}</div>
            {bad > 0 ? <Tag color="warning">{bad} 个未校验</Tag> : <Tag color="success">仓库可达</Tag>}
          </div>
        );
      },
    },
    {
      title: 'JIRA / 日志索引',
      key: 'jira',
      width: 186,
      render: (_, p) => (
        <div>
          <div>{`${p.jira.projectKey} · ${p.jira.issueType}`}</div>
          <div className="ac-meta">
            <span>{p.logging.indexPattern || '未绑定索引'}</span>
          </div>
        </div>
      ),
    },
    {
      title: '访问范围',
      key: 'access',
      width: 196,
      render: (_, p) => (
        <Space size={2} wrap>
          {p.access.groupIds.map((g) => (
            <Tag key={g}>{groupName(g)}</Tag>
          ))}
          {p.access.userIds.map((u) => (
            <Tag key={u} color="blue">
              {userName(u)}
            </Tag>
          ))}
          {p.access.groupIds.length === 0 && p.access.userIds.length === 0 && (
            <Typography.Text type="secondary">仅 Owner</Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: '能力',
      key: 'cap',
      width: 158,
      render: (_, p) => (
        <Space size={2} wrap>
          {Object.entries(p.capability)
            .filter(([k, v]) => k in CAP_LABEL && v)
            .map(([k]) => (
              <Tag key={k} color="success">
                {CAP_LABEL[k]}
              </Tag>
            ))}
          {p.capability.approvalMode === 'REVIEW_REQUIRED' && <Tag>需审批</Tag>}
        </Space>
      ),
    },
    {
      title: '工单',
      key: 'count',
      width: 100,
      render: (_, p) => (
        <div className="ac-meta">
          <span>
            Open <b>{p.openCount}</b>
          </span>
          <span>
            Done <b>{p.doneCount}</b>
          </span>
        </div>
      ),
    },
    { title: '更新', dataIndex: 'updatedAt', width: 92, render: (v: string) => fmtDateTime(v).slice(0, 10) },
    {
      title: '操作',
      key: 'ops',
      fixed: 'right',
      width: 158,
      render: (_, p) => {
        const editableNow = can('project.edit', p);
        return (
          <Space size={2}>
            <Button size="small" type="link" onClick={() => nav(`/tickets?project=${p.projectKey}`)}>
              工单
            </Button>
            <Button
              size="small"
              type="link"
              onClick={() => {
                if (!editableNow) return message.warning('只有项目 Owner 或管理员可编辑该项目');
                setEditing({ open: true, project: p });
              }}
            >
              编辑
            </Button>
            <Dropdown
              menu={{
                items: [
                  { key: 'validate', label: '配置校验' },
                  { key: 'archive', label: '归档项目', danger: true, disabled: !editableNow },
                ],
                onClick: async ({ key }) => {
                  if (key === 'validate') {
                    const report = await api.validateProject(p.projectKey, user.email);
                    const passed = report.filter((r) => r.ok).length;
                    message[passed === report.length ? 'success' : 'warning'](`校验完成：${passed}/${report.length} 项通过`);
                  } else {
                    archive(p);
                  }
                },
              }}
            >
              <Button size="small" type="text" icon={<DownOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Card
        variant="borderless"
        title="项目管理"
        styles={{ body: { paddingTop: 14 } }}
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索名称 / Key / JIRA"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 220 }}
            />
            <Select
              value={status}
              style={{ width: 116 }}
              onChange={setStatus}
              options={[
                { value: 'ACTIVE', label: '进行中' },
                { value: 'ARCHIVED', label: '已归档' },
                { value: 'ALL', label: '全部' },
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} disabled={!canCreate} onClick={() => setEditing({ open: true })}>
              创建项目
            </Button>
          </Space>
        }
      >
        {!canCreate && (
          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
            普通成员只能查看被授权项目的工单列表。创建项目请让管理员在「成员与权限」中授予 PROJECT_OWNER 角色。
          </Typography.Paragraph>
        )}
        <Table<Row>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1280 }}
          pagination={{ pageSize: 10, size: 'small', showTotal: (t) => `共 ${t} 个项目` }}
        />
      </Card>

      <ProjectForm open={editing.open} project={editing.project} onClose={() => setEditing({ open: false })} onSaved={() => setEditing({ open: false })} />

      <Drawer
        open={Boolean(detail)}
        width={740}
        title={detail ? `项目配置 · ${detail.name}` : ''}
        onClose={() => {
          setDetail(undefined);
          setAccessDraft(undefined);
        }}
        extra={
          detail && (
            <Space>
              <Button onClick={() => setEditing({ open: true, project: detail })}>编辑</Button>
              <Button type="primary" onClick={() => nav(`/tickets?project=${detail.projectKey}`)}>
                查看工单
              </Button>
            </Space>
          )
        }
      >
        {detail && (
          <>
            <Descriptions
              size="small"
              column={2}
              title="基本信息"
              items={[
                { key: 'k', label: '项目 Key', children: detail.projectKey },
                { key: 'o', label: 'Owner', children: `${userName(detail.ownerId)} · ${userEmail(detail.ownerId)}` },
                { key: 'd', label: '说明', children: detail.description || '—', span: 2 },
                { key: 'c', label: '时间', children: `${fmtDateTime(detail.createdAt)} 创建 · ${fmtDateTime(detail.updatedAt)} 更新`, span: 2 },
              ]}
            />

            <Divider titlePlacement="left" plain>
              代码仓库
            </Divider>
            {detail.repos.length ? (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.repos}
                columns={[
                  { title: '类型', dataIndex: 'repoType', width: 58, render: (v: string) => (v === 'FRONTEND' ? '前端' : '后端') },
                  {
                    title: '仓库',
                    key: 'repo',
                    render: (_, r) => (
                      <Typography.Text>
                        {r.provider === 'BITBUCKET' ? 'Bitbucket' : 'GitHub'} {r.repoProject}/{r.repoSlug}
                      </Typography.Text>
                    ),
                  },
                  { title: '分支', dataIndex: 'defaultBranch', width: 76 },
                  { title: 'URL Pattern', dataIndex: 'urlPatterns', width: 160, render: (v: string[]) => v.join(' , ') || '—' },
                  {
                    title: '校验',
                    dataIndex: 'verifyState',
                    width: 84,
                    render: (v: string, r) => (
                      <Tag color={v === 'VERIFIED' ? 'success' : v === 'PENDING' ? 'default' : 'error'}>{r.lastCommit || v}</Tag>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="未绑定仓库" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}

            <Divider titlePlacement="left" plain>
              JIRA 与日志
            </Divider>
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'j',
                  label: 'JIRA',
                  children: `${detail.jira.site}/projects/${detail.jira.projectKey} · Issue Type ${detail.jira.issueType} · ${
                    detail.jira.autoCreate ? 'Finding 验证后自动建单' : '人工确认后建单'
                  }`,
                },
                { key: 'l', label: '日志', children: `${detail.logging.baseUrl} · ${detail.logging.indexPattern || '未绑定'}` },
                {
                  key: 'f',
                  label: '字段映射',
                  children: Object.entries(detail.logging.fieldMap)
                    .map(([k, v]) => `${k}→${v}`)
                    .join(' · '),
                },
                { key: 'v', label: '版本解析', children: detail.logging.versionMapping },
                { key: 'u', label: 'UAT', children: detail.uat.enabled ? `${detail.uat.pipelineId} · ${detail.uat.deployMethod}` : '未启用' },
              ]}
            />

            <Divider titlePlacement="left" plain>
              访问授权
            </Divider>
            <Space align="start" wrap>
              <Select
                mode="multiple"
                style={{ minWidth: 300 }}
                value={accessDraft?.groupIds ?? detail.access.groupIds}
                disabled={!can('project.access', detail)}
                placeholder="选择 Group"
                onChange={(v) => setAccessDraft({ ...(accessDraft ?? detail.access), groupIds: v })}
                options={groups.map((g) => ({ value: g.id, label: `${g.name}（${g.memberCount} 人）` }))}
              />
              <Select
                mode="multiple"
                style={{ minWidth: 240 }}
                placeholder="追加个人"
                value={accessDraft?.userIds ?? detail.access.userIds}
                disabled={!can('project.access', detail)}
                onChange={(v) => setAccessDraft({ ...(accessDraft ?? detail.access), userIds: v })}
                options={users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
              />
              {can('project.access', detail) && (
                <Button
                  type="primary"
                  loading={savingAccess}
                  onClick={async () => {
                    setSavingAccess(true);
                    await api.updateProjectAccess(detail.projectKey, accessDraft ?? detail.access, user.email);
                    const fresh = await api.getProject(detail.projectKey);
                    await refresh();
                    setSavingAccess(false);
                    setAccessDraft(undefined);
                    if (fresh) setDetail(fresh);
                    message.success('访问授权已更新');
                  }}
                >
                  保存授权
                </Button>
              )}
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
              Group 决定谁能看到该项目的工单列表；列表内普通成员只能查看与跳转 JIRA，不能批准 AI 修复。
            </Typography.Paragraph>
            <Button danger onClick={() => archive(detail)} disabled={!can('project.edit', detail)}>
              归档项目
            </Button>
          </>
        )}
      </Drawer>
    </>
  );
}
