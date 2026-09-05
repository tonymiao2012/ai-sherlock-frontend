import { Spin } from 'antd';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Group, Project, Role, User } from '../types';
import * as api from '../services/api';

type Action =
  | 'project.create'
  | 'project.edit'
  | 'project.access'
  | 'ticket.approve'
  | 'ticket.sync'
  | 'member.manage'
  | 'settings.manage';

interface SessionValue {
  user: User;
  users: User[];
  projects: Project[];
  groups: Group[];
  loading: boolean;
  /** 当前身份可见的项目（授权组或单人授权命中） */
  visibleProjects: Project[];
  switchUser: (userId: string) => void;
  can: (action: Action, project?: Project) => boolean;
  isOwnerOf: (project?: Project) => boolean;
  refresh: () => Promise<void>;
  userName: (id: string) => string;
  userEmail: (id: string) => string;
  groupName: (id: string) => string;
}

const Ctx = createContext<SessionValue | null>(null);

const IDENTITY_KEY = 'ai-sherlock-identity';

/** 权限矩阵（PRD §2）：普通成员只读列表并跳转 JIRA，Owner 管项目与审批，Admin 管角色 */
function allow(user: User, action: Action, project?: Project): boolean {
  const owner = project ? isProjectOwner(user, project) : user.role === 'PROJECT_OWNER';
  switch (action) {
    case 'project.create':
      // Admin 直接可建；被授予 PROJECT_OWNER 后即获得建项目权限
      return user.role === 'ADMIN' || owner;
    case 'project.edit':
    case 'project.access':
    case 'ticket.approve':
      return user.role === 'ADMIN' || owner;
    case 'ticket.sync':
      return true;
    case 'member.manage':
    case 'settings.manage':
      return user.role === 'ADMIN';
    default:
      return false;
  }
}

function isProjectOwner(user: User, project: Project) {
  return user.role === 'ADMIN' || user.managedProjectIds.includes(project.id) || project.ownerId === user.id;
}

function visible(user: User, projects: Project[]) {
  if (user.role === 'ADMIN') return projects;
  return projects.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      (p.ownerId === user.id ||
        user.managedProjectIds.includes(p.id) ||
        p.access.userIds.includes(user.id) ||
        p.access.groupIds.some((g) => user.groupIds.includes(g))),
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [identity, setIdentity] = useState<string>(() => localStorage.getItem(IDENTITY_KEY) || 'u_admin');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [u, p, g] = await Promise.all([api.listUsers(), api.listProjects(), api.listGroups()]);
    setUsers(u);
    setProjects(p);
    setGroups(g);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const user = useMemo(
    () => users.find((u) => u.id === identity) ?? users.find((u) => u.role === 'ADMIN') ?? users[0],
    [users, identity],
  );

  const switchUser = useCallback((userId: string) => {
    setIdentity(userId);
    localStorage.setItem(IDENTITY_KEY, userId);
  }, []);

  const value = useMemo<SessionValue | null>(() => {
    if (!user) return null;
    return {
      user,
      users,
      projects,
      groups,
      loading,
      visibleProjects: visible(user, projects),
      switchUser,
      can: (action, project) => allow(user, action, project),
      isOwnerOf: (project) => (project ? isProjectOwner(user, project) : user.role === 'PROJECT_OWNER'),
      refresh,
      userName: (id) => users.find((u) => u.id === id)?.name ?? '—',
      userEmail: (id) => users.find((u) => u.id === id)?.email ?? '—',
      groupName: (id) => groups.find((g) => g.id === id)?.name ?? id,
    };
  }, [user, users, projects, groups, loading, switchUser, refresh]);

  if (!value)
    return (
      <div className="ac-boot">
        <Spin size="large" />
      </div>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: '系统管理员',
  PROJECT_OWNER: '项目 Owner',
  DEVELOPER: '普通成员',
};
