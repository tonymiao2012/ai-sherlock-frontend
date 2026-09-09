import type {
  AuditLogItem,
  Case,
  CaseStatus,
  CaseV2,
  DashboardOverview,
  DiagnosisRun,
  Finding,
  FindingResolutionType,
  FixAttempt,
  Group,
  GroupV2,
  JiraStatus,
  MergeBatch,
  Project,
  PullRequest,
  Repository,
  Role,
  SyncResult,
  Ticket,
  User,
  VerificationRecord,
} from '../types';
import { JIRA_STATUS_FLOW, stageOf } from '../domain/ticket';
import { canTransition } from '../domain/caseLifecycle';
import {
  AUDIT_LOGS, CASES_V2, GROUPS, GROUPS_V2, PROJECTS, TICKETS, USERS, buildCase,
} from './mockData';

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
const groupsV2 = clone(GROUPS_V2);
let casesV2 = clone(CASES_V2);
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
  if (owner && !owner.managedProjectIds?.includes(project.id)) owner.managedProjectIds = [...(owner.managedProjectIds ?? []), project.id];
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

export async function listGroupsV2(): Promise<GroupV2[]> {
  await sleep();
  return clone(groupsV2);
}

export async function listCasesV2(filter?: { groupId?: string; assigneeId?: string; status?: CaseStatus }): Promise<CaseV2[]> {
  await sleep();
  let result = clone(casesV2);
  if (filter?.groupId) result = result.filter(c => c.groupId === filter.groupId);
  if (filter?.assigneeId) result = result.filter(c => c.assigneeId === filter.assigneeId);
  if (filter?.status) result = result.filter(c => c.status === filter.status);
  return result;
}

export async function assignCase(caseId: string, assigneeId: string, actor: string): Promise<CaseV2> {
  await sleep();
  const caseItem = casesV2.find(c => c.id === caseId);
  if (!caseItem) throw new Error(`Case not found: ${caseId}`);
  caseItem.assigneeId = assigneeId;
  caseItem.updatedAt = new Date().toISOString();
  log(actor, 'CASE_ASSIGN', caseItem.caseKey, `分配给 ${assigneeId}`);
  return clone(caseItem);
}

export async function changeCaseStatus(
  caseId: string,
  newStatus: CaseStatus,
  actor: string
): Promise<CaseV2> {
  await sleep();
  const caseItem = casesV2.find(c => c.id === caseId);
  if (!caseItem) throw new Error(`Case not found: ${caseId}`);
  const oldStatus = caseItem.status;
  if (!canTransition(oldStatus, newStatus)) {
    throw new Error(`Invalid transition: ${oldStatus} → ${newStatus}`);
  }
  caseItem.status = newStatus;
  caseItem.updatedAt = new Date().toISOString();
  log(actor, 'CASE_STATUS_CHANGE', caseItem.caseKey, `${oldStatus} → ${newStatus}`);
  return clone(caseItem);
}

/* -------------------- CaseV2 详情 -------------------- */

export async function getCaseV2(caseId: string): Promise<CaseV2 | undefined> {
  await sleep(120);
  const c = casesV2.find((x) => x.id === caseId);
  return c ? clone(c) : undefined;
}

export async function updateCase(caseId: string, patch: Partial<CaseV2>, actor: string): Promise<CaseV2> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  Object.assign(c, patch, { updatedAt: new Date().toISOString() });
  log(actor, 'CASE_UPDATE', c.caseKey, Object.keys(patch).join('、'));
  return clone(c);
}

/* -------------------- 诊断 -------------------- */

