import { Avatar, Layout, Menu, Select, Space, Tag, Typography } from 'antd';
import {
  AppstoreOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  IdcardOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import type { Role } from '../types';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LOGO_URL, ROOT_URL } from '../assets';
import { ROLE_LABEL, useSession } from '../context/Session';

const { Sider, Header, Content } = Layout;

/** §4.1 导航 + §2 角色可见性 */
const MENUS: { key: string; label: string; icon: React.ReactNode; roles: Role[] }[] = [
  { key: '/dashboard', label: 'Dashboard', icon: <DashboardOutlined />, roles: ['ADMIN', 'PROJECT_OWNER'] },
  { key: '/my-tickets', label: '我的工单', icon: <IdcardOutlined />, roles: ['DEVELOPER'] },
  { key: '/tickets', label: '工单列表', icon: <DatabaseOutlined />, roles: ['ADMIN', 'PROJECT_OWNER', 'DEVELOPER'] },
  { key: '/projects', label: '项目管理', icon: <AppstoreOutlined />, roles: ['ADMIN', 'PROJECT_OWNER', 'DEVELOPER'] },
  { key: '/cases', label: 'Case 列表', icon: <FileSearchOutlined />, roles: ['ADMIN', 'PROJECT_OWNER'] },
  { key: '/members', label: '成员与权限', icon: <TeamOutlined />, roles: ['ADMIN'] },
  { key: '/settings', label: '系统设置', icon: <SettingOutlined />, roles: ['ADMIN'] },
];

export const HOME_BY_ROLE: Record<Role, string> = {
  ADMIN: '/dashboard',
  PROJECT_OWNER: '/dashboard',
  DEVELOPER: '/my-tickets',
};

export function ConsoleLayout() {
  const { pathname, search } = useLocation();
  const nav = useNavigate();
  const { user, users, visibleProjects, switchUser } = useSession();
  const items = MENUS.filter((m) => m.roles.includes(user.role));
  const selected = items.find((m) => pathname.startsWith(m.key))?.key ?? HOME_BY_ROLE[user.role];
  const projectKey = new URLSearchParams(search).get('project') ?? undefined;

  return (
    <Layout className="ac-root">
      <Sider width={216} theme="light" className="ac-sider">
        <a className="ac-brand" href={ROOT_URL}>
          <img src={LOGO_URL} alt="" />
          <span>AI Sherlock</span>
        </a>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={({ key }) => nav(key)} />
      </Sider>

      <Layout>
        <Header className="ac-header">
          <Space size={12}>
            <Typography.Text className="ac-header__title">中台控制台</Typography.Text>
            <Select
              size="small"
              style={{ width: 168 }}
              placeholder="项目快捷切换"
              allowClear
              value={projectKey}
              onChange={(v) => nav(v ? `/tickets?project=${v}` : '/tickets')}
              options={visibleProjects.map((p) => ({ value: p.projectKey, label: p.name }))}
            />
          </Space>
          <Space size={12}>
            <Space size={6}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                身份
              </Typography.Text>
              <Select
                size="small"
                style={{ width: 210 }}
                value={user.id}
                onChange={switchUser}
                options={(['ADMIN', 'PROJECT_OWNER', 'DEVELOPER'] as Role[]).map((role) => ({
                  label: ROLE_LABEL[role],
                  options: users
                    .filter((u) => u.role === role)
                    .map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` })),
                }))}
              />
            </Space>
            <span className="ac-user">
              <Avatar size={26}>{user.name.slice(0, 1)}</Avatar>
              {user.email}
              <Tag color={user.role === 'ADMIN' ? 'purple' : user.role === 'PROJECT_OWNER' ? 'green' : 'default'}>
                {ROLE_LABEL[user.role]}
              </Tag>
            </span>
          </Space>
        </Header>
        <Content className="ac-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
