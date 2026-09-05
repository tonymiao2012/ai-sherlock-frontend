import type {
  AnalysisReview,
  DiagnosisStatus,
  FixPipelineStatus,
  JiraStatus,
  Severity,
  Stage,
  Ticket,
  UatStatus,
} from '../types';

/** 主流程顺序，渲染 Steps 用；REJECTED 是从 DEVELOPING/VERIFYING 分出的终态 */
export const MAIN_STAGES: Stage[] = ['ANALYZING', 'DEVELOPING', 'VERIFYING', 'DEPLOYING', 'DONE'];

export const STAGE_META: Record<Stage, { label: string; color: string; bg: string; desc: string }> = {
  ANALYZING: { label: '分析态', color: '#1D5BBF', bg: '#EAF2FF', desc: 'LLM 采证与分析，等待 Owner 审批修复' },
  DEVELOPING: { label: '开发中', color: '#AD4E00', bg: '#FFF3E6', desc: '已批准修复，AI 改代码并创建 PR（Fix + PR）' },
  VERIFYING: { label: '验证', color: '#5B2E9C', bg: '#F3ECFF', desc: 'PR 在 Bitbucket 由人工 Review、验证改动' },
  DEPLOYING: { label: '部署', color: '#08605F', bg: '#E4F6F4', desc: '已 Merge，触发 UAT 发布并等待结果' },
  REJECTED: { label: '拒绝', color: '#CF1322', bg: '#FFF1F0', desc: '分析结论或 PR 被拒绝，工单终态' },
  DONE: { label: '完成', color: '#3C6B0B', bg: '#EDFADE', desc: 'UAT 发布成功并在 JIRA 关单' },
};

export const FIX_STATUS_META: Record<FixPipelineStatus, string> = {
  PENDING_APPROVAL: '待审批',
  APPROVED: '已批准',
  FIXING: '修复中',
  FIX_FAILED: '修复失败',
  PR_CREATED: 'PR 已创建',
  PR_APPROVED: 'PR 已批准',
  PR_REJECTED: 'PR 被拒绝',
  MERGED: '已 Merge',
  UAT_DEPLOYED: 'UAT 已发布',
  DEPLOY_FAILED: '部署失败',
};

export const DIAGNOSIS_META: Record<DiagnosisStatus, { label: string; tone: string }> = {
  NOT_STARTED: { label: '未分析', tone: 'default' },
  RUNNING: { label: '分析中', tone: 'processing' },
  COMPLETED: { label: '已分析', tone: 'success' },
  FAILED: { label: '分析失败', tone: 'error' },
};

export const ANALYSIS_REVIEW_META: Record<AnalysisReview, string> = {
  NONE: '未分析',
  RUNNING: '分析中',
  DONE: '已分析',
  CONFIRMED: '人工确认',
  REJECTED: '已拒绝',
};

export const UAT_META: Record<UatStatus, string> = {
  NONE: '—',
  PENDING: '待发布',
  DEPLOYING: '发布中',
  SUCCESS: '发布成功',
  FAILED: '发布失败',
};

export const SEVERITY_META: Record<Severity, { label: string; color: string }> = {
  Critical: { label: 'Critical', color: '#CF1322' },
  Major: { label: 'Major', color: '#AD4E00' },
  Minor: { label: 'Minor', color: '#8A9184' },
};

export const FINDING_TYPE_META = {
  FRONTEND: { short: 'FE', label: '前端' },
  BACKEND: { short: 'BE', label: '后端' },
  INTEGRATION: { short: 'INT', label: '集成' },
} as const;

/** §7.4 JIRA 工作流 → 中台动作，用于同步日志与阶段派生 */
export const JIRA_STATUS_FLOW: JiraStatus[] = [
  'Open',
  'Analysis Ready',
  'Fix Approved',
  'In Review',
  'Ready to Merge',
  'In Deploy',
  'Done',
];

/**
 * 流水线阶段不入库，由 JIRA 状态 + fix_pipeline.status 派生（PRD §9.2 映射表）。
 * 顺序判断：终态优先，其次按流水线推进位置归并。
 */
export function stageOf(t: Pick<Ticket, 'jiraStatus' | 'analysisReview' | 'fix' | 'uat' | 'diagnosis'>): Stage {
  const { status } = t.fix;
  if (status === 'PR_REJECTED' || t.analysisReview === 'REJECTED' || t.jiraStatus === 'Rejected') return 'REJECTED';
  if (t.jiraStatus === 'Done' || t.jiraStatus === 'Closed') return 'DONE';
  if (status === 'UAT_DEPLOYED' && t.uat === 'SUCCESS') return 'DONE';
  if (status === 'MERGED' || status === 'UAT_DEPLOYED' || status === 'DEPLOY_FAILED') return 'DEPLOYING';
  if (t.jiraStatus === 'In Deploy' || t.uat === 'PENDING' || t.uat === 'DEPLOYING') return 'DEPLOYING';
  if (status === 'PR_CREATED' || status === 'PR_APPROVED') return 'VERIFYING';
  if (t.jiraStatus === 'In Review' || t.jiraStatus === 'Ready to Merge') return 'VERIFYING';
  if (status === 'APPROVED' || status === 'FIXING' || status === 'FIX_FAILED') return 'DEVELOPING';
  if (t.jiraStatus === 'Fix Approved') return 'DEVELOPING';
  return 'ANALYZING';
}

/** 当前阶段在主流程中的位置，REJECTED 停在被拒绝前的那一步 */
export function stageIndex(t: Ticket): number {
  const stage = stageOf(t);
  if (stage === 'REJECTED') {
    const reached = stageOf({ ...t, jiraStatus: 'Fix Approved', fix: { ...t.fix, status: 'APPROVED' }, uat: 'NONE' });
    return Math.max(MAIN_STAGES.indexOf(reached), 0);
  }
  return MAIN_STAGES.indexOf(stage);
}

export function isOverdue(t: Ticket, days = 3): boolean {
  if (stageOf(t) === 'DONE' || stageOf(t) === 'REJECTED') return false;
  return Date.now() - new Date(t.updatedAt).getTime() > days * 86400000;
}
