import type {
  AuditLogItem,
  Case,
  CaseV2,
  Finding,
  FindingType,
  Group,
  GroupV2,
  JiraStatus,
  Project,
  Severity,
  Stage,
  Ticket,
  User,
  Environment,
  FixPipelineStatus,
  UatStatus,
  DiagnosisStatus,
  AnalysisReview,
} from '../types';

const DAY = 86400000;
const now = new Date('2026-09-04T09:30:00+08:00').getTime();

const iso = (daysAgo: number, hours = 0) => new Date(now - daysAgo * DAY - hours * 3600000).toISOString();

export const USERS: User[] = [
  {
    id: 'u_admin',
    email: 'admin@company.com',
    name: '王敏',
    role: 'ADMIN',
    authProvider: 'GOOGLE',
    groupIds: ['g_sre'],
    status: 'ACTIVE',
    managedProjectIds: [],
    lastLoginAt: iso(0, 2),
    createdAt: iso(210),
  },
  {
    id: 'u_zhang',
    email: 'zhangsan@company.com',
    name: '张三',
    role: 'OWNER',
    authProvider: 'GOOGLE',
    groupIds: ['g_fe', 'g_acct'],
    status: 'ACTIVE',
    managedProjectIds: ['p_acct'],
    lastLoginAt: iso(0, 5),
    createdAt: iso(180),
  },
  {
    id: 'u_li',
    email: 'lisi@company.com',
    name: '李四',
    role: 'OWNER',
    authProvider: 'GOOGLE',
    groupIds: ['g_pay'],
    status: 'ACTIVE',
    managedProjectIds: ['p_pay'],
    lastLoginAt: iso(1, 3),
    createdAt: iso(165),
  },
  {
    id: 'u_zhao',
    email: 'zhaowu@company.com',
    name: '王五',
    role: 'OWNER',
    authProvider: 'SSO',
    groupIds: ['g_cs'],
    status: 'ACTIVE',
    managedProjectIds: ['p_cs'],
    lastLoginAt: iso(2),
    createdAt: iso(120),
  },
  {
    id: 'u_qian',
    email: 'qianqi@company.com',
    name: '钱七',
    role: 'STAFF',
    staffType: 'DEV',
    authProvider: 'GOOGLE',
    groupIds: ['g_fe'],
    status: 'ACTIVE',
    managedProjectIds: [],
    lastLoginAt: iso(0, 9),
    createdAt: iso(150),
  },
  {
    id: 'u_sun',
    email: 'sunba@company.com',
    name: '孙八',
    role: 'STAFF',
    staffType: 'DEV',
    authProvider: 'GOOGLE',
    groupIds: ['g_acct'],
    status: 'ACTIVE',
    managedProjectIds: [],
    lastLoginAt: iso(3),
    createdAt: iso(140),
  },
  {
    id: 'u_zhou',
    email: 'zhoujiu@company.com',
    name: '周九',
    role: 'STAFF',
    staffType: 'DEV',
    authProvider: 'PASSWORD',
    groupIds: ['g_pay'],
    status: 'ACTIVE',
    managedProjectIds: [],
    lastLoginAt: iso(1, 6),
    createdAt: iso(96),
  },
  {
    id: 'u_wu',
    email: 'wushi@company.com',
    name: '吴十',
    role: 'STAFF',
    staffType: 'TESTER',
    authProvider: 'GOOGLE',
    groupIds: ['g_cs', 'g_qa'],
    status: 'ACTIVE',
    managedProjectIds: [],
    lastLoginAt: iso(6),
    createdAt: iso(70),
  },
  {
    id: 'u_pending',
    email: 'chene@company.com',
    name: '陈二',
    role: 'STAFF',
    staffType: 'DEV',
    authProvider: 'GOOGLE',
    groupIds: [],
    status: 'PENDING',
    managedProjectIds: [],
    lastLoginAt: '',
    createdAt: iso(4),
  },
];

