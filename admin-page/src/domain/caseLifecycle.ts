import type { CaseStatus, CaseV2, DeploymentRun } from '../types';

/** Case 状态元数据（docs/case-lifecycle-architecture-design.md §5） */
export const CASE_STATUS_META: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  PENDING_ANALYSIS:     { label: '待开始',   color: '#8A9184', bg: '#F5F5F5' },
  ANALYZING:            { label: '分析中',   color: '#1D5BBF', bg: '#EAF2FF' },
  ANALYSIS_COMPLETED:   { label: '分析结束', color: '#389E0D', bg: '#F6FFED' },
  DEVELOPING:           { label: '开发中',   color: '#AD4E00', bg: '#FFF3E6' },
  DEPLOYING:            { label: '部署中',   color: '#08605F', bg: '#E4F6F4' },
  DEPLOY_FAILED:        { label: '部署失败', color: '#CF1322', bg: '#FFF1F0' },
  DEPLOYED:             { label: '部署完成', color: '#5B2E9C', bg: '#F3ECFF' },
  PENDING_VERIFICATION: { label: '待验证',   color: '#722ED1', bg: '#F9F0FF' },
  COMPLETED:            { label: '已完成',   color: '#3C6B0B', bg: '#EDFADE' },
};

/** 合法状态转换表（docs/case-lifecycle-architecture-design.md §5 stateDiagram） */
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  PENDING_ANALYSIS:     ['ANALYZING'],
  ANALYZING:            ['ANALYSIS_COMPLETED'],
  ANALYSIS_COMPLETED:   ['DEVELOPING', 'PENDING_VERIFICATION'],
  DEVELOPING:           ['DEPLOYING'],
  DEPLOYING:            ['DEPLOYED', 'DEPLOY_FAILED'],
  DEPLOY_FAILED:        ['DEPLOYING'],
  DEPLOYED:             ['PENDING_VERIFICATION'],
  PENDING_VERIFICATION: ['COMPLETED', 'PENDING_ANALYSIS'],
  COMPLETED:            [],
};

export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(current: CaseStatus): CaseStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

export function getStatusLabel(status: CaseStatus): string {
  return CASE_STATUS_META[status]?.label ?? status;
}

/** 分析是否完成：所有当前 Finding 均为 ACCEPTED */
export function isAnalysisCompleted(caseItem: CaseV2): boolean {
  const currentFindings = caseItem.findings.filter((f) => f.isCurrent);
  return currentFindings.length > 0 && currentFindings.every((f) => f.analysisStatus === 'ACCEPTED');
}

/** 是否可进入开发中：所有当前 Finding 已选择处理方式 */
export function isReadyToDevelop(caseItem: CaseV2): boolean {
  const currentFindings = caseItem.findings.filter((f) => f.isCurrent);
  return currentFindings.every(
    (f) => f.analysisStatus === 'ACCEPTED' && f.resolutionType != null,
  );
}

/** 是否全部 Ignore */
export function isAllIgnored(caseItem: CaseV2): boolean {
  const currentFindings = caseItem.findings.filter((f) => f.isCurrent);
  return currentFindings.length > 0 && currentFindings.every((f) => f.resolutionType === 'IGNORE');
}

/** 部署聚合状态 */
export function deploymentAggregate(runs: DeploymentRun[]): 'ALL_SUCCESS' | 'HAS_FAILED' | 'IN_PROGRESS' | 'NONE' {
  if (runs.length === 0) return 'NONE';
  if (runs.some((r) => r.status === 'FAILED')) return 'HAS_FAILED';
  if (runs.every((r) => r.status === 'SUCCEEDED')) return 'ALL_SUCCESS';
  return 'IN_PROGRESS';
}
