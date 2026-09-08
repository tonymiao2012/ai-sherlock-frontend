import { Avatar, Button, Card, Descriptions, Empty, Modal, Space, Table, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useMemo, useState } from 'react';
import type { GroupV2 } from '../types';
import { useSession } from '../context/Session';

export function OrganizationPage() {
  const { groupsV2, users, projects, userName, can } = useSession();
  const [selected, setSelected] = useState<GroupV2>();

  const columns: ColumnsType<GroupV2> = [
    {
      title: 'Group',
      dataIndex: 'name',
      width: 180,
      render: (v: string, g) => (
        <div>
          <Typography.Link strong onClick={() => setSelected(g)}>
            {v}
          </Typography.Link>
          <div className="ac-meta">{g.description}</div>
        </div>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'ownerId',
      width: 120,
      render: (id: string) => userName(id),
    },
    {
      title: '成员',
      dataIndex: 'memberIds',
      width: 80,
      render: (ids: string[]) => ids.length,
    },
    {
      title: '项目',
      dataIndex: 'projectIds',
      width: 80,
      render: (ids: string[]) => ids.length,
    },
  ];

  const memberColumns = useMemo<ColumnsType<{ id: string; name: string; email: string; role: string }>>(
    () => [
      {
        title: '成员',
        key: 'user',
        render: (_, u) => (
          <Space>
            <Avatar size="small">{u.name.slice(0, 1)}</Avatar>
            <span>{u.name}</span>
          </Space>
        ),
      },
      { title: '邮箱', dataIndex: 'email' },
      { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    ],
    [],
  );

  const selectedMembers = useMemo(() => {
    if (!selected) return [];
    return selected.memberIds
      .map((id) => users.find((u) => u.id === id))
      .filter(Boolean)
      .map((u) => ({ id: u!.id, name: u!.name, email: u!.email, role: u!.role }));
  }, [selected, users]);

  const selectedProjects = useMemo(() => {
    if (!selected) return [];
    return selected.projectIds
      .map((id) => projects.find((p) => p.id === id))
      .filter(Boolean);
  }, [selected, projects]);

  return (
    <Card
      variant="borderless"
      title="组织管理"
      styles={{ body: { paddingTop: 14 } }}
      extra={
        can('group.create') && (
          <Button type="primary" icon={<PlusOutlined />} size="small">
            新建 Group
          </Button>
        )
      }
    >
      <Table<GroupV2>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={groupsV2}
        pagination={false}
        onRow={(g) => ({ onClick: () => setSelected(g), style: { cursor: 'pointer' } })}
      />

      <Modal
        open={Boolean(selected)}
        title={selected?.name}
        onCancel={() => setSelected(undefined)}
        footer={null}
        width={640}
      >
        {selected && (
          <div>
            <Descriptions
              size="small"
              column={2}
              style={{ marginBottom: 16 }}
              items={[
                { key: 'desc', label: '描述', children: selected.description },
                { key: 'owner', label: 'Owner', children: userName(selected.ownerId) },
                { key: 'members', label: '成员数', children: selected.memberIds.length },
                { key: 'projects', label: '项目数', children: selected.projectIds.length },
              ]}
            />

            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
              成员列表
            </Typography.Text>
            <Table
              rowKey="id"
              size="small"
              columns={memberColumns}
              dataSource={selectedMembers}
              pagination={false}
              style={{ marginBottom: 16 }}
            />

            <Typography.Text strong style={{ marginBottom: 8, display: 'block' }}>
              关联项目
            </Typography.Text>
            {selectedProjects.length > 0 ? (
              <Space wrap>
                {selectedProjects.map((p) => (
                  <Tag key={p!.id}>{p!.name}</Tag>
                ))}
              </Space>
            ) : (
              <Empty description="暂无关联项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
