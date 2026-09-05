import type {
  AuditLogItem,
  Case,
  DashboardOverview,
  Group,
  JiraStatus,
  Project,
  Repository,
  Role,
  SyncResult,
  Ticket,
  User,
} from '../types';
import { JIRA_STATUS_FLOW, stageOf } from '../domain/ticket';
import { AUDIT_LOGS, GROUPS, PROJECTS, TICKETS, USERS, buildCase } from './mockData';

/**
 * 接口层：签名与 PRD §12 API 契约一致（/projects、/projects/{key}/tickets、/dashboard/overview…）。
 * 当前为内存 mock，接后端时把每个函数体换成 request() 调用即可，页面无需改动。
 */
const sleep = (ms = 160) => new Promise((r) => setTimeout(r, ms + Math.random() * 120));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

let projects = clone(PROJECTS);
let tickets = clone(TICKETS);
let users = clone(USERS);
const groups = clone(GROUPS);
const auditLogs = clone(AUDIT_LOGS);

const JIRA_TO_FIX: Record<JiraStatus, Ticket['fix']['status']> = {
  Open: 'PENDING_APPROVAL',
  'Analysis Ready': 'PENDING_APPROVAL',
  'Fix Approved': 'APPROVED',
  'In Review': 'PR_CREATED',
  'Ready to Merge': 'PR_APPROVED',
  'In Deploy': 'MERGED',
  Done: 'UAT_DEPLOYED',
  Rejected: 'PR_REJECTED',
  Closed: 'UAT_DEPLOYED',
};

function log(actor: string, action: string, target: string, detail: string, result: AuditLogItem['result'] = 'SUCCESS') {
  auditLogs.unshift({
    id: `a_${Date.now()}_${auditLogs.length}`,
    at: new Date().toISOString(),
    actor,
    action,
    target,
    detail,
    ip: '10.20.3.7',
    result,
  });
}

/* ------------------------------ 项目 §12.2 ------------------------------ */

export async function listProjects(): Promise<Project[]> {
  await sleep();
  return clone(projects);
}

export async function getProject(projectKey: string): Promise<Project | undefined> {
  await sleep(80);
  return clone(projects.find((p) => p.projectKey === projectKey || p.id === projectKey));
}