export const GROUPS: Group[] = [
  { id: 'g_fe', name: '前端平台组', description: 'Web 容器与全部微前端子应用', memberCount: 8, autoSync: 'JIRA_ROLE' },
  { id: 'g_acct', name: '账户服务组', description: 'account-ms / customer-adapter', memberCount: 6, autoSync: 'JIRA_ROLE' },
  { id: 'g_pay', name: '支付服务组', description: 'payment-ms、渠道网关', memberCount: 7, autoSync: 'LDAP' },
  { id: 'g_cs', name: '客户服务组', description: 'customer-ms 与工台', memberCount: 5, autoSync: 'MANUAL' },
  { id: 'g_qa', name: '质量保障组', description: 'UAT 验证与回归', memberCount: 4, autoSync: 'LDAP' },
  { id: 'g_sre', name: 'SRE', description: '日志、发布与告警', memberCount: 3, autoSync: 'MANUAL' },
];

export const GROUPS_V2: GroupV2[] = [
  {
    id: 'g_fe',
    name: '前端平台组',
    description: 'Web 容器与全部微前端子应用',
    organizationId: 'org_1',
    ownerId: 'u_zhang',
    memberIds: ['u_zhang', 'u_zhou'],
    projectIds: ['p_acct'],
    createdAt: iso(180),
  },
  {
    id: 'g_acct',
    name: '账户服务组',
    description: 'account-ms / customer-adapter',
    organizationId: 'org_1',
    ownerId: 'u_zhang',
    memberIds: ['u_zhang'],
    projectIds: ['p_acct'],
    createdAt: iso(180),
  },
  {
    id: 'g_pay',
    name: '支付服务组',
    description: 'payment-ms、渠道网关',
    organizationId: 'org_1',
    ownerId: 'u_li',
    memberIds: ['u_li'],
    projectIds: ['p_pay'],
    createdAt: iso(165),
  },
  {
    id: 'g_cs',
    name: '客户服务组',
    description: 'customer-ms 与工台',
    organizationId: 'org_1',
    ownerId: 'u_zhao',
    memberIds: ['u_zhao'],
    projectIds: ['p_cs'],
    createdAt: iso(120),
  },
];

export const CASES_V2: CaseV2[] = [
  {
    id: 'c_1',
    caseKey: 'SH-20260908-D912E568',
    projectId: 'p_acct',
    groupId: 'g_acct',
    title: '登录页面 KYC 上传后无响应',
    description: '用户上传身份证照片后，页面卡在 loading 状态，无错误提示',
    status: 'PENDING',
    assigneeId: undefined,
    environment: 'PROD',
    severity: 'Major',
    pageUrl: 'https://account.company.com/kyc/upload',
    buildVersion: '2.14.3',
    reporter: 'tester@company.com',
    reportedAt: iso(0, 3),
    updatedAt: iso(0, 3),
    network: [],
    consoleLogs: [],
    stacks: [],
    evidenceChain: [],
    findings: [],
  },
  {
    id: 'c_2',
    caseKey: 'SH-20260907-A1B2C3D4',
    projectId: 'p_acct',
    groupId: 'g_acct',
    title: '账户资料修改保存失败',
    description: '修改手机号后点击保存，提示"系统错误"',
    status: 'ANALYZING',
    assigneeId: 'u_zhang',
    environment: 'PROD',
    severity: 'Critical',
    pageUrl: 'https://account.company.com/profile',
    buildVersion: '2.14.3',
    reporter: 'user@company.com',
    reportedAt: iso(1, 2),
    updatedAt: iso(0, 5),
    network: [],
    consoleLogs: [],
    stacks: [],
    evidenceChain: [],
    findings: [],
  },
  {
    id: 'c_3',
    caseKey: 'SH-20260906-E5F6G7H8',
    projectId: 'p_pay',
    groupId: 'g_pay',
    title: '支付回调通知延迟',
    description: '用户支付成功后，订单状态更新延迟超过 5 分钟',
    status: 'DEVELOPING',
    assigneeId: 'u_li',
    environment: 'PROD',
    severity: 'Major',
    pageUrl: 'https://payment.company.com/callback',
    buildVersion: '1.8.2',
    reporter: 'merchant@company.com',
    reportedAt: iso(2, 1),
    updatedAt: iso(0, 8),
    network: [],
    consoleLogs: [],
    stacks: [],
    evidenceChain: [],
    findings: [],
  },
  {
    id: 'c_4',
    caseKey: 'SH-20260905-I9J0K1L2',
    projectId: 'p_cs',
    groupId: 'g_cs',
    title: '工台搜索功能异常',
    description: '输入客户姓名后无搜索结果返回',
    status: 'VERIFYING',
    assigneeId: 'u_zhao',
    environment: 'UAT',
    severity: 'Minor',
    pageUrl: 'https://cs.company.com/workbench',
    buildVersion: '3.2.1',
    reporter: 'cs_staff@company.com',
    reportedAt: iso(3, 4),
    updatedAt: iso(0, 2),
    network: [],
    consoleLogs: [],
    stacks: [],
    evidenceChain: [],
    findings: [],
  },
];

