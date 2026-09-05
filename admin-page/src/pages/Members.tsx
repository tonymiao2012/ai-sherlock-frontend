import { App as AntApp, Alert, Button, Card, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { AuditLogItem, Role, Ticket, User } from '../types';
import * as api from '../services/api';
import { fmtDateTime, timeAgo } from '../domain/format';
import { ROLE_LABEL, useSession } from '../context/Session';

const ROLE_COLOR: Record<Role, string> = { ADMIN: 'purple', PROJECT_OWNER: 'green', DEVELOPER: 'default' };

/** §2 / §3 角色与授权：Admin 授予 PROJECT_OWNER，即授予「创建项目 + 管项目 + 批修复」 */
export function MembersPage() {
  const { message } = AntApp.useApp();
  const { user, users, groups, projects, can, refresh } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [granting, setGranting] = useState<User>();
  const [targetRole, setTargetRole] = useState<Role>('PROJECT_OWNER');
  const [managed, setManaged] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([api.listTickets(), api.listAuditLogs()]).then(([t, l]) => {
      setTickets(t);
      setLogs(l);
    });
  }, []);

  const editable = can('member.manage');

  const openGrant = (u: User) => {
    setGranting(u);
    setTargetRole(u.role === 'PROJECT_OWNER' ? 'DEVELOPER' : 'PROJECT_OWNER');
    setManaged(u.managedProjectIds);
  };

  const submitGrant = async () => {
    if (!granting) return;
    await api.grantRole(granting.id, targetRole, user.email);
    if (targetRole === 'PROJECT_OWNER') {
      const fresh = users.find((u) => u.id === granting.id)!;
      await api.saveUser({ ...fresh, managedProjectIds: managed, status: 'ACTIVE' }, user.email);
    }
    await refresh();
    message.success(`${granting.name} 现在是${ROLE_LABEL[targetRole]}`);
    setGranting(undefined);
  };

  const assigned = (userId: string) => tickets.filter((t) => t.assigneeId === userId).length;

  const userColumns = [
    {
      title: '成员',
      dataIndex: 'name',
      width: 210,
      render: (_: unknown, u: User) => (
        <div>
          <Typography.Text strong>{u.name}</Typography.Text>
          <div className="ac-meta">
            <span>{u.email}</span>
          </div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 132,
      render: (r: Role) => <Tag color={ROLE_COLOR[r]}>{ROLE_LABEL[r]}</Tag>,
    },
    {
      title: '可管项目',
      key: 'managed',
      width: 200,
      render: (_: unknown, u: User) => {
        if (u.role === 'ADMIN') return <Typography.Text type="secondary">全部项目</Typography.Text>;
        const list = u.role === 'PROJECT_OWNER' ? projects.filter((p) => u.managedProjectIds.includes(p.id)) : [];
        if (!list.length) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Space size={2} wrap>
            {list.map((p) => (
              <Tag key={p.id}>{p.name}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: '所属 Group',
      key: 'groups',
      width: 210,
      render: (_: unknown, u: User) =>
        u.groupIds.length ? (
          <Space size={2} wrap>
            {u.groupIds.map((g) => (
              <Tag key={g}>{groups.find((x) => x.id === g)?.name ?? g}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未加入，看不到任何项目</Typography.Text>
        ),
    },
    {
      title: '登录方式',
      dataIndex: 'authProvider',
      width: 104,
      render: (v: User['authProvider']) => (v === 'SSO' ? '企业 SSO' : v === 'GOOGLE' ? 'Google OAuth' : '用户名密码'),
    },
    {
      title: '待处理工单',
      key: 'tickets',
      width: 108,
      render: (_: unknown, u: User) => (
        <Space size={4}>
          <b>{assigned(u.id)}</b>
          <Typography.Text type="secondary">分配</Typography.Text>
        </Space>
      ),
    },
    { title: '最近登录', dataIndex: 'lastLoginAt', width: 96, render: (v: string) => timeAgo(v) },
    {
      title: '状态',
      dataIndex: 'status',
      width: 78,
      render: (v: User['status']) => <Tag color={v === 'ACTIVE' ? 'success' : v === 'PENDING' ? 'warning' : 'default'}>{v}</Tag>,
    },
    {
      title: '操作',
      key: 'ops',
      fixed: 'right' as const,
      width: 150,
      render: (_: unknown, u: User) => (
        <Space size={2}>
          <Button size="small" type="link" disabled={!editable || u.id === user.id} onClick={() => openGrant(u)}>
            {u.role === 'PROJECT_OWNER' ? '回收权限' : '授予 Owner'}
          </Button>
          <Button
            size="small"
            type="link"
            disabled={!editable || u.id === user.id}
            onClick={async () => {
              const next = await api.toggleUserStatus(u.id, user.email);
              await refresh();
              message.info(`${next.name} 已${next.status === 'DISABLED' ? '停用' : '启用'}`);
            }}
          >
            {u.status === 'DISABLED' ? '启用' : '停用'}
          </Button>
        </Space>
      ),
    },
  ];

  const groupColumns = [
    { title: 'Group', dataIndex: 'name', width: 150 },
    { title: '说明', dataIndex: 'description' },
    {
      title: '成员',
      key: 'members',
      width: 240,
      render: (_: unknown, g: (typeof groups)[number]) => {
        const list = users.filter((u) => u.groupIds.includes(g.id));
        return (
          <Space size={2} wrap>
            {list.map((u) => (
              <Tag key={u.id}>{u.name}</Tag>
            ))}
            {list.length === 0 && <Typography.Text type="secondary">无人</Typography.Text>}
          </Space>
        );
      },
    },
    { title: '人数', dataIndex: 'memberCount', width: 66 },
    {
      title: '同步方式',
      dataIndex: 'autoSync',
      width: 100,
      render: (v: string) => ({ JIRA_ROLE: 'JIRA 角色', LDAP: 'LDAP', MANUAL: '手工维护' }[v] ?? v),
    },
    {
      title: '关联项目',
      key: 'projects',
      width: 210,
      render: (_: unknown, g: (typeof groups)[number]) => {
        const list = projects.filter((p) => p.access.groupIds.includes(g.id));
        return list.length ? (
          <Space size={2} wrap>
            {list.map((p) => (
              <Tag key={p.id}>{p.name}</Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">未授权任何项目</Typography.Text>
        );
      },
    },
  ];

  const logColumns = [
    { title: '时间', dataIndex: 'at', width: 132, render: (v: string) => fmtDateTime(v) },
    { title: '操作人', dataIndex: 'actor', width: 176 },
    {
      title: '动作',
      dataIndex: 'action',
      width: 132,
      render: (v: string) => <Tag>{ACTION_LABEL[v] ?? v}</Tag>,
    },
    { title: '对象', dataIndex: 'target', width: 176 },
    { title: '详情', dataIndex: 'detail' },
    { title: 'IP', dataIndex: 'ip', width: 100 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 78,
      render: (v: AuditLogItem['result']) => <Tag color={v === 'SUCCESS' ? 'success' : v === 'DENIED' ? 'error' : 'warning'}>{v}</Tag>,
    },
  ];

  const ownerCount = users.filter((u) => u.role === 'PROJECT_OWNER').length;

  return (
    <Card
      variant="borderless"
      title="成员与权限"
      styles={{ body: { paddingTop: 14 } }}
      extra={
        <Button type="primary" disabled={!editable} onClick={() => openGrant(users.find((u) => u.role === 'DEVELOPER' && u.status === 'ACTIVE')!)}>
          授予项目 Owner
        </Button>
      }
    >
      {!editable && <Alert type="info" showIcon message="仅系统管理员可修改角色与状态，此处为只读视图" style={{ marginBottom: 12 }} />}
      <Tabs
        items={[
          {
            key: 'users',
            label: `用户与角色（${users.length}）`,
            children: (
              <>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message={`当前 ${ownerCount} 位项目 Owner。授予 PROJECT_OWNER 后即获得：创建项目、绑定仓库与 Kibana 索引、配置访问 Group、批准或拒绝 AI 修复。`}
                  description="普通成员（DEVELOPER）只出现在被授权的工单列表里，处理动作回到 JIRA。工单分配以 JIRA Assignee 为准，不在中台单独维护。"
                />
                <Table<User> rowKey="id" size="small" columns={userColumns} dataSource={users} scroll={{ x: 1180 }} pagination={false} />
              </>
            ),
          },
          {
            key: 'groups',
            label: `Group（${groups.length}）`,
            children: (
              <>
                <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                  Group 是项目可见性的授权单位：项目按 Group 放开列表，组内成员都能查看，不需要逐个加人。
                </Typography.Paragraph>
                <Table rowKey="id" size="small" columns={groupColumns} dataSource={groups} pagination={false} scroll={{ x: 1000 }} />
              </>
            ),
          },
          {
            key: 'audit',
            label: '操作记录',
            children: <Table<AuditLogItem> rowKey="id" size="small" columns={logColumns} dataSource={logs} pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 1000 }} />,
          },
        ]}
      />

      <Modal
        open={Boolean(granting)}
        title={`调整 ${granting?.name ?? ''} 的权限`}
        okText="保存"
        onCancel={() => setGranting(undefined)}
        onOk={submitGrant}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={14}>
          <div>
            <Typography.Text type="secondary">邮箱</Typography.Text>
            <div>{granting?.email}</div>
          </div>
          <div>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
              角色
            </Typography.Paragraph>
            <Select
              style={{ width: '100%' }}
              value={targetRole}
              onChange={setTargetRole}
              options={[
                { value: 'PROJECT_OWNER', label: '项目 Owner —— 可建项目、管项目、批修复' },
                { value: 'DEVELOPER', label: '普通成员 —— 只读被授权项目的工单列表' },
                { value: 'ADMIN', label: '系统管理员 —— 全部项目与成员权限' },
              ]}
            />
          </div>
          {targetRole === 'PROJECT_OWNER' && (
            <div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                可管理的项目（建项目后可再调整）
              </Typography.Paragraph>
              <Select
                mode="multiple"
                style={{ width: '100%' }}
                value={managed}
                onChange={setManaged}
                placeholder="留空表示只授权建项目的能力"
                options={projects.map((p) => ({ value: p.id, label: `${p.name} · ${p.projectKey}` }))}
              />
            </div>
          )}
          {targetRole !== 'DEVELOPER' && (
            <Alert type="warning" showIcon message="回收 OWNER 角色会同时清空该项目下由他配置的仓库与日志绑定的管理权限，只保留查看。" />
          )}
        </Space>
      </Modal>
    </Card>
  );
}

const ACTION_LABEL: Record<string, string> = {
  ROLE_GRANT: '授予角色',
  ROLE_CHANGE: '变更角色',
  PROJECT_CREATE: '创建项目',
  PROJECT_UPDATE: '更新项目',
  PROJECT_ARCHIVE: '归档项目',
  REPO_BIND: '绑定仓库',
  PROJECT_VALIDATE: '配置校验',
  ACCESS_UPDATE: '访问授权',
  FIX_APPROVE: '批准修复',
  FIX_REJECT: '拒绝修复',
  SYNC_JIRA: '同步 JIRA',
  LOGIN: '登录',
  USER_STATUS: '账号状态',
  USER_SAVE: '保存成员',
};