export async function triggerDiagnosis(caseId: string, actor: string): Promise<DiagnosisRun> {
  await sleep(800);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const run: DiagnosisRun = {
    id: `dr_${Date.now()}`,
    caseId,
    caseCycleId: c.currentCycleId,
    mode: 'DIAGNOSE',
    status: 'COMPLETED',
    provider: 'DEVIN',
    providerSessionId: `sess_${Date.now()}`,
    caseRevisionId: c.currentRevision?.id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  c.diagnosisRuns.push(run);
  if (c.status === 'PENDING_ANALYSIS') {
    c.status = 'ANALYZING';
    // 模拟 AI 生成 2 个 Finding
    const now = new Date().toISOString();
    const findings: Finding[] = [
      {
        id: `f_${Date.now()}_1`,
        findingKey: `FND-${c.findings.length + 1}`,
        caseId,
        caseCycleId: c.currentCycleId,
        primaryApplicationId: caseId,
        type: 'FRONTEND',
        source: 'AI_RECOMMENDED',
        title: '文件上传组件缺少错误处理',
        analysisStatus: 'DRAFT',
        resolutionStatus: 'NOT_STARTED',
        isCurrent: true,
        currentRevisionId: `fr_${Date.now()}_1`,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
        currentRevision: {
          id: `fr_${Date.now()}_1`,
          findingId: `f_${Date.now()}_1`,
          caseCycleId: c.currentCycleId,
          revisionNo: 1,
          title: '文件上传组件缺少错误处理',
          rootCause: '上传接口未处理网络超时和文件过大异常',
          recommendation: '添加 try-catch 和文件大小校验',
          confidence: 0.92,
          status: 'CURRENT',
          createdAt: now,
        },
        revisions: [],
        comments: [],
        fixAttempts: [],
        pullRequests: [],
      },
      {
        id: `f_${Date.now()}_2`,
        findingKey: `FND-${c.findings.length + 2}`,
        caseId,
        caseCycleId: c.currentCycleId,
        primaryApplicationId: caseId,
        type: 'FRONTEND',
        source: 'AI_RECOMMENDED',
        title: 'Loading 状态未正确清除',
        analysisStatus: 'DRAFT',
        resolutionStatus: 'NOT_STARTED',
        isCurrent: true,
        currentRevisionId: `fr_${Date.now()}_2`,
        createdBy: 'system',
        createdAt: now,
        updatedAt: now,
        currentRevision: {
          id: `fr_${Date.now()}_2`,
          findingId: `f_${Date.now()}_2`,
          caseCycleId: c.currentCycleId,
          revisionNo: 1,
          title: 'Loading 状态未正确清除',
          rootCause: '异步操作完成后未重置 loading 状态',
          recommendation: '在 finally 块中设置 setLoading(false)',
          confidence: 0.88,
          status: 'CURRENT',
          createdAt: now,
        },
        revisions: [],
        comments: [],
        fixAttempts: [],
        pullRequests: [],
      },
    ];
    findings.forEach((f) => {
      f.revisions = [f.currentRevision];
      c.findings.push(f);
    });
    c.status = 'ANALYSIS_COMPLETED';
  }
  c.updatedAt = new Date().toISOString();
  log(actor, 'DIAGNOSIS_TRIGGER', c.caseKey, `mode=DIAGNOSE → ${run.status}, 生成 ${c.findings.length} 个 Finding`);
  return clone(run);
}

export async function listDiagnosisRuns(caseId: string): Promise<DiagnosisRun[]> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  return clone(c?.diagnosisRuns ?? []);
}

/* -------------------- Finding -------------------- */

export async function listFindings(caseId: string): Promise<Finding[]> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  return clone(c?.findings ?? []);
}