const jiraSite = 'https://jira.company.com';

export const PROJECTS: Project[] = [
  {
    id: 'p_acct',
    projectKey: 'account-center',
    name: '账户中心',
    description: '登录、账户资料、额度与 KYC 流程',
    ownerId: 'u_zhang',
    access: { groupIds: ['g_fe', 'g_acct', 'g_qa'], userIds: ['u_zhou'] },
    status: 'ACTIVE',
    repos: [
      {
        id: 'r_1',
        repoType: 'FRONTEND',
        provider: 'BITBUCKET',
        repoProject: 'FE',
        repoSlug: 'account-web',
        defaultBranch: 'main',
        urlPatterns: [],
        subAppKey: 'account',
        verifyState: 'VERIFIED',
        lastCommit: 'a13f9c2',
        latestTag: 'v2.14.1',
      },
      {
        id: 'r_2',
        repoType: 'BACKEND',
        provider: 'BITBUCKET',
        repoProject: 'ACCT',
        repoSlug: 'account-ms',
        defaultBranch: 'main',
        urlPatterns: ['/api/account/**'],
        verifyState: 'VERIFIED',
        lastCommit: '9c21bb0',
        latestTag: 'v5.8.0',
      },
      {
        id: 'r_3',
        repoType: 'BACKEND',
        provider: 'BITBUCKET',
        repoProject: 'ACCT',
        repoSlug: 'customer-adapter',
        defaultBranch: 'master',
        urlPatterns: ['/api/customer/adapter/**'],
        verifyState: 'FAILED',
        lastCommit: '',
        latestTag: '',
      },
    ],
    urlMappings: [
      { id: 'm_1', pattern: '/api/account/**', service: 'account-ms', repoId: 'r_2' },
      { id: 'm_2', pattern: '/api/customer/adapter/**', service: 'customer-adapter', repoId: 'r_3' },
      { id: 'm_3', pattern: '/account/*', service: 'fe/account-web', repoId: 'r_1' },
    ],
    logging: {
      provider: 'ELASTIC',
      baseUrl: 'https://kibana.company.com/app/discover',
      indexPattern: 'account-ms-*,customer-adapter-*',
      versionMapping: 'TAG',
      fieldMap: {
        timestamp: '@timestamp',
        level: 'level',
        traceId: 'traceId',
        message: 'message',
        stackTrace: 'exception.stack_trace',
        service: 'service.name',
      },
      verifyState: 'VERIFIED',
      docCount7d: 1_284_930,
    },
    jira: {
      site: jiraSite,
      projectKey: 'ACCOUNT',
      issueType: 'Bug',
      descriptionTemplate: '问题描述 / 复现步骤 / 日志与 Trace / AI 诊断结论 / 建议修复',
      autoCreate: true,
    },
    uat: { pipelineId: 'account-ms-uat', deployMethod: 'WEBHOOK_DIRECT', enabled: true },
    capability: { aiDiagnosis: true, sourceAnalysis: true, autoFix: true, approvalMode: 'REVIEW_REQUIRED' },
    createdAt: iso(180),
    updatedAt: iso(2),
  },
  {
    id: 'p_pay',
    projectKey: 'payment-gateway',
    name: '支付网关',
    description: '渠道下单、回调、对账与退款',
    ownerId: 'u_li',
    access: { groupIds: ['g_pay', 'g_sre'], userIds: [] },
    status: 'ACTIVE',
    repos: [
      {
        id: 'r_4',
        repoType: 'FRONTEND',
        provider: 'BITBUCKET',
        repoProject: 'FE',
        repoSlug: 'cashier-web',
        defaultBranch: 'main',
        urlPatterns: [],
        subAppKey: 'cashier',
        verifyState: 'VERIFIED',
        lastCommit: '4b7de11',
        latestTag: 'v1.9.4',
      },
      {
        id: 'r_5',
        repoType: 'BACKEND',
        provider: 'BITBUCKET',
        repoProject: 'PAY',
        repoSlug: 'payment-ms',
        defaultBranch: 'main',
        urlPatterns: ['/api/pay/**'],
        verifyState: 'VERIFIED',
        lastCommit: 'e02aa5d',
        latestTag: 'v3.2.7',
      },
    ],
    urlMappings: [
      { id: 'm_4', pattern: '/api/pay/**', service: 'payment-ms', repoId: 'r_5' },
      { id: 'm_5', pattern: '/cashier/*', service: 'fe/cashier-web', repoId: 'r_4' },
    ],
    logging: {
      provider: 'ELASTIC',
      baseUrl: 'https://kibana.company.com/app/discover',
      indexPattern: 'payment-ms-*',
      versionMapping: 'CI_BUILD_NUMBER',
      fieldMap: {
        timestamp: '@timestamp',
        level: 'level',
        traceId: 'transactionId',
        message: 'msg',
        stackTrace: 'stack',
        service: 'app',
      },
      verifyState: 'VERIFIED',
      docCount7d: 884_210,
    },
    jira: {
      site: jiraSite,
      projectKey: 'PAY',
      issueType: 'Bug',
      descriptionTemplate: '问题描述 / 渠道与订单号 / 日志与 Trace / AI 诊断结论 / 建议修复',
      autoCreate: false,
    },
    uat: { pipelineId: 'payment-ms-uat', deployMethod: 'API_TRIGGER', enabled: true },
    capability: { aiDiagnosis: true, sourceAnalysis: true, autoFix: false, approvalMode: 'REVIEW_REQUIRED' },
    createdAt: iso(150),
    updatedAt: iso(6),
  },
  {
    id: 'p_cs',
    projectKey: 'customer-service',
    name: '客户服务',
    description: '工台、投诉与知识库',
    ownerId: 'u_zhao',
    access: { groupIds: ['g_cs', 'g_qa'], userIds: ['u_qian'] },
    status: 'ACTIVE',
    repos: [
      {
        id: 'r_6',
        repoType: 'FRONTEND',
        provider: 'GITHUB',
        repoProject: 'cs-frontend',
        repoSlug: 'workbench',
        defaultBranch: 'main',
        urlPatterns: [],
        verifyState: 'PENDING',
        lastCommit: '',
        latestTag: '',
      },
      {
        id: 'r_7',
        repoType: 'BACKEND',
        provider: 'BITBUCKET',
        repoProject: 'CS',
        repoSlug: 'customer-ms',
        defaultBranch: 'main',
        urlPatterns: ['/api/cs/**'],
        verifyState: 'VERIFIED',
        lastCommit: '77aa1c9',
        latestTag: 'v4.1.2',
      },
    ],
    urlMappings: [{ id: 'm_6', pattern: '/api/cs/**', service: 'customer-ms', repoId: 'r_7' }],
    logging: {
      provider: 'KIBANA',
      baseUrl: 'https://kibana.company.com/s/customer',
      indexPattern: 'customer-ms-*',
      versionMapping: 'COMMIT_HASH',
      fieldMap: {
        timestamp: '@timestamp',
        level: 'severity',
        traceId: 'trace.traceId',
        message: 'message',
        stackTrace: 'error.stacktrace',
        service: 'service.name',
      },
      verifyState: 'PENDING',
    },
    jira: {
      site: jiraSite,
      projectKey: 'CS',
      issueType: 'Task',
      descriptionTemplate: '问题描述 / 客户与工单号 / 日志与 Trace / AI 诊断结论',
      autoCreate: true,
    },
    uat: { pipelineId: '', deployMethod: 'WEBHOOK_DIRECT', enabled: false },
    capability: { aiDiagnosis: true, sourceAnalysis: false, autoFix: false, approvalMode: 'DISABLED' },
    createdAt: iso(96),
    updatedAt: iso(11),
  },
  {
    id: 'p_legacy',
    projectKey: 'legacy-portal',
    name: '旧版门户（已归档）',
    description: '2025 下线，保留历史 Case 查询',
    ownerId: 'u_zhang',
    access: { groupIds: ['g_fe'], userIds: [] },
    status: 'ARCHIVED',
    repos: [],
    urlMappings: [],
    logging: {
      provider: 'ELASTIC',
      baseUrl: 'https://kibana.company.com/app/discover',
      indexPattern: 'legacy-portal-*',
      versionMapping: 'TAG',
      fieldMap: {
        timestamp: '@timestamp',
        level: 'level',
        traceId: 'traceId',
        message: 'message',
        stackTrace: 'exception.stack_trace',
        service: 'service.name',
      },
      verifyState: 'FAILED',
    },
    jira: { site: jiraSite, projectKey: 'PORTAL', issueType: 'Bug', descriptionTemplate: '', autoCreate: false },
    uat: { pipelineId: '', deployMethod: 'WEBHOOK_DIRECT', enabled: false },
    capability: { aiDiagnosis: false, sourceAnalysis: false, autoFix: false, approvalMode: 'DISABLED' },
    createdAt: iso(420),
    updatedAt: iso(120),
  },
];

