import {
  Button,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Progress,
  Steps,
  Tag,
  Typography,
} from 'antd';
import type {
  CaseStatus,
  CaseV2,
  FindingResolutionType,
} from '../types';
import { CASE_STATUS_META } from '../domain/caseLifecycle';
import { SEVERITY_META } from '../domain/ticket';
import { palette } from '../theme';
import { CaseStatusTag } from './CaseStatusTag';
import { useSession } from '../context/Session';
import * as api from '../services/api';
import { fmtShort } from '../domain/format';
import { useState } from 'react';

const STATUS_STEPS = [
  'PENDING_ANALYSIS',
  'ANALYZING',
  'ANALYSIS_COMPLETED',
  'DEVELOPING',
  'DEPLOYING',
  'DEPLOYED',
  'PENDING_VERIFICATION',
  'COMPLETED',
] as CaseStatus[];

interface Props {
  caseItem?: CaseV2;
  open: boolean;
  onClose: () => void;
  onStatusChange: (caseId: string, newStatus: CaseStatus) => Promise<void>;
  onCaseUpdate?: (updated: CaseV2) => void;
}

export function CaseDetailModal({ caseItem, open, onClose, onStatusChange, onCaseUpdate }: Props) {
  const { projects, userName } = useSession();

  if (!caseItem) return null;

  const project = projects.find((p) => p.id === caseItem.projectId);
  const currentStep = STATUS_STEPS.indexOf(caseItem.status);

  const refresh = async () => {
    const updated = await api.getCaseV2(caseItem.id);
    if (updated && onCaseUpdate) onCaseUpdate(updated);
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      centered
      styles={{
        body: { height: '75vh', overflow: 'auto', padding: '16px 24px' },
      }}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong>{caseItem.caseKey}</Typography.Text>
          <CaseStatusTag status={caseItem.status} />
        </span>
      }
    >
      <Typography.Paragraph style={{ marginTop: 0, marginBottom: 16 }} strong>
        {caseItem.title}
      </Typography.Paragraph>

      <Steps
        size="small"
        current={currentStep}
        style={{ marginBottom: 20 }}
        items={STATUS_STEPS.map((s) => ({ title: CASE_STATUS_META[s]?.label ?? s }))}
      />

      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusContent caseItem={caseItem} project={project} userName={userName} onRefresh={refresh} />
        </div>
        <div style={{ width: 180, flexShrink: 0 }}>
          <WorkflowButtons caseItem={caseItem} onStatusChange={onStatusChange} onRefresh={refresh} />
        </div>
      </div>
    </Modal>
  );
}

/* =========================== Status-specific Content =========================== */

function StatusContent({
  caseItem,
  project,
  userName,
  onRefresh,
}: {
  caseItem: CaseV2;
  project?: { id: string; name: string };
  userName: (id: string) => string;
  onRefresh: () => Promise<void>;
}) {
  switch (caseItem.status) {
    case 'PENDING_ANALYSIS':
      return <ReportView caseItem={caseItem} project={project} userName={userName} />;
    case 'ANALYZING':
      return <AnalyzingView caseItem={caseItem} onRefresh={onRefresh} />;
    case 'ANALYSIS_COMPLETED':
      return <AnalysisDoneView caseItem={caseItem} />;
    case 'DEVELOPING':
      return <DevelopingView caseItem={caseItem} onRefresh={onRefresh} />;
    case 'DEPLOYING':
      return <DeployingView caseItem={caseItem} onRefresh={onRefresh} />;
    case 'DEPLOYED':
      return <DeployedView caseItem={caseItem} />;
    case 'PENDING_VERIFICATION':
      return <PendingVerificationView caseItem={caseItem} />;
    case 'COMPLETED':
      return <CompletedView caseItem={caseItem} />;
    default:
      return <ReportView caseItem={caseItem} project={project} userName={userName} />;
  }
}

/* ---------- 待开始: Report ---------- */

