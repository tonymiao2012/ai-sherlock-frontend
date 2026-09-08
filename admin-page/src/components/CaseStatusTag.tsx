import { Tag } from 'antd';
import type { CaseStatus } from '../types';
import { CASE_STATUS_META } from '../domain/caseLifecycle';

interface CaseStatusTagProps {
  status: CaseStatus;
}

export function CaseStatusTag({ status }: CaseStatusTagProps) {
  const meta = CASE_STATUS_META[status];
  if (!meta) return <Tag>{status}</Tag>;
  return (
    <Tag style={{ color: meta.color, background: meta.bg, border: 'none' }}>
      {meta.label}
    </Tag>
  );
}