export async function createManualFinding(
  caseId: string,
  input: { title: string; type: Finding['type']; rootCause: string; recommendation: string },
  actor: string,
): Promise<Finding> {
  await sleep(300);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const now = new Date().toISOString();
  const revId = `fr_${Date.now()}`;
  const finding: Finding = {
    id: `f_${Date.now()}`,
    findingKey: `FND-${c.findings.length + 1}`,
    caseId,
    caseCycleId: c.currentCycleId,
    primaryApplicationId: caseId,
    type: input.type,
    source: 'MANUAL',
    title: input.title,
    analysisStatus: 'DRAFT',
    resolutionStatus: 'NOT_STARTED',
    isCurrent: true,
    currentRevisionId: revId,
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
    currentRevision: {
      id: revId, findingId: `f_${Date.now()}`, caseCycleId: c.currentCycleId,
      revisionNo: 1, title: input.title, rootCause: input.rootCause,
      recommendation: input.recommendation, confidence: 1.0,
      status: 'CURRENT', createdAt: now,
    },
    revisions: [],
    comments: [],
    fixAttempts: [],
    pullRequests: [],
  };
  finding.revisions = [finding.currentRevision];
  c.findings.push(finding);
  c.updatedAt = now;
  log(actor, 'FINDING_CREATE', c.caseKey, `人工 Finding: ${input.title}`);
  return clone(finding);
}

export async function acceptFinding(caseId: string, findingId: string, actor: string): Promise<Finding> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  f.analysisStatus = 'ACCEPTED';
  f.updatedAt = new Date().toISOString();
  c.updatedAt = f.updatedAt;
  log(actor, 'FINDING_ACCEPT', c.caseKey, f.findingKey);
  return clone(f);
}

export async function addFindingComment(
  caseId: string, findingId: string, content: string, actor: string,
): Promise<void> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  f.comments.push({
    id: `fc_${Date.now()}`, findingId, caseCycleId: c.currentCycleId,
    authorType: 'USER', authorUserId: actor, content,
    createdAt: new Date().toISOString(),
  });
}

export async function reDiagnoseFinding(caseId: string, findingId: string, actor: string): Promise<DiagnosisRun> {
  await sleep(800);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  const run: DiagnosisRun = {
    id: `dr_${Date.now()}`, caseId, caseCycleId: c.currentCycleId,
    mode: 'DIAGNOSE', status: 'COMPLETED', provider: 'DEVIN',
    providerSessionId: `sess_${Date.now()}`,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  c.diagnosisRuns.push(run);
  log(actor, 'FINDING_REDIAGNOSE', c.caseKey, f.findingKey);
  return clone(run);
}

export async function resolveFinding(
  caseId: string, findingId: string,
  resolutionType: FindingResolutionType, actor: string,
): Promise<Finding> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  if (f.analysisStatus !== 'ACCEPTED') f.analysisStatus = 'ACCEPTED';
  f.resolutionType = resolutionType;
  if (resolutionType === 'IGNORE') f.resolutionStatus = 'COMPLETED';
  f.updatedAt = new Date().toISOString();
  c.updatedAt = f.updatedAt;
  log(actor, 'FINDING_RESOLVE', c.caseKey, `${f.findingKey} → ${resolutionType}`);
  return clone(f);
}

/* -------------------- Auto Fix -------------------- */

export async function triggerAutoFix(caseId: string, findingId: string, actor: string): Promise<void> {
  await sleep(1200);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  f.resolutionType = 'AUTO_FIX';
  f.resolutionStatus = 'IN_PROGRESS';
  f.fixAttempts.push({
    id: `fa_${Date.now()}`, caseId, caseCycleId: c.currentCycleId,
    primaryFindingId: findingId, attemptNo: f.fixAttempts.length + 1,
    provider: 'DEVIN', providerSessionId: `fix_${Date.now()}`,
    approvalPolicy: 'MANUAL', approvalStatus: 'APPROVED',
    approvedBy: actor, executionStatus: 'PR_CREATED',
    idempotencyKey: `idem_${Date.now()}`,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  });
  f.updatedAt = new Date().toISOString();
  c.updatedAt = f.updatedAt;
  log(actor, 'AUTOFIX_TRIGGER', c.caseKey, f.findingKey);
}

export async function listFixAttempts(caseId: string, findingId: string): Promise<FixAttempt[]> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) return [];
  const all = c.findings.flatMap((f) => f.fixAttempts);
  return clone(findingId ? all.filter((a) => a.primaryFindingId === findingId) : all);
}