/** JIRA 工作流状态与流水线状态按 §9.2 保持一致 */
const STAGE_STATE: Record<
  Stage,
  {
    jira: JiraStatus;
    fix: FixPipelineStatus;
    uat: UatStatus;
    review: AnalysisReview;
    diagnosis: DiagnosisStatus;
    pr?: boolean;
  }
> = {
  ANALYZING: { jira: 'Analysis Ready', fix: 'PENDING_APPROVAL', uat: 'NONE', review: 'DONE', diagnosis: 'COMPLETED' },
  DEVELOPING: { jira: 'Fix Approved', fix: 'FIXING', uat: 'NONE', review: 'CONFIRMED', diagnosis: 'COMPLETED' },
  VERIFYING: { jira: 'In Review', fix: 'PR_CREATED', uat: 'NONE', review: 'CONFIRMED', diagnosis: 'COMPLETED', pr: true },
  DEPLOYING: { jira: 'In Deploy', fix: 'MERGED', uat: 'DEPLOYING', review: 'CONFIRMED', diagnosis: 'COMPLETED', pr: true },
  REJECTED: { jira: 'Rejected', fix: 'PR_REJECTED', uat: 'NONE', review: 'REJECTED', diagnosis: 'COMPLETED', pr: true },
  DONE: { jira: 'Done', fix: 'UAT_DEPLOYED', uat: 'SUCCESS', review: 'CONFIRMED', diagnosis: 'COMPLETED', pr: true },
};

