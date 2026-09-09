/** 域模型与 PRD（docs/middle-platform-prd.html）§2 / §11 表结构对齐 */

/** @deprecated Use NewRole instead */
export type Role = 'ADMIN' | 'PROJECT_OWNER' | 'DEVELOPER' | 'OWNER' | 'STAFF';

/** 新角色模型（docs/backend-admin-requirements.md §2） */
export type NewRole = 'ADMIN' | 'OWNER' | 'STAFF';
export type StaffType = 'DEV' | 'TESTER';

/** §11.1 auth_provider */
export type AuthProvider = 'GOOGLE' | 'SSO' | 'PASSWORD';

export type UserStatus = 'ACTIVE' | 'PENDING' | 'DISABLED';

/** @deprecated Use UserV2 instead */
export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  authProvider: AuthProvider;
  groupIds: string[];
  status: UserStatus;
  /** Owner 可管理的项目（project.id）；ADMIN 隐式为全部 */
  managedProjectIds?: string[];
  staffType?: StaffType;
  lastLoginAt: string;
  createdAt: string;
}

/** 新用户模型（docs/backend-admin-requirements.md §2） */
export interface UserV2 {
  id: string;
  email: string;
  name: string;
  role: NewRole;
  staffType?: StaffType; // only for STAFF
  authProvider: AuthProvider;
  groupIds: string[];
  status: UserStatus;
  lastLoginAt: string;
  createdAt: string;
}