function ReportView({
  caseItem,
  project,
  userName,
}: {
  caseItem: CaseV2;
  project?: { id: string; name: string };
  userName: (id: string) => string;
}) {
  return (
    <div>
      <Descriptions size="small" column={2} items={[
        { key: 'p', label: '项目', children: project?.name ?? '—' },
        { key: 'e', label: '环境', children: caseItem.environment },
        { key: 'sv', label: '严重程度', children: SEVERITY_META[caseItem.severity]?.label ?? caseItem.severity },
        { key: 'a', label: '负责人', children: caseItem.assigneeId ? userName(caseItem.assigneeId) : '未分配' },
        { key: 'r', label: '上报人', children: caseItem.reporter },
        { key: 'bv', label: 'Build Version', children: caseItem.buildVersion },
        { key: 't', label: '上报时间', children: fmtShort(caseItem.reportedAt) },
        { key: 'c', label: 'Cycle', children: `#${caseItem.currentCycle?.cycleNo ?? 1}` },
      ]} />

      <Divider style={{ margin: '12px 0' }} />

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
        页面 URL
      </Typography.Text>
      <Typography.Link href={caseItem.pageUrl} target="_blank" style={{ display: 'block', marginBottom: 12 }}>
        {caseItem.pageUrl}
      </Typography.Link>

      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
        问题描述
      </Typography.Text>
      <Typography.Paragraph>{caseItem.description}</Typography.Paragraph>

      <EvidenceSection caseItem={caseItem} />
    </div>
  );
}