interface Seed {
  p: string;
  n: number;
  title: string;
  type: FindingType;
  sev: Severity;
  env: Environment;
  stage: Stage;
  assignee: string;
  service: string;
  age: number;
  touched?: number;
  drift?: JiraStatus;
  case?: string;
}

const SEEDS: Seed[] = [
  {
    p: 'p_acct', n: 1287, title: 'KYC 提交后资料页一直转圈，账户状态未更新', type: 'BACKEND', sev: 'Critical',
    env: 'PROD', stage: 'ANALYZING', assignee: 'u_sun', service: 'account-ms', age: 1,
  },
  {
    p: 'p_acct', n: 1286, title: '切换语言后姓名拼音字段被清空', type: 'FRONTEND', sev: 'Major', env: 'PROD',
    stage: 'ANALYZING', assignee: 'u_qian', service: 'fe/account-web', age: 2,
  },
  {
    p: 'p_acct', n: 1281, title: '额度查询接口 504，customer-adapter 连接池打满', type: 'INTEGRATION', sev: 'Critical',
    env: 'PROD', stage: 'DEVELOPING', assignee: 'u_sun', service: 'customer-adapter', age: 4, drift: 'Fix Approved',
  },
  {
    p: 'p_acct', n: 1279, title: '登录态过期后未跳转 SSO，页面白屏', type: 'FRONTEND', sev: 'Major', env: 'UAT',
    stage: 'DEVELOPING', assignee: 'u_qian', service: 'fe/account-web', age: 5,
  },
  {
    p: 'p_acct', n: 1274, title: '批量导出 CSV 在大数据量下 OOM', type: 'BACKEND', sev: 'Minor', env: 'PROD',
    stage: 'VERIFYING', assignee: 'u_sun', service: 'account-ms', age: 8,
  },
  {
    p: 'p_acct', n: 1271, title: '实名认证回调重复消费导致状态回滚', type: 'BACKEND', sev: 'Critical', env: 'PROD',
    stage: 'VERIFYING', assignee: 'u_zhang', service: 'account-ms', age: 10, drift: 'Ready to Merge',
  },
  {
    p: 'p_acct', n: 1266, title: '头像上传成功后缩略图仍显示旧图（缓存未失效）', type: 'FRONTEND', sev: 'Minor',
    env: 'PROD', stage: 'DEPLOYING', assignee: 'u_qian', service: 'fe/account-web', age: 13,
  },
  {
    p: 'p_acct', n: 1258, title: '账户余额四舍五入误差导致对账差异', type: 'BACKEND', sev: 'Major', env: 'PROD',
    stage: 'DONE', assignee: 'u_sun', service: 'account-ms', age: 21,
  },
  {
    p: 'p_acct', n: 1252, title: '手机号更换验证码倒计时未按秒刷新', type: 'FRONTEND', sev: 'Minor', env: 'DEV',
    stage: 'REJECTED', assignee: 'u_qian', service: 'fe/account-web', age: 25,
  },
  {
    p: 'p_pay', n: 431, title: '招商银行渠道回调签名校验失败，订单悬挂', type: 'BACKEND', sev: 'Critical', env: 'PROD',
    stage: 'DEVELOPING', assignee: 'u_zhou', service: 'payment-ms', age: 2, drift: 'In Review',
  },
  {
    p: 'p_pay', n: 429, title: '收银台金额小数位展示为 0.0', type: 'FRONTEND', sev: 'Major', env: 'PROD',
    stage: 'ANALYZING', assignee: 'u_zhou', service: 'fe/cashier-web', age: 3,
  },
  {
    p: 'p_pay', n: 425, title: '退款接口幂等键缺失导致重复退款', type: 'BACKEND', sev: 'Critical', env: 'PROD',
    stage: 'VERIFYING', assignee: 'u_li', service: 'payment-ms', age: 7,
  },
  {
    p: 'p_pay', n: 418, title: '对账文件解析在跨月边界漏单', type: 'BACKEND', sev: 'Major', env: 'UAT',
    stage: 'DEPLOYING', assignee: 'u_zhou', service: 'payment-ms', age: 12,
  },
  {
    p: 'p_pay', n: 410, title: '渠道超时后前端未提示可重试', type: 'INTEGRATION', sev: 'Minor', env: 'PROD',
    stage: 'DONE', assignee: 'u_zhou', service: 'payment-ms', age: 28,
  },
  {
    p: 'p_cs', n: 96, title: '工单列表按处理人筛选无结果', type: 'BACKEND', sev: 'Major', env: 'PROD',
    stage: 'ANALYZING', assignee: 'u_wu', service: 'customer-ms', age: 1,
  },
  {
    p: 'p_cs', n: 92, title: '知识库全文检索高亮丢失', type: 'FRONTEND', sev: 'Minor', env: 'PROD',
    stage: 'VERIFYING', assignee: 'u_wu', service: 'cs-workbench', age: 6,
  },
  {
    p: 'p_cs', n: 88, title: '投诉单转派后 SLA 计时未重置', type: 'BACKEND', sev: 'Critical', env: 'PROD',
    stage: 'DONE', assignee: 'u_zhao', service: 'customer-ms', age: 15,
  },
  {
    p: 'p_cs', n: 83, title: '工台导出 Excel 在 IE 内核下乱码', type: 'FRONTEND', sev: 'Minor', env: 'STAGE',
    stage: 'REJECTED', assignee: 'u_wu', service: 'cs-workbench', age: 30,
  },
];

