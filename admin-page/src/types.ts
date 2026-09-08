/** 域模型与 PRD（docs/middle-platform-prd.html）§2 / §11 表结构对齐 */

/** @deprecated Use NewRole instead */
export type Role = 'ADMIN' | 'PROJECT_OWNER' | 'DEVELOPER';

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
  managedProjectIds: string[];
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
  findings: Finding[];
}

/** Case 生命周期状态（docs/backend-admin-requirements.md §6） */
export type CaseStatus =
  | 'PENDING'      // 未开始
  | 'ANALYZING'    // 分析中
  | 'ANALYZED'     // 分析完成
  | 'DEVELOPING'   // 开发中
  | 'DEPLOYING'    // 部署中
  | 'DEPLOYED'     // 部署完成
  | 'VERIFYING'    // 验证中
  | 'VERIFIED'     // 验证通过
  | 'FAILED';      // 验证失败

/** 新 Case 模型（docs/backend-admin-requirements.md §6） */
export interface CaseV2 {
  id: string;
  caseKey: string;
  projectId: string;
  groupId: string;
  title: string;
  description: string;
  status: CaseStatus;
  assigneeId?: string;
  environment: Environment;
  severity: Severity;
  pageUrl: string;
  buildVersion: string;
  reporter: string;
  reportedAt: string;
  updatedAt: string;
  network: Evidence[];
  consoleLogs: Evidence[];
  stacks: Evidence[];
  evidenceChain: { node: string; label: string }[];
  findings: Finding[];
}

/** §7.3 Finding */
export interface Finding {
  id: string;
  findingKey: string;
  type: FindingType;
  title: string;
  rootCause: string;
  aiConfidence: number;
  systemConfidence: number;
  verificationStatus: 'VERIFIED' | 'AI_SUGGESTED' | 'INVALID_REFERENCE';
  locations: { file: string; line: number }[];
  recommendedFix: string;
  evidenceIds: string[];
  jiraKey?: string;
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
  trend: { date: string; case: number; finding: number; jira: number }[];
  topServices: { name: string; count: number; percent: number }[];
  stageDistribution: { stage: Stage; count: number }[];
}

/** 配置校验（PRD §5.2）逐项结果 */
export interface ValidationItem {
  target: string;
  ok: boolean;
  detail: string;
}
