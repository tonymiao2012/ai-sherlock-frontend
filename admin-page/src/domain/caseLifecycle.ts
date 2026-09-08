import type { CaseStatus } from '../types';

/** Case 状态元数据（标签、颜色） */
export const CASE_STATUS_META: Record<CaseStatus, { label: string; color: string; bg: string }> = {
  PENDING:    { label: '未开始',   color: '#8A9184', bg: '#F5F5F5' },
  ANALYZING:  { label: '分析中',   color: '#1D5BBF', bg: '#EAF2FF' },
  ANALYZED:   { label: '分析完成', color: '#389E0D', bg: '#F6FFED' },
  DEVELOPING: { label: '开发中',   color: '#AD4E00', bg: '#FFF3E6' },
  DEPLOYING:  { label: '部署中',   color: '#08605F', bg: '#E4F6F4' },
  DEPLOYED:   { label: '部署完成', color: '#5B2E9C', bg: '#F3ECFF' },
  VERIFYING:  { label: '验证中',   color: '#722ED1', bg: '#F9F0FF' },
  VERIFIED:   { label: '验证通过', color: '#3C6B0B', bg: '#EDFADE' },
  FAILED:     { label: '验证失败', color: '#CF1322', bg: '#FFF1F0' },
};

/** 合法状态转换表（docs/backend-admin-requirements.md §6.1） */
export const VALID_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  PENDING:    ['ANALYZING'],
  ANALYZING:  ['ANALYZED'],
  ANALYZED:   ['DEVELOPING'],
  DEVELOPING: ['DEPLOYING'],
  DEPLOYING:  ['DEPLOYED'],
  DEPLOYED:   ['VERIFYING'],
  VERIFYING:  ['VERIFIED', 'FAILED'],
  VERIFIED:   [],
  FAILED:     ['PENDING'], // 验证失败后回到未开始
};

/** 校验状态转换是否合法 */
export function canTransition(from: CaseStatus, to: CaseStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** 获取当前状态可转换的下一状态列表 */
export function getNextStatuses(current: CaseStatus): CaseStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

/** 获取状态的中文标签 */
export function getStatusLabel(status: CaseStatus): string {
  return CASE_STATUS_META[status]?.label ?? status;
}