/* -------------------- PR -------------------- */

export async function registerManualPullRequest(
  caseId: string, findingId: string,
  input: { url: string; sourceBranch: string; targetBranch: string },
  actor: string,
): Promise<PullRequest> {
  await sleep(300);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const f = c.findings.find((x) => x.id === findingId);
  if (!f) throw new Error(`Finding not found: ${findingId}`);
  const pr: PullRequest = {
    id: `pr_${Date.now()}`, provider: 'BITBUCKET', repositoryId: '',
    externalId: String(Date.now()), number: Math.floor(Math.random() * 9000) + 1000,
    url: input.url, sourceBranch: input.sourceBranch, targetBranch: input.targetBranch,
    headSha: `sha_${Date.now()}`, state: 'OPEN', draft: false,
    mergeableState: 'CLEAN', checksStatus: 'PENDING', reviewStatus: 'PENDING',
    branchProtectionStatus: 'UNKNOWN', originType: 'MANUAL',
    lastSyncedAt: new Date().toISOString(),
  };
  c.pullRequests.push(pr);
  f.pullRequests.push({
    id: `fpr_${Date.now()}`, caseCycleId: c.currentCycleId,
    findingId, pullRequestId: pr.id, relationType: 'PRIMARY',
    source: 'MANUAL', isCurrent: true, linkedBy: actor,
    createdAt: new Date().toISOString(), pullRequest: pr,
  });
  if (f.resolutionStatus === 'NOT_STARTED') f.resolutionStatus = 'IN_PROGRESS';
  f.updatedAt = new Date().toISOString();
  c.updatedAt = f.updatedAt;
  log(actor, 'PR_REGISTER', c.caseKey, `Manual PR #${pr.number}`);
  return clone(pr);
}

export async function confirmPullRequestFindings(
  caseId: string, prId: string, findingIds: string[], actor: string,
): Promise<void> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  log(actor, 'PR_CONFIRM', c.caseKey, `PR ${prId} → ${findingIds.length} findings`);
}

/* -------------------- Merge -------------------- */

export async function createMergeBatch(caseId: string, actor: string): Promise<MergeBatch> {
  await sleep(600);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const batch: MergeBatch = {
    id: `mb_${Date.now()}`, caseId, caseCycleId: c.currentCycleId,
    requestedBy: actor, status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    pullRequestResults: c.pullRequests
      .filter((pr) => pr.state === 'OPEN')
      .map((pr) => ({ pullRequestId: pr.id, status: 'MERGED' as const })),
  };
  c.mergeBatches.push(batch);
  batch.pullRequestResults.forEach((r) => {
    const pr = c.pullRequests.find((p) => p.id === r.pullRequestId);
    if (pr) { pr.state = 'MERGED'; pr.mergedAt = new Date().toISOString(); }
  });
  if (c.status === 'DEVELOPING') c.status = 'DEPLOYING';
  c.updatedAt = new Date().toISOString();
  log(actor, 'MERGE_BATCH', c.caseKey, `${batch.pullRequestResults.length} PRs`);
  return clone(batch);
}

export async function getMergeBatch(caseId: string, batchId: string): Promise<MergeBatch | undefined> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  return clone(c?.mergeBatches.find((b) => b.id === batchId));
}

/* -------------------- 部署 & 验证 -------------------- */

export async function retryDeployment(caseId: string, actor: string): Promise<void> {
  await sleep(1000);
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  c.deploymentRuns
    .filter((r) => r.status === 'FAILED')
    .forEach((r) => { r.status = 'SUCCEEDED'; r.finishedAt = new Date().toISOString(); });
  if (c.status === 'DEPLOY_FAILED') c.status = 'DEPLOYING';
  c.updatedAt = new Date().toISOString();
  log(actor, 'DEPLOY_RETRY', c.caseKey, '重试失败部署');
}

