import { Spin } from 'antd';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CaseV2, Group, GroupV2, NewRole, Project, Role, StaffType, User, UserV2 } from '../types';
import * as api from '../services/api';

type Action =
  | 'group.create'
  | 'group.manage'
  | 'project.create'
  | 'project.edit'
  | 'case.view'
  | 'case.assign'
  | 'case.status.modify'
  | 'case.verify'
  | 'ai.analysis'
  | 'ai.autofix'
  | 'staff.manage';

interface SessionValue {
  user: User | UserV2;
  users: (User | UserV2)[];
  projects: Project[];
  groups: Group[];
  groupsV2: GroupV2[];
  casesV2: CaseV2[];
  loading: boolean;
  /** 当前身份可见的项目（授权组或单人授权命中） */
  visibleProjects: Project[];
  /** 当前身份可见的 Cases（Group 范围内） */
  visibleCases: CaseV2[];
  switchUser: (userId: string) => void;
  can: (action: Action, context?: { group?: GroupV2; case?: CaseV2 }) => boolean;
  isOwnerOf: (group?: GroupV2) => boolean;
  refresh: () => Promise<void>;
  userName: (id: string) => string;
  userEmail: (id: string) => string;
  groupName: (id: string) => string;
}

const Ctx = createContext<SessionValue | null>(null);

const IDENTITY_KEY = 'ai-sherlock-identity';

/** 权限矩阵（docs/backend-admin-requirements.md §2.2） */
function allow(
  user: User | UserV2,
  action: Action,
  context?: { group?: GroupV2; case?: CaseV2 }
): boolean {
  const role = user.role as NewRole;
  const staffType = (user as UserV2).staffType;
  const isOwnerOfGroup = context?.group?.ownerId === user.id;
  const isAssigned = context?.case?.assigneeId === user.id;

  switch (action) {
    case 'group.create':
    case 'project.create':
      return role === 'ADMIN';

    case 'group.manage':
    case 'staff.manage':
    case 'project.edit':
      return role === 'ADMIN' || (role === 'OWNER' && isOwnerOfGroup);

    case 'case.view':
      return true; // 所有角色可见（Group 范围内，由 visibleCases 过滤）

    case 'case.assign':
      if (role === 'ADMIN' || role === 'OWNER') return true;
      if (role === 'STAFF' && staffType === 'DEV') {
        // Dev 仅可自分配（分配给自己或无 assignee 的 Case）
        return !context?.case?.assigneeId || context.case.assigneeId === user.id;
      }
      return false;

    case 'case.status.modify':
      if (role === 'ADMIN' || role === 'OWNER') return true;
      if (role === 'STAFF') {
        if (staffType === 'DEV' && isAssigned) return true;
        if (staffType === 'TESTER' && context?.case?.status === 'VERIFYING') return true;
      }
      return false;

    case 'case.verify':
      return role === 'ADMIN' || role === 'OWNER' ||
             (role === 'STAFF' && staffType === 'TESTER');

    case 'ai.analysis':
    case 'ai.autofix':
      return role === 'ADMIN' || role === 'OWNER' ||
             (role === 'STAFF' && staffType === 'DEV');

    default:
      return false;
  }
}

function isOwnerOf(user: User | UserV2, group?: GroupV2) {
  if (!group) return user.role === 'OWNER';
  return group.ownerId === user.id;
}

function visible(user: User | UserV2, projects: Project[]) {
  if (user.role === 'ADMIN') return projects;
  return projects.filter(
    (p) =>
      p.status === 'ACTIVE' &&
      (p.ownerId === user.id ||
        p.access.userIds.includes(user.id) ||
        p.access.groupIds.some((g) => user.groupIds.includes(g))),
  );
}

function visibleCases(user: User | UserV2, cases: CaseV2[], groups: GroupV2[]) {
  if (user.role === 'ADMIN') return cases;
  const userGroups = groups.filter(g => g.memberIds.includes(user.id));
  const groupIds = userGroups.map(g => g.id);
  return cases.filter(c => groupIds.includes(c.groupId));
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<(User | UserV2)[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsV2, setGroupsV2] = useState<GroupV2[]>([]);
  const [casesV2, setCasesV2] = useState<CaseV2[]>([]);
  const [identity, setIdentity] = useState<string>(() => localStorage.getItem(IDENTITY_KEY) || 'u_admin');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [u, p, g, g2, c2] = await Promise.all([
      api.listUsers(),
      api.listProjects(),
      api.listGroups(),
      api.listGroupsV2(),
      api.listCasesV2(),
    ]);
    setUsers(u);
    setProjects(p);
    setGroups(g);
    setGroupsV2(g2);
    setCasesV2(c2);
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
      groupsV2,
      casesV2,
      loading,
      visibleProjects: visible(user, projects),
      visibleCases: visibleCases(user, casesV2, groupsV2),
      switchUser,
      can: (action, context) => allow(user, action, context),
      isOwnerOf: (group) => isOwnerOf(user, group),
      refresh,
      userName: (id) => users.find((u) => u.id === id)?.name ?? '—',
      userEmail: (id) => users.find((u) => u.id === id)?.email ?? '—',
      groupName: (id) => groups.find((g) => g.id === id)?.name ?? id,
    };
  }, [user, users, projects, groups, groupsV2, casesV2, loading, switchUser, refresh]);

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

export const ROLE_LABEL: Record<NewRole, string> = {
  ADMIN: '系统管理员',
  OWNER: 'Group Owner',
  STAFF: 'Staff',
};

export const STAFF_TYPE_LABEL: Record<StaffType, string> = {
  DEV: '开发',
  TESTER: '测试',
};

/** @deprecated Use ROLE_LABEL with NewRole instead */
export const LEGACY_ROLE_LABEL: Record<Role, string> = {
  ADMIN: '系统管理员',
  PROJECT_OWNER: '项目 Owner',
  DEVELOPER: '普通成员',
};