const FIX_LOGS: Record<Stage, { actor: string; message: string }[]> = {
  ANALYZING: [
    { actor: 'system', message: 'Case 采证完成，Evidence 12 条' },
    { actor: 'llm', message: '诊断产出 Finding，置信度 0.86' },
  ],
  DEVELOPING: [
    { actor: 'owner', message: '批准修复，进入自动修复流程' },
    { actor: 'llm', message: 'Fix Agent 已修改 3 个文件，单测通过' },
  ],
  VERIFYING: [
    { actor: 'owner', message: '批准修复，进入自动修复流程' },
    { actor: 'llm', message: 'PR 已创建，等待 Bitbucket Review' },
  ],
  DEPLOYING: [
    { actor: 'reviewer', message: 'PR Approved' },
    { actor: 'bitbucket', message: 'PR Merged → 触发 UAT Pipeline' },
  ],
  REJECTED: [
    { actor: 'reviewer', message: 'PR Declined：改动影响面过大，需拆分' },
  ],
  DONE: [
    { actor: 'pipeline', message: 'UAT 发布成功' },
    { actor: 'jira', message: 'Transition → Done，关单' },
  ],
};

function buildTicket(s: Seed, i: number): Ticket {
  const st = STAGE_STATE[s.stage];
  const project = PROJECTS.find((p) => p.id === s.p)!;
  const jiraKey = `${project.jira.projectKey}-${s.n}`;
  const repoSlug = s.service.startsWith('fe/') ? s.service.slice(3) : s.service;
  const createdAt = iso(s.age, i);
  return {
    id: `t_${jiraKey}`,
    projectId: s.p,
    jiraKey,
    jiraUrl: `${jiraSite}/browse/${jiraKey}`,
    title: s.title,
    jiraStatus: st.jira,
    jiraStatusRemote: s.drift ?? st.jira,
    findingType: s.type,
    severity: s.sev,
    environment: s.env,
    assigneeId: s.assignee,
    defaultAssigneeId: project.ownerId,
    diagnosis: st.diagnosis,
    analysisReview: st.review,
    fix: {
      status: st.fix,
      prUrl: st.pr ? `https://bitbucket.company.com/projects/${project.repos[0]?.repoProject}/repos/${repoSlug}/pull-requests/${s.n}` : undefined,
      prBranch: st.pr ? `fix/${jiraKey}-ai` : undefined,
      approvedById: s.stage === 'ANALYZING' ? undefined : project.ownerId,
      logs: (FIX_LOGS[s.stage] ?? []).map((l, k) => ({
        at: iso(Math.max(s.age - (k + 1) * 0.5, 0)),
        actor: l.actor,
        message: l.message,
      })),
    },
    uat: st.uat,
    caseKey: `CTX-${1000 + i}`,
    findingKey: `FND-${2000 + i}`,
    service: s.service,
    createdAt,
    updatedAt: iso(s.touched ?? Math.max(s.age - 0.5, 0)),
    drift: s.drift ? `JIRA 已流转到 ${s.drift}` : undefined,
  };
}

