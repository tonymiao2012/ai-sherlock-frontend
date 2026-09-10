import {
  Button,
  Card,
  Collapse,
  Descriptions,
  Divider,
  Empty,
  Input,
  Modal,
  Progress,
  Select,
  Space,
  Steps,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type {
  CaseStatus,
  CaseV2,
  Evidence,
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

/** Workflow 下拉框选项（按当前状态） */
function transitionOptions(status: CaseStatus): { value: CaseStatus; label: string }[] {
  switch (status) {
    case 'PENDING_ANALYSIS':
      return [{ value: 'ANALYZING', label: '分析中' }];
    case 'ANALYZING':
      return [{ value: 'ANALYSIS_COMPLETED', label: '分析结束' }];
    case 'ANALYSIS_COMPLETED':
      return [
        { value: 'DEVELOPING', label: '开发中' },
        { value: 'PENDING_VERIFICATION', label: '待验证（全部忽略）' },
      ];
    case 'DEVELOPING':
      return [{ value: 'DEPLOYING', label: '部署中' }];
    case 'DEPLOYING':
      return [
        { value: 'DEPLOYED', label: '部署完成' },
        { value: 'DEPLOY_FAILED', label: '部署失败' },
      ];
    case 'DEPLOY_FAILED':
      return [{ value: 'DEPLOYING', label: '重试部署' }];
    case 'DEPLOYED':
      return [{ value: 'PENDING_VERIFICATION', label: '待验证' }];
    case 'PENDING_VERIFICATION':
      return [
        { value: 'COMPLETED', label: '验证通过' },
        { value: 'PENDING_ANALYSIS', label: '验证失败，重新分析' },
      ];
    case 'COMPLETED':
      return [];
  }
}

interface Props {
  caseItem?: CaseV2;
  open: boolean;
  onClose: () => void;
  onStatusChange: (caseId: string, newStatus: CaseStatus) => Promise<void>;
  onCaseUpdate?: (updated: CaseV2) => void;
}

export function CaseDetailModal({ caseItem, open, onClose, onStatusChange, onCaseUpdate }: Props) {
  const { projects, userName, can } = useSession();

  if (!caseItem) return null;

  const project = projects.find((p) => p.id === caseItem.projectId);
  const currentStep = STATUS_STEPS.indexOf(caseItem.status);

  const refresh = async () => {
    const updated = await api.getCaseV2(caseItem.id);
    if (updated && onCaseUpdate) onCaseUpdate(updated);
  };

  const findings = caseItem.findings.filter((f) => f.isCurrent);
  const s = caseItem.status;

  const sections: { key: string; label: string; children: React.ReactNode }[] = [
    {
      key: 'report',
      label: '问题报告',
      children: <ReportSection caseItem={caseItem} project={project} userName={userName} />,
    },
    ...(findings.length > 0 || s === 'ANALYZING'
      ? [{
          key: 'findings',
          label: `Findings (${findings.length})`,
          children: <FindingsSection caseItem={caseItem} onRefresh={refresh} />,
        }]
      : []),
    ...(caseItem.pullRequests.length > 0 || caseItem.mergeBatches.length > 0
      ? [{
          key: 'prs',
          label: `Pull Requests (${caseItem.pullRequests.length})`,
          children: <PrsSection caseItem={caseItem} onRefresh={refresh} />,
        }]
      : []),
    ...(caseItem.deploymentRuns.length > 0
      ? [{
          key: 'deployments',
          label: `部署记录 (${caseItem.deploymentRuns.length})`,
          children: <DeploymentsSection caseItem={caseItem} />,
        }]
      : []),
    ...(caseItem.verificationRecords.length > 0
      ? [{
          key: 'verification',
          label: `验证记录 (${caseItem.verificationRecords.length})`,
          children: <VerificationSection caseItem={caseItem} />,
        }]
      : []),
  ];

  const defaultActive =
    s === 'PENDING_ANALYSIS' ? ['report']
    : s === 'ANALYZING' || s === 'ANALYSIS_COMPLETED' ? ['report', 'findings']
    : s === 'DEVELOPING' ? ['findings', 'prs']
    : s === 'DEPLOYING' || s === 'DEPLOY_FAILED' ? ['prs']
    : s === 'DEPLOYED' || s === 'PENDING_VERIFICATION' ? ['deployments']
    : ['verification'];

  const options = transitionOptions(s);
  const canModify = can('case.status.modify');

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      centered
      styles={{
        body: { height: '75vh', overflow: 'auto', padding: '16px 24px' },
        header: { padding: '24px 24px 8px' },
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Typography.Text strong style={{ flexShrink: 0 }}>{caseItem.caseKey}</Typography.Text>
            <Typography.Text ellipsis style={{ flex: 1 }}>
              - {caseItem.title}
            </Typography.Text>
            <CaseStatusTag status={caseItem.status} />
          </span>
          <Select<CaseStatus>
            style={{ width: 200, flexShrink: 0 }}
            value={s}
            disabled={!canModify || options.length === 0}
            onChange={(next) => onStatusChange(caseItem.id, next).then(refresh)}
            options={[
              { value: s, label: CASE_STATUS_META[s]?.label ?? s, disabled: true },
              ...options.map((o) => ({ value: o.value, label: `→ ${o.label}` })),
            ]}
          />
        </div>
      }
    >
      <div
        style={{
          position: 'sticky',
          top: -16,
          zIndex: 10,
          background: '#fff',
          margin: '-16px -24px 20px',
          padding: '16px 24px 12px',
          borderBottom: `1px solid ${palette.line}`,
        }}
      >
        <Steps
          size="small"
          current={currentStep}
          items={STATUS_STEPS.map((st) => ({ title: CASE_STATUS_META[st]?.label ?? st }))}
        />
      </div>

      <Collapse
        key={s}
        defaultActiveKey={defaultActive}
        items={sections}
      />
    </Modal>
  );
}

/* =========================== 问题报告 =========================== */

function ReportSection({
  caseItem,
  project,
  userName,
}: {
  caseItem: CaseV2;
  project?: { id: string; name: string };
  userName: (id: string) => string;
}) {
  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <Tabs
        style={{ flex: 1, minWidth: 0 }}
        defaultActiveKey="overview"
        items={[
          { key: 'overview', label: 'Overview', children: <OverviewTab caseItem={caseItem} /> },
          {
            key: 'shots',
            label: `Screenshots(${caseItem.screenshotCount})`,
            children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无截图数据" />,
          },
          {
            key: 'network',
            label: `Network(${caseItem.network.length})`,
            children: <EvidenceList entries={caseItem.network} empty="No network logs" />,
          },
          {
            key: 'console',
            label: `Console(${caseItem.consoleLogs.length})`,
            children: <EvidenceList entries={caseItem.consoleLogs} empty="No console logs" />,
          },
          {
            key: 'stacks',
            label: `Error stacks(${caseItem.stacks.length})`,
            children: <StackList entries={caseItem.stacks} />,
          },
          {
            key: 'replay',
            label: `Replay(${caseItem.replayEventCount})`,
            children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无回放数据" />,
          },
        ]}
      />

      <div
        style={{
          width: 240,
          flexShrink: 0,
          fontSize: 13,
          lineHeight: 2.1,
          borderLeft: `1px solid ${palette.line}`,
          paddingLeft: 20,
        }}
      >
        {([
          ['项目', project?.name ?? '—'],
          ['环境', caseItem.environment],
          ['严重程度', SEVERITY_META[caseItem.severity]?.label ?? caseItem.severity],
          ['负责人', caseItem.assigneeId ? userName(caseItem.assigneeId) : '未分配'],
          ['上报人', caseItem.reporter],
          ['上报时间', fmtShort(caseItem.reportedAt)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} style={{ wordBreak: 'break-all' }}>
            <span style={{ color: palette.muted }}>{k}：</span>
            {v}
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ caseItem }: { caseItem: CaseV2 }) {
  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Card size="small" title="Issue">
        <Descriptions column={1} size="small" items={[
          { key: 'title', label: 'Title', children: caseItem.title },
          { key: 'desc', label: 'Description', children: caseItem.description },
          { key: 'status', label: 'Status', children: <CaseStatusTag status={caseItem.status} /> },
        ]} />
      </Card>

      <Card size="small" title="Page context">
        <Descriptions column={1} size="small" items={[
          { key: 'url', label: 'URL', children: <span style={{ wordBreak: 'break-all' }}>{caseItem.pageUrl}</span> },
          { key: 'route', label: 'Route', children: caseItem.pageContext.route },
          { key: 'ptitle', label: 'Title', children: caseItem.pageContext.title },
          { key: 'viewport', label: 'Viewport', children: caseItem.pageContext.viewport },
          { key: 'lang', label: 'Language', children: caseItem.pageContext.language },
          { key: 'submitted', label: 'Submitted at', children: caseItem.pageContext.submittedAt },
          { key: 'ua', label: 'UA', children: <span style={{ wordBreak: 'break-all' }}>{caseItem.pageContext.userAgent}</span> },
        ]} />
      </Card>

      <Card size="small" title="Evidence">
        <Space wrap>
          <Tag color="blue">Screenshots {caseItem.screenshotCount}</Tag>
          <Tag color="blue">Network {caseItem.network.length}</Tag>
          <Tag color="orange">Console {caseItem.consoleLogs.length}</Tag>
          <Tag color="red">Stacks {caseItem.stacks.length}</Tag>
          <Tag color="purple">Replay events {caseItem.replayEventCount}</Tag>
        </Space>
      </Card>
    </Space>
  );
}

function EvidenceList({ entries, empty }: { entries: Evidence[]; empty: string }) {
  if (entries.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={empty} />;
  return (
    <div>
      {entries.map((e) => (
        <div key={e.id} style={{ fontSize: 12, marginBottom: 6, fontFamily: 'monospace' }}>
          <Tag style={{ fontSize: 10 }}>{e.kind}</Tag> {e.label}
          {e.detail && <div style={{ color: '#888', marginTop: 2 }}>{e.detail}</div>}
        </div>
      ))}
    </div>
  );
}

function StackList({ entries }: { entries: Evidence[] }) {
  if (entries.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No uncaught errors" />;
  return (
    <div>
      {entries.map((e) => (
        <pre key={e.id} style={{ fontSize: 11, margin: '4px 0', background: '#f5f5f5', padding: 8, borderRadius: 4, overflow: 'auto' }}>
          {e.detail || e.label}
        </pre>
      ))}
    </div>
  );
}

/* =========================== Findings =========================== */

function FindingsSection({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { user, can } = useSession();
  const [registerPrFindingId, setRegisterPrFindingId] = useState<string>();
  const [prUrl, setPrUrl] = useState('');
  const [prSourceBranch, setPrSourceBranch] = useState('');
  const [prTargetBranch, setPrTargetBranch] = useState('main');

  const findings = caseItem.findings.filter((f) => f.isCurrent);
  const s = caseItem.status;
  const canModify = can('case.status.modify');

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

  if (findings.length === 0) {
    return <Empty description="AI 分析中，暂无 Finding..." />;
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {findings.map((f) => (
          <div key={f.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <Typography.Text strong>{f.findingKey}</Typography.Text>
              <Tag>{f.type}</Tag>
              <Tag color={f.analysisStatus === 'ACCEPTED' ? 'green' : 'default'}>
                {f.analysisStatus === 'ACCEPTED' ? '已接受' : '草稿'}
              </Tag>
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
            {f.currentRevision && (
              <Progress
                percent={Math.round(f.currentRevision.confidence * 100)}
                size="small"
                format={(pct) => `AI 置信度 ${pct}%`}
                style={{ marginBottom: 8, maxWidth: 320 }}
              />
            )}

            {canModify && s === 'ANALYZING' && f.analysisStatus === 'DRAFT' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

            {canModify && s === 'DEVELOPING' && (
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
                  <Button size="small" type="primary" onClick={async () => {
                    await api.triggerAutoFix(caseItem.id, f.id, user.email);
                    await onRefresh();
                  }}>
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

      <CommentThread caseItem={caseItem} finding={findings[0]} onRefresh={onRefresh} />
    </div>
  );
}

function CommentThread({
  caseItem,
  finding,
  onRefresh,
}: {
  caseItem: CaseV2;
  finding: { id: string; comments: { id: string; authorType: string; createdAt: string; content: string }[] };
  onRefresh: () => Promise<void>;
}) {
  const { user } = useSession();
  const [text, setText] = useState('');

  const handleSend = async () => {
    if (!text.trim()) return;
    await api.addFindingComment(caseItem.id, finding.id, text, user.email);
    setText('');
    await onRefresh();
  };

  return (
    <div style={{ marginTop: 16 }}>
      <Divider style={{ margin: '0 0 12px' }} />
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        评论 ({finding.comments.length})
      </Typography.Text>
      {finding.comments.map((c) => (
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ flex: 1 }}
        />
        <Button size="small" type="primary" onClick={handleSend} disabled={!text.trim()}>
          发送
        </Button>
      </div>
    </div>
  );
}

/* =========================== Pull Requests =========================== */

function PrsSection({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { can } = useSession();

  const handleMergeAll = async () => {
    await api.createMergeBatch(caseItem.id, 'system');
    await onRefresh();
  };

  return (
    <div>
      {can('case.status.modify') && caseItem.status === 'DEPLOYING' && caseItem.pullRequests.some((pr) => pr.state === 'OPEN') && (
        <div style={{ marginBottom: 12 }}>
          <Button size="small" type="primary" onClick={handleMergeAll}>
            Merge All
          </Button>
        </div>
      )}

      {caseItem.pullRequests.length === 0 ? (
        <Empty description="暂无 PR" />
      ) : (
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
      )}

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

/* =========================== 部署记录 =========================== */

function DeploymentsSection({ caseItem }: { caseItem: CaseV2 }) {
  if (caseItem.deploymentRuns.length === 0) {
    return <Empty description="暂无部署记录" />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {caseItem.deploymentRuns.map((r) => (
        <div key={r.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px' }}>
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
      ))}
    </div>
  );
}

/* =========================== 验证记录 =========================== */

function VerificationSection({ caseItem }: { caseItem: CaseV2 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {caseItem.verificationRecords.map((v) => (
        <div key={v.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px' }}>
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
    </div>
  );
}