export async function createProject(input: Project, actor: string): Promise<Project> {
  await sleep(420);
  const project = { ...input, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  projects = [project, ...projects];
  const owner = users.find((u) => u.id === project.ownerId);
  if (owner && !owner.managedProjectIds.includes(project.id)) owner.managedProjectIds.push(project.id);
  log(actor, 'PROJECT_CREATE', project.projectKey, `Owner：${owner?.email ?? '—'}，授权组 ${project.access.groupIds.length} 个`);
  return clone(project);
}

export async function updateProject(projectKey: string, patch: Partial<Project>, actor: string): Promise<Project> {
  await sleep(300);
  const idx = projects.findIndex((p) => p.projectKey === projectKey || p.id === projectKey);
  const next = { ...projects[idx], ...patch, updatedAt: new Date().toISOString() };
  projects[idx] = next;
  log(actor, 'PROJECT_UPDATE', next.projectKey, Object.keys(patch).join('、'));
  return clone(next);
}

export async function addRepository(projectKey: string, repo: Repository, actor: string): Promise<Project> {
  await sleep(280);
  const project = projects.find((p) => p.projectKey === projectKey || p.id === projectKey)!;
  project.repos.push(repo);
  project.updatedAt = new Date().toISOString();
  log(actor, 'REPO_BIND', `${project.projectKey} · ${repo.repoProject}/${repo.repoSlug}`, repo.verifyState);
  return clone(project);
}

export async function validateProject(projectKey: string, actor: string) {
  await sleep(900);
  const project = projects.find((p) => p.projectKey === projectKey || p.id === projectKey)!;
  const report = [
    ...project.repos.map((r) => ({
      target: `${r.repoType === 'FRONTEND' ? '前端' : '后端'}仓库 ${r.repoProject}/${r.repoSlug}`,
      ok: r.verifyState === 'VERIFIED',
      detail:
        r.verifyState === 'VERIFIED'
          ? `默认分支 ${r.defaultBranch} · HEAD ${r.lastCommit} · 最新 tag ${r.latestTag || '—'}`
          : r.verifyState === 'PENDING'
            ? '未校验：请检查 Bitbucket 项目 Token 是否授权该仓库读取'
            : '连接失败：GET /rest/api/1.0/projects 返回 404，仓库或分支不存在',
    })),
    {
      target: `日志索引 ${project.logging.indexPattern}`,
      ok: project.logging.verifyState === 'VERIFIED',
      detail:
        project.logging.verifyState === 'VERIFIED'
          ? `近 7 天 ${project.logging.docCount7d?.toLocaleString() ?? '0'} 条，字段映射 ${Object.keys(project.logging.fieldMap).length} 项可用`
          : '索引不可查询或字段 traceId 未映射',
    },
    {
      target: `JIRA Project ${project.jira.projectKey}`,
      ok: Boolean(project.jira.projectKey),
      detail: `Issue Type ${project.jira.issueType} · 默认 Assignee = 项目 Owner · 描述模板 ${project.jira.descriptionTemplate ? '已配置' : '未配置'}`,
    },
    {
      target: `UAT Pipeline ${project.uat.pipelineId || '—'}`,
      ok: project.uat.enabled && Boolean(project.uat.pipelineId),
      detail: project.uat.enabled ? `触发方式 ${project.uat.deployMethod}` : '未启用，Merge 后需人工发布',
    },
  ];
  log(actor, 'PROJECT_VALIDATE', project.projectKey, `${report.filter((r) => r.ok).length}/${report.length} 项通过`);
  return report;
}

export async function archiveProject(projectKey: string, actor: string): Promise<void> {
  await sleep(240);
  const project = projects.find((p) => p.projectKey === projectKey || p.id === projectKey);
  if (project) {
    project.status = 'ARCHIVED';
    project.updatedAt = new Date().toISOString();
    log(actor, 'PROJECT_ARCHIVE', projectKey, '软删除，保留历史 Case');
  }
}

/* --------------------------- 用户与权限 §12.7 --------------------------- */

export async function listUsers(): Promise<User[]> {
  await sleep();
  return clone(users);
}

export async function listGroups(): Promise<Group[]> {
  await sleep();
  return clone(groups);
}

export async function grantRole(userId: string, role: Role, actor: string): Promise<User> {
  await sleep(260);
  const user = users.find((u) => u.id === userId)!;
  const from = user.role;
  user.role = role;
  if (role !== 'PROJECT_OWNER') user.managedProjectIds = [];
  if (user.status === 'PENDING') user.status = 'ACTIVE';
  log(actor, 'ROLE_CHANGE', user.email, `${from} → ${role}`);
  return clone(user);
}

export async function saveUser(input: User, actor: string): Promise<User> {
  await sleep(260);
  const idx = users.findIndex((u) => u.id === input.id);
  if (idx >= 0) users[idx] = { ...input };
  else users = [...users, { ...input, id: `u_${Date.now()}`, createdAt: new Date().toISOString(), lastLoginAt: '' }];
  log(actor, input.role === 'PROJECT_OWNER' ? 'ROLE_GRANT' : 'USER_SAVE', input.email, `${input.name} · ${input.role}`);
  return clone(idx >= 0 ? users[idx] : users[users.length - 1]);
}

export async function toggleUserStatus(userId: string, actor: string): Promise<User> {
  await sleep(200);
  const user = users.find((u) => u.id === userId)!;
  user.status = user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED';
  log(actor, 'USER_STATUS', user.email, user.status, user.status === 'DISABLED' ? 'SUCCESS' : 'SUCCESS');
  return clone(user);
}

export async function updateProjectAccess(projectKey: string, access: Project['access'], actor: string): Promise<Project> {
  await sleep(300);
  const project = projects.find((p) => p.projectKey === projectKey || p.id === projectKey)!;
  project.access = access;
  project.updatedAt = new Date().toISOString();
  const names = access.groupIds.map((id) => groups.find((g) => g.id === id)?.name ?? id);
  log(actor, 'ACCESS_UPDATE', project.projectKey, `授权：${names.join('、') || '无组'} + ${access.userIds.length} 人`);
  return clone(project);
}

/* ------------------------------ 工单 §12.3 ------------------------------ */

export async function listTickets(projectIds?: string[]): Promise<Ticket[]> {
  await sleep();
  const list = projectIds?.length ? tickets.filter((t) => projectIds.includes(t.projectId)) : tickets;
  return clone(list);
}

/**
 * 同步 JIRA 状态：自动路径是 Bitbucket Webhook 回调（§9.3），此处为手动补偿入口。
 * 远端已前进的本地跟远端；否则模拟 JIRA 侧人工流转一步。
 */
export async function syncJiraStatus(projectId: string | undefined, actor: string): Promise<SyncResult> {
  await sleep(700);
  const scope = tickets.filter((t) => !projectId || t.projectId === projectId);
  const items: SyncResult['items'] = [];
  let skipped = 0;

  for (const t of scope) {
    const before = { stage: stageOf(t), jira: t.jiraStatus, fix: t.fix.status, uat: t.uat };
    if (t.jiraStatus !== t.jiraStatusRemote) {
      applyJiraStatus(t, t.jiraStatusRemote);
    } else {
      const idx = JIRA_STATUS_FLOW.indexOf(t.jiraStatus);
      const terminal = t.jiraStatus === 'Done' || t.jiraStatus === 'Rejected' || t.jiraStatus === 'Closed';
      const eligible = idx > 1 && idx < JIRA_STATUS_FLOW.length - 1 && !terminal;
      if (eligible && Math.random() > 0.45) {
        applyJiraStatus(t, JIRA_STATUS_FLOW[idx + 1]);
      } else if (t.jiraStatus === 'In Deploy' && t.uat === 'DEPLOYING' && !terminal) {
        t.uat = 'SUCCESS';
        t.fix.status = 'UAT_DEPLOYED';
        applyJiraStatus(t, 'Done');
      } else {
        skipped += 1;
      }
    }
    const afterStage = stageOf(t);
    if (afterStage !== before.stage || t.jiraStatus !== before.jira) {
      t.updatedAt = new Date().toISOString();
      t.drift = undefined;
      items.push({
        jiraKey: t.jiraKey,
        field: 'JIRA 状态',
        from: `${before.jira} → ${before.fix}`,
        to: `${t.jiraStatus} → ${t.fix.status}`,
      });
      t.fix.logs.push({ at: t.updatedAt, actor: 'jira-sync', message: `拉取 JIRA：${before.jira} → ${t.jiraStatus}` });
    } else {
      t.drift = undefined;
      skipped += 1;
    }
  }

  log(actor, 'SYNC_JIRA', projectId ? projects.find((p) => p.id === projectId)?.projectKey ?? '' : '全部项目', `${scope.length} 条比对，${items.length} 条变更`);
  return { at: new Date().toISOString(), checked: scope.length, changed: items.length, skipped, items };
}

function applyJiraStatus(t: Ticket, status: JiraStatus) {
  t.jiraStatus = status;
  t.jiraStatusRemote = status;
  t.fix.status = JIRA_TO_FIX[status];
  if (status === 'In Deploy' && t.uat === 'NONE') t.uat = 'PENDING';
  if (status === 'Done') t.uat = 'SUCCESS';
  if (status === 'In Review' && !t.fix.prUrl) {
    t.fix.prUrl = `https://bitbucket.company.com/projects/AI/repos/preview/pull-requests/new`;
    t.fix.prBranch = `fix/${t.jiraKey}-ai`;
  }
  if (status !== 'Done' && t.analysisReview === 'DONE') t.analysisReview = 'CONFIRMED';
}

/* --------------------------- 修复审批 §12.4 --------------------------- */

export async function approveFix(ticketId: string, actor: string): Promise<Ticket> {
  await sleep(320);
  const t = tickets.find((x) => x.id === ticketId)!;
  t.analysisReview = 'CONFIRMED';
  t.fix.status = 'APPROVED';
  t.fix.approvedById = users.find((u) => u.email === actor)?.id;
  applyJiraStatus(t, 'Fix Approved');
  t.fix.status = 'FIXING';
  t.updatedAt = new Date().toISOString();
  t.fix.logs.push({ at: t.updatedAt, actor, message: '批准修复，Fix Agent 已入队' });
  log(actor, 'FIX_APPROVE', t.jiraKey, '批准 AI 修复并触发流水线');
  return clone(t);
}

export async function rejectFix(ticketId: string, reason: string, actor: string): Promise<Ticket> {
  await sleep(320);
  const t = tickets.find((x) => x.id === ticketId)!;
  t.analysisReview = 'REJECTED';
  t.fix.status = 'PR_REJECTED';
  applyJiraStatus(t, 'Rejected');
  t.jiraStatusRemote = 'Rejected';
  t.updatedAt = new Date().toISOString();
  t.fix.logs.push({ at: t.updatedAt, actor, message: `拒绝：${reason}` });
  log(actor, 'FIX_REJECT', t.jiraKey, reason);
  return clone(t);
}

/* -------------------------------- Case -------------------------------- */

export async function listCases(): Promise<Case[]> {
  await sleep();
  const seen = new Set<string>();
  const list: Case[] = [];
  for (const t of tickets) {
    if (seen.has(t.caseKey)) continue;
    seen.add(t.caseKey);
    list.push(buildCase(t));
  }
  return clone(list);
}

export async function getCase(caseKey: string): Promise<Case | undefined> {
  await sleep(120);
  const t = tickets.find((x) => x.caseKey === caseKey);
  return t ? clone(buildCase(t)) : undefined;
}

/* ------------------------------ Dashboard ------------------------------ */

const WEEKS = ['08-29', '08-30', '08-31', '09-01', '09-02', '09-03', '09-04'];

export async function getDashboardOverview(projectIds?: string[]): Promise<DashboardOverview> {
  await sleep();
  const scope = projectIds?.length ? tickets.filter((t) => projectIds.includes(t.projectId)) : tickets;
  const diagnosed = scope.filter((t) => t.diagnosis === 'COMPLETED').length;
  const withPr = scope.filter((t) => t.fix.prUrl).length;
  const merged = scope.filter((t) => ['MERGED', 'UAT_DEPLOYED'].includes(t.fix.status)).length;
  const byStage = new Map<string, number>();
  scope.forEach((t) => byStage.set(stageOf(t), (byStage.get(stageOf(t)) ?? 0) + 1));

  const services = new Map<string, number>();
  scope.forEach((t) => services.set(t.service, (services.get(t.service) ?? 0) + 1));
  const max = Math.max(...services.values(), 1);

  return {
    weeklyCases: { value: scope.length, delta: 12 },
    diagnosisRate: { value: Math.round((diagnosed / Math.max(scope.length, 1)) * 100), delta: 4 },
    avgDuration: { value: 42, delta: -6 },
    autoFixRate: { value: Math.round((merged / Math.max(withPr, 1)) * 100), delta: 3 },
    trend: WEEKS.map((date, i) => ({
      date,
      case: Math.max(2, Math.round((scope.length / 7) * (0.6 + ((i * 37) % 10) / 8))),
      finding: Math.max(1, Math.round((scope.length / 9) * (0.7 + ((i * 53) % 10) / 9))),
      jira: Math.max(0, Math.round((scope.length / 12) * (0.8 + ((i * 71) % 10) / 10))),
    })),
    topServices: [...services.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name, count, percent: Math.round((count / max) * 100) })),
    stageDistribution: (['ANALYZING', 'DEVELOPING', 'VERIFYING', 'DEPLOYING', 'DONE', 'REJECTED'] as const).map(
      (stage) => ({ stage, count: byStage.get(stage) ?? 0 }),
    ),
  };
}

export async function listAuditLogs(): Promise<AuditLogItem[]> {
  await sleep(120);
  return clone(auditLogs);
}

export function projectName(projectId: string): string {
  return projects.find((p) => p.id === projectId)?.name ?? projectId;
}