export async function completeUat(caseId: string, actor: string): Promise<CaseV2> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  if (c.status === 'DEPLOYING') c.status = 'DEPLOYED';
  c.updatedAt = new Date().toISOString();
  log(actor, 'UAT_COMPLETE', c.caseKey, 'UAT 部署完成');
  return clone(c);
}

export async function submitVerification(
  caseId: string, result: 'PASSED' | 'FAILED', comment: string, actor: string,
): Promise<CaseV2> {
  await sleep();
  const c = casesV2.find((x) => x.id === caseId);
  if (!c) throw new Error(`Case not found: ${caseId}`);
  const record: VerificationRecord = {
    id: `vr_${Date.now()}`, caseId, caseCycleId: c.currentCycleId,
    result, comment, verifiedBy: actor, createdAt: new Date().toISOString(),
  };
  c.verificationRecords.push(record);
  if (result === 'PASSED') {
    c.status = 'COMPLETED';
  } else {
    c.status = 'PENDING_ANALYSIS';
  }
  c.updatedAt = new Date().toISOString();
  log(actor, 'VERIFY', c.caseKey, `${result}${comment ? `: ${comment}` : ''}`);
  return clone(c);
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
  const scope = projectIds?.length ? casesV2.filter((c) => projectIds.includes(c.projectId)) : casesV2;

  const statusCounts = new Map<CaseStatus, number>();
  scope.forEach((c) => statusCounts.set(c.status, (statusCounts.get(c.status) ?? 0) + 1));

  const services = new Map<string, number>();
  scope.forEach((c) => services.set(c.projectId, (services.get(c.projectId) ?? 0) + 1));
  const max = Math.max(...services.values(), 1);

  const totalFindings = scope.reduce((sum, c) => sum + c.findings.length, 0);
  const acceptedFindings = scope.reduce((sum, c) => sum + c.findings.filter((f) => f.analysisStatus === 'ACCEPTED').length, 0);
  const withPr = scope.reduce((sum, c) => sum + c.pullRequests.length, 0);
  const mergedPr = scope.reduce((sum, c) => sum + c.pullRequests.filter((pr) => pr.state === 'MERGED').length, 0);

  return {
    weeklyCases: { value: scope.length, delta: 12 },
    diagnosisRate: { value: Math.round((acceptedFindings / Math.max(totalFindings, 1)) * 100), delta: 4 },
    avgDuration: { value: 42, delta: -6 },
    autoFixRate: { value: Math.round((mergedPr / Math.max(withPr, 1)) * 100), delta: 3 },
    pendingAnalysis: statusCounts.get('PENDING_ANALYSIS') ?? 0,
    pendingVerification: statusCounts.get('PENDING_VERIFICATION') ?? 0,
    deployFailed: statusCounts.get('DEPLOY_FAILED') ?? 0,
    trend: WEEKS.map((date, i) => ({
      date,
      case: Math.max(2, Math.round((scope.length / 7) * (0.6 + ((i * 37) % 10) / 8))),
      finding: Math.max(1, Math.round((totalFindings / 7) * (0.7 + ((i * 53) % 10) / 9))),
      pr: Math.max(0, Math.round((withPr / 7) * (0.8 + ((i * 71) % 10) / 10))),
      deployment: Math.max(0, Math.round((scope.length / 14) * (0.5 + ((i * 23) % 10) / 8))),
    })),
    topServices: [...services.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({ name: projectName(name), count, percent: Math.round((count / max) * 100) })),
    statusDistribution: (['PENDING_ANALYSIS', 'ANALYZING', 'ANALYSIS_COMPLETED', 'DEVELOPING', 'DEPLOYING', 'DEPLOY_FAILED', 'DEPLOYED', 'PENDING_VERIFICATION', 'COMPLETED'] as const).map(
      (status) => ({ status, count: statusCounts.get(status) ?? 0 }),
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