function EvidenceSection({ caseItem }: { caseItem: CaseV2 }) {
  const hasEvidence = caseItem.network.length > 0 || caseItem.consoleLogs.length > 0 || caseItem.stacks.length > 0;
  if (!hasEvidence) return null;

  return (
    <Collapse
      size="small"
      style={{ marginTop: 8 }}
      items={[
        ...(caseItem.network.length > 0 ? [{
          key: 'network',
          label: `Network Logs (${caseItem.network.length})`,
          children: caseItem.network.map((e) => (
            <div key={e.id} style={{ fontSize: 12, marginBottom: 6, fontFamily: 'monospace' }}>
              <Tag style={{ fontSize: 10 }}>{e.kind}</Tag> {e.label}
              {e.detail && <div style={{ color: '#888', marginTop: 2 }}>{e.detail}</div>}
            </div>
          )),
        }] : []),
        ...(caseItem.consoleLogs.length > 0 ? [{
          key: 'console',
          label: `Console Logs (${caseItem.consoleLogs.length})`,
          children: caseItem.consoleLogs.map((e) => (
            <div key={e.id} style={{ fontSize: 12, marginBottom: 6, fontFamily: 'monospace' }}>
              <Tag style={{ fontSize: 10 }}>{e.kind}</Tag> {e.label}
              {e.detail && <div style={{ color: '#888', marginTop: 2 }}>{e.detail}</div>}
            </div>
          )),
        }] : []),
        ...(caseItem.stacks.length > 0 ? [{
          key: 'stack',
          label: `Stack Traces (${caseItem.stacks.length})`,
          children: caseItem.stacks.map((e) => (
            <pre key={e.id} style={{ fontSize: 11, margin: '4px 0', background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
              {e.detail || e.label}
            </pre>
          )),
        }] : []),
      ]}
    />
  );
}

/* ---------- 分析中: Findings + Comment ---------- */

function AnalyzingView({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { user, can } = useSession();
  const [comment, setComment] = useState('');
  const findings = caseItem.findings.filter((f) => f.isCurrent);

  const handleSendComment = async () => {
    if (!comment.trim() || findings.length === 0) return;
    await api.addFindingComment(caseItem.id, findings[0].id, comment, user.email);
    setComment('');
    await onRefresh();
  };

  return (
    <div>
      {findings.length === 0 ? (
        <Empty description="AI 分析中，暂无 Finding..." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {findings.map((f) => (
            <div key={f.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text strong>{f.findingKey}</Typography.Text>
                <Tag>{f.type}</Tag>
                <Tag color={f.analysisStatus === 'ACCEPTED' ? 'green' : 'default'}>
                  {f.analysisStatus === 'ACCEPTED' ? '已接受' : '草稿'}
                </Tag>
              </div>
              <Typography.Paragraph strong style={{ marginBottom: 8 }}>{f.title}</Typography.Paragraph>
              {f.currentRevision?.rootCause && (
                <div style={{ fontSize: 13 }}>
                  <Typography.Text type="secondary">Root Cause: </Typography.Text>
                  {f.currentRevision.rootCause}
                </div>
              )}
              {f.currentRevision && (
                <Progress
                  percent={Math.round(f.currentRevision.confidence * 100)}
                  size="small"
                  format={(pct) => `AI 置信度 ${pct}%`}
                  style={{ marginTop: 8 }}
                />
              )}
              {f.analysisStatus === 'DRAFT' && can('case.status.modify') && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button size="small" type="primary" onClick={async () => {
                    await api.acceptFinding(caseItem.id, f.id, user.email);
                    await onRefresh();
                  }}>
                    接受
                  </Button>
                  <Button size="small" onClick={async () => {
                    await api.reDiagnoseFinding(caseItem.id, f.id, user.email);
                    await onRefresh();
                  }}>
                    重新分析
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Divider style={{ margin: '16px 0 12px' }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        评论 ({findings.length > 0 ? findings[0].comments.length : 0})
      </Typography.Text>
      {findings.length > 0 && findings[0].comments.map((c) => (
        <div key={c.id} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: `2px solid ${palette.line}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color={c.authorType === 'USER' ? 'blue' : c.authorType === 'DEVIN' ? 'purple' : 'default'} style={{ fontSize: 11 }}>
              {c.authorType}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{fmtShort(c.createdAt)}</Typography.Text>
          </div>
          <Typography.Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>{c.content}</Typography.Paragraph>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Input.TextArea
          size="small"
          rows={2}
          placeholder="添加评论，辅助 AI 分析..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button size="small" type="primary" onClick={handleSendComment} disabled={!comment.trim()}>
          发送
        </Button>
      </div>
    </div>
  );
}

/* ---------- 分析完成: Finalized Findings ---------- */

function AnalysisDoneView({ caseItem }: { caseItem: CaseV2 }) {
  const findings = caseItem.findings.filter((f) => f.isCurrent);

  return (
    <div>
      {findings.length === 0 ? (
        <Empty description="暂无 Finding" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {findings.map((f) => (
            <div key={f.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: 14 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text strong>{f.findingKey}</Typography.Text>
                <Tag>{f.type}</Tag>
                <Tag color="green">已接受</Tag>
              </div>
              <Typography.Paragraph strong style={{ marginBottom: 8 }}>{f.title}</Typography.Paragraph>
              {f.currentRevision?.rootCause && (
                <div style={{ fontSize: 13 }}>
                  <Typography.Text type="secondary">Root Cause: </Typography.Text>
                  {f.currentRevision.rootCause}
                </div>
              )}
              {f.currentRevision && (
                <Progress
                  percent={Math.round(f.currentRevision.confidence * 100)}
                  size="small"
                  format={(pct) => `AI 置信度 ${pct}%`}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- 开发中: Findings + AutoFix + PRs ---------- */

function DevelopingView({
  caseItem,
  onRefresh,
}: {
  caseItem: CaseV2;
  onRefresh: () => Promise<void>;
}) {
  const { user, can } = useSession();
  const findings = caseItem.findings.filter((f) => f.isCurrent);
  const [registerPrFindingId, setRegisterPrFindingId] = useState<string>();
  const [prUrl, setPrUrl] = useState('');
  const [prSourceBranch, setPrSourceBranch] = useState('');
  const [prTargetBranch, setPrTargetBranch] = useState('main');

  const handleAutoFix = async (findingId: string) => {
    await api.triggerAutoFix(caseItem.id, findingId, user.email);
    await onRefresh();
  };

  const handleResolve = async (findingId: string, type: FindingResolutionType) => {
    await api.resolveFinding(caseItem.id, findingId, type, user.email);
    await onRefresh();
  };

  const handleRegisterPr = async (findingId: string) => {
    if (!prUrl.trim() || !prSourceBranch.trim()) return;
    await api.registerManualPullRequest(
      caseItem.id,
      findingId,
      { url: prUrl, sourceBranch: prSourceBranch, targetBranch: prTargetBranch },
      user.email,
    );
    setRegisterPrFindingId(undefined);
    setPrUrl('');
    setPrSourceBranch('');
    setPrTargetBranch('main');
    await onRefresh();
  };

  const handleAutoFixAll = async () => {
    const fixable = findings.filter((f) => f.analysisStatus === 'ACCEPTED' && !f.resolutionType);
    for (const f of fixable) {
      await api.resolveFinding(caseItem.id, f.id, 'AUTO_FIX', user.email);
    }
    for (const f of fixable) {
      await api.triggerAutoFix(caseItem.id, f.id, user.email);
    }
    await onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text strong>Findings ({findings.length})</Typography.Text>
        {can('case.status.modify') && findings.some((f) => f.analysisStatus === 'ACCEPTED' && !f.resolutionType) && (
          <Button size="small" type="primary" onClick={handleAutoFixAll}>
            Auto Fix All
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        {findings.map((f) => (
          <div key={f.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <Typography.Text strong>{f.findingKey}</Typography.Text>
              <Tag>{f.type}</Tag>
              {f.resolutionType && (
                <Tag color={f.resolutionType === 'AUTO_FIX' ? 'blue' : f.resolutionType === 'MANUAL_FIX' ? 'orange' : 'default'}>
                  {f.resolutionType === 'AUTO_FIX' ? '自动修复' : f.resolutionType === 'MANUAL_FIX' ? '人工修复' : '忽略'}
                </Tag>
              )}
            </div>
            <Typography.Paragraph strong style={{ marginBottom: 8 }}>{f.title}</Typography.Paragraph>
            {f.currentRevision?.rootCause && (
              <div style={{ fontSize: 13, marginBottom: 8 }}>
                <Typography.Text type="secondary">Root Cause: </Typography.Text>
                {f.currentRevision.rootCause}
              </div>
            )}

            {can('case.status.modify') && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {f.analysisStatus === 'ACCEPTED' && !f.resolutionType && (
                  <>
                    <Button size="small" type="primary" onClick={() => handleResolve(f.id, 'AUTO_FIX')}>
                      Auto Fix
                    </Button>
                    <Button size="small" onClick={() => handleResolve(f.id, 'MANUAL_FIX')}>
                      人工修复
                    </Button>
                    <Button size="small" onClick={() => handleResolve(f.id, 'IGNORE')}>
                      忽略
                    </Button>
                  </>
                )}
                {f.resolutionType === 'AUTO_FIX' && f.resolutionStatus === 'NOT_STARTED' && (
                  <Button size="small" type="primary" onClick={() => handleAutoFix(f.id)}>
                    触发 Auto Fix
                  </Button>
                )}
                {f.resolutionType === 'MANUAL_FIX' && f.pullRequests.length === 0 && (
                  registerPrFindingId === f.id ? (
                    <Button size="small" onClick={() => setRegisterPrFindingId(undefined)}>
                      取消
                    </Button>
                  ) : (
                    <Button size="small" type="primary" onClick={() => setRegisterPrFindingId(f.id)}>
                      登记 PR
                    </Button>
                  )
                )}
              </div>
            )}

            {registerPrFindingId === f.id && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
                <Input size="small" style={{ width: 220 }} placeholder="PR URL" value={prUrl} onChange={(e) => setPrUrl(e.target.value)} />
                <Input size="small" style={{ width: 110 }} placeholder="源分支" value={prSourceBranch} onChange={(e) => setPrSourceBranch(e.target.value)} />
                <Input size="small" style={{ width: 110 }} placeholder="目标分支" value={prTargetBranch} onChange={(e) => setPrTargetBranch(e.target.value)} />
                <Button size="small" type="primary" onClick={() => handleRegisterPr(f.id)}>
                  提交
                </Button>
              </div>
            )}

            {f.fixAttempts.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Fix Attempts ({f.fixAttempts.length})
                </Typography.Text>
                {f.fixAttempts.map((a) => (
                  <div key={a.id} style={{ fontSize: 12, marginTop: 4 }}>
                    <Tag>{a.executionStatus}</Tag>
                    <Typography.Text type="secondary">
                      #{a.attemptNo} · {a.provider} · {fmtShort(a.createdAt)}
                    </Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Divider style={{ margin: '16px 0 12px' }} />
      <PrList caseItem={caseItem} />
    </div>
  );
}

/* ---------- 部署中: PRs + Merge ---------- */

function DeployingView({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { can } = useSession();

  const handleMergeAll = async () => {
    await api.createMergeBatch(caseItem.id, 'system');
    await onRefresh();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text strong>Pull Requests ({caseItem.pullRequests.length})</Typography.Text>
        {can('case.status.modify') && caseItem.pullRequests.some((pr) => pr.state === 'OPEN') && (
          <Button size="small" type="primary" onClick={handleMergeAll}>
            Merge All
          </Button>
        )}
      </div>

      <PrList caseItem={caseItem} />

      {caseItem.mergeBatches.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0 12px' }} />
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            Merge Batches
          </Typography.Text>
          {caseItem.mergeBatches.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Tag color={b.status === 'COMPLETED' ? 'green' : b.status === 'FAILED' ? 'red' : 'blue'}>
                  {b.status}
                </Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {b.pullRequestResults.length} PRs · {fmtShort(b.createdAt)}
                </Typography.Text>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* ---------- 部署完成 ---------- */

function DeployedView({ caseItem }: { caseItem: CaseV2 }) {
  return (
    <div>
      <PrList caseItem={caseItem} />
      <Divider style={{ margin: '16px 0 12px' }} />
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        部署记录
      </Typography.Text>
      {caseItem.deploymentRuns.length === 0 ? (
        <Empty description="暂无部署记录" />
      ) : (
        caseItem.deploymentRuns.map((r) => (
          <div key={r.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag color={r.status === 'SUCCEEDED' ? 'green' : r.status === 'FAILED' ? 'red' : 'blue'}>
                {r.status}
              </Tag>
              <Typography.Text style={{ fontSize: 12 }}>
                #{r.attemptNo} · {r.environment} · {fmtShort(r.startedAt ?? '')}
              </Typography.Text>
              {r.url && (
                <Typography.Link href={r.url} target="_blank" style={{ fontSize: 12 }}>
                  查看
                </Typography.Link>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ---------- 待验证 ---------- */

function PendingVerificationView({ caseItem }: { caseItem: CaseV2 }) {
  return (
    <div>
      <Typography.Paragraph>
        部署已完成，等待用户 / Tester 在 Chrome 扩展端进行验证。
      </Typography.Paragraph>
      <PrList caseItem={caseItem} />
      <Divider style={{ margin: '16px 0 12px' }} />
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        部署记录
      </Typography.Text>
      {caseItem.deploymentRuns.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color={r.status === 'SUCCEEDED' ? 'green' : 'red'}>
              {r.status}
            </Tag>
            <Typography.Text style={{ fontSize: 12 }}>
              #{r.attemptNo} · {r.environment} · {fmtShort(r.startedAt ?? '')}
            </Typography.Text>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 已完成 ---------- */

function CompletedView({ caseItem }: { caseItem: CaseV2 }) {
  return (
    <div>
      <Typography.Paragraph strong style={{ color: '#39AD69' }}>
        Case 已关闭
      </Typography.Paragraph>
      {caseItem.verificationRecords.length > 0 && (
        <>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
            验证记录
          </Typography.Text>
          {caseItem.verificationRecords.map((v) => (
            <div key={v.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Tag color={v.result === 'PASSED' ? 'green' : 'red'}>
                  {v.result === 'PASSED' ? '通过' : '失败'}
                </Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {fmtShort(v.createdAt)}
                </Typography.Text>
              </div>
              {v.comment && (
                <Typography.Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {v.comment}
                </Typography.Paragraph>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/* =========================== Shared: PR List =========================== */

function PrList({ caseItem }: { caseItem: CaseV2 }) {
  if (caseItem.pullRequests.length === 0) {
    return <Empty description="暂无 PR" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {caseItem.pullRequests.map((pr) => (
        <div key={pr.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag color={pr.state === 'MERGED' ? 'green' : pr.state === 'OPEN' ? 'blue' : 'default'}>
                {pr.state}
              </Tag>
              <Typography.Link href={pr.url} target="_blank">
                #{pr.number}
              </Typography.Link>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {pr.sourceBranch} → {pr.targetBranch}
              </Typography.Text>
            </div>
            <Tag style={{ fontSize: 11 }}>{pr.originType}</Tag>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================== Workflow Buttons (Right Sidebar) =========================== */

function WorkflowButtons({
  caseItem,
  onStatusChange,
  onRefresh,
}: {
  caseItem: CaseV2;
  onStatusChange: (id: string, s: CaseStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { can, user } = useSession();

  if (!can('case.status.modify')) return null;

  const doTransition = async (next: CaseStatus) => {
    await onStatusChange(caseItem.id, next);
    await onRefresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 4 }}>
        Workflow
      </Typography.Text>

      {caseItem.status === 'PENDING_ANALYSIS' && (
        <Button type="primary" block onClick={() => doTransition('ANALYZING')}>
          开始分析
        </Button>
      )}

      {caseItem.status === 'ANALYZING' && (
        <Button type="primary" block onClick={() => doTransition('ANALYSIS_COMPLETED')}>
          分析完成
        </Button>
      )}

      {caseItem.status === 'ANALYSIS_COMPLETED' && (
        <Button type="primary" block onClick={() => doTransition('DEVELOPING')}>
          开始开发
        </Button>
      )}

      {caseItem.status === 'DEVELOPING' && (
        <Button type="primary" block onClick={() => doTransition('DEPLOYING')}>
          开始部署
        </Button>
      )}

      {caseItem.status === 'DEPLOYED' && (
        <Button type="primary" block onClick={() => doTransition('PENDING_VERIFICATION')}>
          进入验证
        </Button>
      )}

      {caseItem.status === 'PENDING_VERIFICATION' && (
        <>
          <Button type="primary" block onClick={() => doTransition('COMPLETED')}>
            验证通过
          </Button>
          <Button block danger onClick={() => doTransition('DEVELOPING')}>
            验证失败
          </Button>
        </>
      )}

      {caseItem.status === 'COMPLETED' && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Case 已关闭
        </Typography.Text>
      )}

      {caseItem.status === 'DEPLOYING' && (
        <Button block onClick={async () => {
          await api.completeUat(caseItem.id, user.email);
          await onRefresh();
        }}>
          UAT 部署完成
        </Button>
      )}
    </div>
  );
}
