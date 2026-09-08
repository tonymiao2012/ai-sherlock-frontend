import { Descriptions, Drawer, Empty, Progress, Tabs, Tag, Typography } from 'antd';
import type { CaseV2, CaseStatus } from '../types';
import { CASE_STATUS_META } from '../domain/caseLifecycle';
import { SEVERITY_META } from '../domain/ticket';
import { CaseStatusTag } from '../components/CaseStatusTag';
import { CaseActions } from '../components/CaseActions';
import { useSession } from '../context/Session';

interface Props {
  caseItem?: CaseV2;
  open: boolean;
  onClose: () => void;
  onAssign: (caseId: string, assigneeId: string) => Promise<void>;
  onStatusChange: (caseId: string, newStatus: CaseStatus) => Promise<void>;
}

export function CaseDrawer({ caseItem, open, onClose, onAssign, onStatusChange }: Props) {
  const { projects, userName } = useSession();

  if (!caseItem) return null;

  const project = projects.find((p) => p.id === caseItem.projectId);
  const finding = caseItem.findings[0];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title={
        <span className="ac-tools">
          <Typography.Text strong>{caseItem.caseKey}</Typography.Text>
          <CaseStatusTag status={caseItem.status} />
        </span>
      }
    >
      <Typography.Paragraph style={{ marginTop: 0 }} strong>
        {caseItem.title}
      </Typography.Paragraph>

      <Descriptions
        size="small"
        column={2}
        style={{ marginBlock: 18 }}
        items={[
          { key: 'p', label: '项目', children: project?.name ?? '—' },
          { key: 'e', label: '环境', children: caseItem.environment },
          { key: 'sv', label: '严重程度', children: SEVERITY_META[caseItem.severity]?.label ?? caseItem.severity },
          { key: 'a', label: '负责人', children: caseItem.assigneeId ? userName(caseItem.assigneeId) : '未分配' },
          { key: 'r', label: '上报人', children: caseItem.reporter },
          { key: 'bv', label: 'Build Version', children: caseItem.buildVersion },
          { key: 's', label: '当前状态', children: CASE_STATUS_META[caseItem.status]?.label ?? caseItem.status },
        ]}
      />

      <div style={{ marginBottom: 16 }}>
        <CaseActions caseItem={caseItem} onAssign={onAssign} onStatusChange={onStatusChange} />
      </div>

      <Tabs
        items={[
          {
            key: 'finding',
            label: 'AI 诊断结论',
            children: finding ? (
              <div>
                <Typography.Paragraph>
                  <Typography.Text type="secondary">Root Cause</Typography.Text>
                  <br />
                  {finding.rootCause}
                </Typography.Paragraph>
                <div className="ac-tools" style={{ gap: 24, marginBlockEnd: 14 }}>
                  <ConfidenceBar label="AI 置信度" value={finding.aiConfidence} />
                  <ConfidenceBar label="系统校验" value={finding.systemConfidence} />
                  <Tag color={finding.verificationStatus === 'VERIFIED' ? 'success' : 'default'}>
                    {finding.verificationStatus}
                  </Tag>
                </div>
                <Typography.Paragraph>
                  <Typography.Text type="secondary">涉及文件</Typography.Text>
                  <br />
                  <Typography.Text code>
                    {finding.locations.map((l) => `${l.file}:${l.line}`).join('\n')}
                  </Typography.Text>
                </Typography.Paragraph>
                <Typography.Paragraph>
                  <Typography.Text type="secondary">建议修复</Typography.Text>
                  <br />
                  {finding.recommendedFix}
                </Typography.Paragraph>
              </div>
            ) : (
              <Empty description="暂无诊断结论" />
            ),
          },
          {
            key: 'evidence',
            label: '证据链',
            children: (
              <div>
                {caseItem.evidenceChain.length > 0 && (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    {caseItem.evidenceChain.map((n) => `${n.node}(${n.label})`).join(' → ')}
                  </Typography.Paragraph>
                )}
                <EvidenceGroup title="Network" items={caseItem.network} />
                <EvidenceGroup title="Console" items={caseItem.consoleLogs} />
                <EvidenceGroup title="异常堆栈" items={caseItem.stacks} />
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    { key: 'url', label: '页面 URL', children: <Typography.Text copyable>{caseItem.pageUrl}</Typography.Text> },
                    { key: 'desc', label: '描述', children: caseItem.description },
                  ]}
                />
              </div>
            ),
          },
        ]}
      />
    </Drawer>
  );
}

function EvidenceGroup({ title, items }: { title: string; items: { id: string; label: string; detail: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Text type="secondary">{title}</Typography.Text>
      {items.map((e) => (
        <div key={e.id} className="ac-evidence" style={{ marginTop: 8 }}>
          <div className="ac-evidence__label">{`${e.id} · ${e.label}`}</div>
          <div className="ac-evidence__detail">{e.detail}</div>
        </div>
      ))}
    </div>
  );
}

function ConfidenceBar({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 180 }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Progress percent={Math.round(value * 100)} size="small" />
    </div>
  );
}