/** 组织（docs/backend-admin-requirements.md §1） */
export interface Organization {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

/** @deprecated Use GroupV2 instead */
/** §11.1 group：项目可见性的授权单位 */
export interface Group {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  autoSync: 'JIRA_ROLE' | 'LDAP' | 'MANUAL';
}

/** 新 Group 模型（docs/backend-admin-requirements.md §1） */
export interface GroupV2 {
  id: string;
  name: string;
  description: string;
  organizationId: string;
  ownerId: string;
  memberIds: string[];
  projectIds: string[];
  createdAt: string;
}

export interface ProjectAccess {
  groupIds: string[];
  userIds: string[];
}

/** §5.1 项目配置项 */
export interface Project {
  id: string;
  projectKey: string;
  name: string;
  description: string;
  ownerId: string;
  access: ProjectAccess;
  status: 'ACTIVE' | 'ARCHIVED';
  repos: Repository[];
  urlMappings: UrlMapping[];
  logging: LogBinding;
  jira: JiraBinding;
  uat: UatBinding;
  capability: CapabilityProfile;
  createdAt: string;
  updatedAt: string;
}

/** §11.5 project_repository */
export interface Repository {
  id: string;
  repoType: 'FRONTEND' | 'BACKEND';
  provider: 'BITBUCKET' | 'GITHUB';
  repoProject: string;
  repoSlug: string;
  defaultBranch: string;
  /** Ant 风格 URL 匹配，仅后端服务仓库使用 */
  urlPatterns: string[];
  /** 微前端子应用标识（Qiankun） */
  subAppKey?: string;
  verifyState: 'VERIFIED' | 'PENDING' | 'FAILED';
  lastCommit?: string;
  latestTag?: string;
}

export interface UrlMapping {
  id: string;
  pattern: string;
  service: string;
  repoId?: string;
}

/** §5.2 日志（Kibana / Elastic）绑定 */
export interface LogBinding {
  provider: 'ELASTIC' | 'KIBANA';
  baseUrl: string;
  indexPattern: string;
  /** Build Version → Git Commit 的解析方式 */
  versionMapping: 'TAG' | 'COMMIT_HASH' | 'CI_BUILD_NUMBER';
  fieldMap: {
    timestamp: string;
    level: string;
    traceId: string;
    message: string;
    stackTrace: string;
    service: string;
  };
  verifyState: 'VERIFIED' | 'PENDING' | 'FAILED';
  docCount7d?: number;
}

export interface JiraBinding {
  site: string;
  projectKey: string;
  issueType: string;
  /** 一键生成 JIRA 描述模板 */
  descriptionTemplate: string;
  autoCreate: boolean;
}

export interface UatBinding {
  pipelineId: string;
  deployMethod: 'WEBHOOK_DIRECT' | 'API_TRIGGER';
  enabled: boolean;
}

export interface CapabilityProfile {
  aiDiagnosis: boolean;
  sourceAnalysis: boolean;
  autoFix: boolean;
  /** §8.2 修复审批模式 */
  approvalMode: 'AUTO' | 'REVIEW_REQUIRED' | 'DISABLED';
}

/** 中台派生的流水线阶段（由 JIRA status + fix_pipeline.status 归并） */
export type Stage = 'ANALYZING' | 'DEVELOPING' | 'VERIFYING' | 'DEPLOYING' | 'REJECTED' | 'DONE';

/** §6.2 LLM 分析状态 */
export type DiagnosisStatus = 'NOT_STARTED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

/** §6.2A 分析状态（含人工确认口径） */
export type AnalysisReview = 'NONE' | 'RUNNING' | 'DONE' | 'CONFIRMED' | 'REJECTED';

/** §11.4 fix_pipeline.status */
export type FixPipelineStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'FIXING'
  | 'FIX_FAILED'
  | 'PR_CREATED'
  | 'PR_APPROVED'
  | 'PR_REJECTED'
  | 'MERGED'
  | 'UAT_DEPLOYED'
  | 'DEPLOY_FAILED';

export type UatStatus = 'NONE' | 'PENDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED';

/** §7.4 JIRA 工作流状态 */
export type JiraStatus =
  | 'Open'
  | 'Analysis Ready'
  | 'Fix Approved'
  | 'In Review'
  | 'Ready to Merge'
  | 'In Deploy'
  | 'Done'
  | 'Rejected'
  | 'Closed';

export type FindingType = 'FRONTEND' | 'BACKEND' | 'INTEGRATION';
export type Severity = 'Critical' | 'Major' | 'Minor';
export type Environment = 'PROD' | 'UAT' | 'STAGE' | 'DEV';

/** §6.2 工单列表行 */
export interface Ticket {
  id: string;
  projectId: string;
  jiraKey: string;
  jiraUrl: string;
  title: string;
  jiraStatus: JiraStatus;
  /** JIRA 真实状态（同步后与 jiraStatus 一致） */
  jiraStatusRemote: JiraStatus;
  findingType: FindingType;
  severity: Severity;
  environment: Environment;
  assigneeId: string;
  defaultAssigneeId: string;
  diagnosis: DiagnosisStatus;
  analysisReview: AnalysisReview;
  fix: FixState;
  uat: UatStatus;
  caseKey: string;
  findingKey: string;
  service: string;
  createdAt: string;
  updatedAt: string;
  /** 与 JIRA 远端比对后本地落后的字段，用于列表高亮 */
  drift?: string;
}

export interface FixState {
  status: FixPipelineStatus;
  prUrl?: string;
  prBranch?: string;
  approvedById?: string;
  logs: FixLogItem[];
}

export interface FixLogItem {
  at: string;
  actor: string;
  message: string;
}

export interface Evidence {
  id: string;
  kind: 'NETWORK' | 'CONSOLE' | 'STACK' | 'SCREENSHOT' | 'LOG';
  label: string;
  detail: string;
  ref?: string;
}

/** @deprecated Legacy finding shape for old Case model; new code uses Finding */
export interface LegacyFinding {
  id: string;
  findingKey: string;
  type: FindingType;
  title: string;
  rootCause: string;
  aiConfidence: number;
  systemConfidence: number;
  verificationStatus: 'AI_SUGGESTED' | 'VERIFIED';
  locations: { file: string; line: number }[];
  recommendedFix: string;
  evidenceIds: string[];
  jiraKey: string;
}

/** §13.3 Case 详情 */
/** @deprecated Use CaseV2 instead */
export interface Case {
  id: string;
  caseKey: string;
  projectId: string;
  title: string;
  environment: Environment;
  severity: Severity;
  pageUrl: string;
  buildVersion: string;
  reporter: string;
  reportedAt: string;
  status: 'RECEIVED' | 'PARSING' | 'ENRICHING' | 'ANALYZING' | 'DIAGNOSED' | 'JIRA' | 'DONE' | 'FAILED';
  description: string;
  network: Evidence[];
  consoleLogs: Evidence[];
  stacks: Evidence[];
  evidenceChain: { node: string; label: string }[];
  findings: LegacyFinding[];
}

/** Case 生命周期状态（docs/case-lifecycle-architecture-design.md §5） */
export type CaseStatus =
  | 'PENDING_ANALYSIS'     // 待开始
  | 'ANALYZING'            // 分析中
  | 'ANALYSIS_COMPLETED'   // 分析结束
  | 'DEVELOPING'           // 开发中
  | 'DEPLOYING'            // 部署中
  | 'DEPLOY_FAILED'        // 部署失败
  | 'DEPLOYED'             // 部署完成
  | 'PENDING_VERIFICATION' // 待验证
  | 'COMPLETED';           // 验证通过/已完成

/** Case 聚合模型（docs/case-lifecycle-architecture-design.md §4） */
export interface CaseV2 {
  id: string;
  caseKey: string;
  projectId: string;
  groupId: string;
  title: string;
  description: string;
  status: CaseStatus;
  currentCycleId: string;
  assigneeId?: string;
  environment: Environment;
  severity: Severity;
  pageUrl: string;
  buildVersion: string;
  reporter: string;
  reportedAt: string;
  updatedAt: string;
  version: number;
  currentCycle: CaseCycle;
  cycles: CaseCycle[];
  currentRevision: CaseRevision;
  revisions: CaseRevision[];
  findings: Finding[];
  pullRequests: PullRequest[];
  deploymentRuns: DeploymentRun[];
  verificationRecords: VerificationRecord[];
  mergeBatches: MergeBatch[];
  diagnosisRuns: DiagnosisRun[];
  network: Evidence[];
  consoleLogs: Evidence[];
  stacks: Evidence[];
  evidenceChain: { node: string; label: string }[];
}

/** Finding 分析状态（§4.4） */
export type FindingAnalysisStatus = 'DRAFT' | 'ACCEPTED';

/** Finding 处理方式（§4.4） */
export type FindingResolutionType = 'MANUAL_FIX' | 'AUTO_FIX' | 'IGNORE';

/** Finding 处理进展（§4.4） */
export type FindingResolutionStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'READY_TO_MERGE'
  | 'COMPLETED'
  | 'FAILED';

/** Finding 来源 */
export type FindingSource = 'DEVIN' | 'MANUAL' | 'AI_RECOMMENDED';

/** §4.4 Finding — 三态：analysisStatus / resolutionType / resolutionStatus */
export interface Finding {
  id: string;
  findingKey: string;
  caseId: string;
  caseCycleId: string;
  carriedFromFindingId?: string;
  primaryApplicationId: string;
  primaryRepositoryId?: string;
  type: FindingType;
  source: FindingSource;
  title: string;
  analysisStatus: FindingAnalysisStatus;
  resolutionType?: FindingResolutionType;
  resolutionStatus: FindingResolutionStatus;
  isCurrent: boolean;
  currentRevisionId: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  currentRevision: FindingRevision;
  revisions: FindingRevision[];
  comments: FindingComment[];
  fixAttempts: FixAttempt[];
  pullRequests: FindingPullRequest[];
}

/** §4.2 Case Cycle — 一次从分析到验证的完整处理轮次 */
export interface CaseCycle {
  id: string;
  caseId: string;
  cycleNo: number;
  status: 'ACTIVE' | 'CLOSED';
  openedReason?: string;
  openedBy?: string;
  openedAt: string;
  closedAt?: string;
}

/** §4.3 Case Revision — Case 标题/描述的版本历史 */
export interface CaseRevision {
  id: string;
  caseId: string;
  caseCycleId: string;
  revisionNo: number;
  title: string;
  description: string;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

/** §4.5 Finding Revision — Finding 诊断的不可变版本 */
export interface FindingRevision {
  id: string;
  findingId: string;
  caseCycleId: string;
  revisionNo: number;
  diagnosisRunId?: string;
  title: string;
  rootCause: string;
  recommendation: string;
  confidence: number;
  payload?: unknown;
  status: 'CURRENT' | 'SUPERSEDED';
  createdAt: string;
}

/** §4.5 Finding Comment — 用户与 Devin 的对话消息 */
export interface FindingComment {
  id: string;
  findingId: string;
  caseCycleId: string;
  authorType: 'USER' | 'DEVIN' | 'SYSTEM';
  authorUserId?: string;
  content: string;
  diagnosisRunId?: string;
  createdAt: string;
}

/** §4.6 Diagnosis Run — 诊断或 Auto Fix 执行记录 */
export interface DiagnosisRun {
  id: string;
  caseId: string;
  caseCycleId: string;
  mode: 'DIAGNOSE' | 'IMPLEMENT_CHANGE';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  caseRevisionId?: string;
  provider: string;
  providerSessionId?: string;
  result?: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** §4.7 Fix Attempt — 一次具体修复尝试 */
export interface FixAttempt {
  id: string;
  caseId: string;
  caseCycleId: string;
  primaryFindingId: string;
  diagnosisRunId?: string;
  attemptNo: number;
  provider: string;
  providerSessionId?: string;
  instructions?: string;
  approvalPolicy: 'MANUAL';
  approvalStatus: 'APPROVED';
  approvedBy?: string;
  executionStatus:
    | 'QUEUED'
    | 'IMPLEMENTING'
    | 'PR_CREATED'
    | 'NO_CHANGE'
    | 'FAILED'
    | 'TIMED_OUT'
    | 'NEEDS_ATTENTION';
  idempotencyKey: string;
  result?: unknown;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** §4.8 Pull Request — GitHub PR 主数据 */
export interface PullRequest {
  id: string;
  provider: string;
  repositoryId: string;
  externalId: string;
  number: number;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  headSha: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED';
  draft: boolean;
  mergeableState: string;
  checksStatus: 'PENDING' | 'PASSING' | 'FAILING';
  reviewStatus: 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
  branchProtectionStatus: 'SATISFIED' | 'NOT_SATISFIED' | 'UNKNOWN';
  originType: 'DEVIN' | 'MANUAL';
  originFixAttemptId?: string;
  mergedSha?: string;
  mergedAt?: string;
  lastSyncedAt?: string;
}

/** §4.8 Finding-PullRequest 关联 */
export interface FindingPullRequest {
  id: string;
  caseCycleId: string;
  findingId: string;
  pullRequestId: string;
  relationType: 'PRIMARY' | 'INCLUDED';
  source: 'DEVIN' | 'MANUAL' | 'USER_CONFIRMED';
  findingRevisionId?: string;
  isCurrent: boolean;
  linkedBy?: string;
  createdAt: string;
  pullRequest: PullRequest;
}

/** §4.9 Deployment Run — 每个仓库独立的部署执行 */
export interface DeploymentRun {
  id: string;
  caseId: string;
  caseCycleId: string;
  repositoryId: string;
  environment: Environment;
  workflowName?: string;
  externalRunId?: string;
  commitSha?: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  attemptNo: number;
  url?: string;
  startedAt?: string;
  finishedAt?: string;
}

/** §5 验证记录 — Tester 验证通过/失败 */
export interface VerificationRecord {
  id: string;
  caseId: string;
  caseCycleId: string;
  result: 'PASSED' | 'FAILED';
  comment?: string;
  verifiedBy: string;
  createdAt: string;
}

/** §5.4 Merge Batch — 非原子合并批次 */
export interface MergeBatch {
  id: string;
  caseId: string;
  caseCycleId: string;
  requestedBy: string;
  status: 'REQUESTED' | 'QUEUING' | 'PARTIAL' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  pullRequestResults: {
    pullRequestId: string;
    status: 'QUEUED' | 'MERGED' | 'FAILED';
    reason?: string;
  }[];
}

export interface AuditLogItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
}

export interface SyncResult {
  at: string;
  checked: number;
  changed: number;
  skipped: number;
  items: { jiraKey: string; field: string; from: string; to: string }[];
}

export interface DashboardOverview {
  weeklyCases: { value: number; delta: number };
  diagnosisRate: { value: number; delta: number };
  avgDuration: { value: number; delta: number };
  autoFixRate: { value: number; delta: number };
  pendingAnalysis: number;
  pendingVerification: number;
  deployFailed: number;
  trend: { date: string; case: number; finding: number; pr: number; deployment: number }[];
  topServices: { name: string; count: number; percent: number }[];
  statusDistribution: { status: CaseStatus; count: number }[];
}

/** 配置校验（PRD §5.2）逐项结果 */
export interface ValidationItem {
  target: string;
  ok: boolean;
  detail: string;
}