export const TICKETS: Ticket[] = SEEDS.map(buildTicket);

const FINDING_TEXT: Record<FindingType, { rootCause: string; fix: string; file: string }> = {
  BACKEND: {
    rootCause:
      '下游 customer-adapter 连接池 maxActive=8 在高并发下耗尽，`/api/account/quota` 平均等待 4.2s 后由网关侧超时抛 504。',
    fix: '将连接池扩容至 32 并增加获取超时降级；为 quota 调用补充熔断与重试退避。',
    file: 'account-ms/src/main/java/com/company/account/QuotaService.java',
  },
  FRONTEND: {
    rootCause: '`onLanguageChange` 里 setFieldsValue 覆盖了 namePinyin，且未从接口回填该字段。',
    fix: '切换语言时仅更新展示字段，namePinyin 保留 store 原值并在提交前回填。',
    file: 'account-web/src/pages/Profile/index.tsx',
  },
  INTEGRATION: {
    rootCause: '前端按旧契约读取 data.result.list，后端 v5.8.0 已改为 data.items，导致列表渲染为空。',
    fix: '统一走 API 适配层读取 items，并补充契约测试锁定字段。',
    file: 'account-web/src/services/customer.ts',
  },
};

/** Case 由工单反推生成，保证列表与详情数据一致 */
export function buildCase(ticket: Ticket): Case {
  const project = PROJECTS.find((p) => p.id === ticket.projectId)!;
  const text = FINDING_TEXT[ticket.findingType];
  const finding: Finding = {
    id: `f_${ticket.findingKey}`,
    findingKey: ticket.findingKey,
    type: ticket.findingType,
    title: ticket.title,
    rootCause: text.rootCause,
    aiConfidence: 0.86,
    systemConfidence: 0.71,
    verificationStatus: ticket.analysisReview === 'CONFIRMED' ? 'VERIFIED' : 'AI_SUGGESTED',
    locations: [{ file: text.file, line: 128 }],
    recommendedFix: text.fix,
    evidenceIds: ['EVD-301', 'EVD-302'],
    jiraKey: ticket.jiraKey,
  };
  return {
    id: `c_${ticket.caseKey}`,
    caseKey: ticket.caseKey,
    projectId: ticket.projectId,
    title: ticket.title,
    environment: ticket.environment,
    severity: ticket.severity,
    pageUrl: `https://portal.company.com/account/profile?from=todo`,
    buildVersion: project.repos[1]?.latestTag ?? 'v1.0.0',
    reporter: `${project.name} 值班`,
    reportedAt: ticket.createdAt,
    status: ticket.diagnosis === 'RUNNING' ? 'ANALYZING' : 'JIRA',
    description: `${ticket.title}。复现路径：登录 → 账户资料 → 触发对应操作，稳定复现。`,
    network: [
      { id: 'EVD-301', kind: 'NETWORK', label: 'POST /api/account/quota · 504 · 4210ms', detail: 'traceId=2f81c0…e7，响应体为空，网关 timeout' },
      { id: 'EVD-304', kind: 'NETWORK', label: 'GET /api/customer/adapter/status · 200 · 310ms', detail: '用于关联上下文，无异常' },
    ],
    consoleLogs: [
      { id: 'EVD-302', kind: 'CONSOLE', label: 'TypeError: cannot read properties of undefined (reading "items")', detail: 'at ProfilePage.tsx:212 · 3 次重复' },
    ],
    stacks: [
      { id: 'EVD-303', kind: 'STACK', label: 'java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available', detail: 'requestTimeout=3000ms, active=8, idle=0, waiting=27' },
    ],
    evidenceChain: [
      { node: ticket.caseKey, label: 'Context 上报' },
      { node: 'EVD-301', label: 'Network' },
      { node: 'EVD-303', label: '日志堆栈' },
      { node: ticket.findingKey, label: 'Finding' },
      { node: ticket.jiraKey, label: 'JIRA' },
    ],
    findings: [finding],
  };
}

export const AUDIT_LOGS: AuditLogItem[] = [
  { id: 'a1', at: iso(0, 2), actor: 'admin@company.com', action: 'ROLE_GRANT', target: 'lisi@company.com', detail: 'DEVELOPER → PROJECT_OWNER', ip: '10.20.3.7', result: 'SUCCESS' },
  { id: 'a2', at: iso(0, 4), actor: 'zhangsan@company.com', action: 'PROJECT_CREATE', target: 'account-center', detail: '新增后端仓库 customer-adapter 绑定', ip: '10.20.3.11', result: 'SUCCESS' },
  { id: 'a3', at: iso(1), actor: 'qianqi@company.com', action: 'LOGIN', target: 'GOOGLE OAuth', detail: '邮箱域名白名单校验通过', ip: '10.20.5.42', result: 'SUCCESS' },
  { id: 'a4', at: iso(1, 8), actor: 'unknown@external.io', action: 'LOGIN', target: 'GOOGLE OAuth', detail: '邮箱域名不在白名单', ip: '203.0.113.9', result: 'DENIED' },
  { id: 'a5', at: iso(2), actor: 'lisi@company.com', action: 'FIX_APPROVE', target: 'PAY-425', detail: '批准 AI 修复并触发 Fix Agent', ip: '10.20.4.19', result: 'SUCCESS' },
  { id: 'a6', at: iso(3), actor: 'system', action: 'SYNC_JIRA', target: 'payment-gateway', detail: '轮询兜底，14 条工单状态同步，2 条变更', ip: '—', result: 'SUCCESS' },
  { id: 'a7', at: iso(4), actor: 'zhaowu@company.com', action: 'ACCESS_UPDATE', target: 'customer-service', detail: '新增授权组：质量保障组', ip: '10.20.6.8', result: 'SUCCESS' },
];

export const ENVIRONMENT_OPTIONS: Environment[] = ['PROD', 'UAT', 'STAGE', 'DEV'];
