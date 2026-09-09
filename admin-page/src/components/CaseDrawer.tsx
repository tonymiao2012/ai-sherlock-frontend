import {
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Progress,
  Steps,
  Tabs,
  Tag,
  Timeline,
  Typography,
} from 'antd';
import type {
  CaseStatus,
  CaseV2,
  Finding,
  FindingResolutionType,
} from '../types';
import { CASE_STATUS_META, getNextStatuses } from '../domain/caseLifecycle';
import { SEVERITY_META } from '../domain/ticket';
import { palette } from '../theme';
import { CaseStatusTag } from './CaseStatusTag';
import { useSession } from '../context/Session';
import * as api from '../services/api';
import { fmtShort } from '../domain/format';
import { useState } from 'react';

interface Props {
  caseItem?: CaseV2;
  open: boolean;
  onClose: () => void;
  onStatusChange: (caseId: string, newStatus: CaseStatus) => Promise<void>;
  onCaseUpdate?: (updated: CaseV2) => void;
}

export function CaseDrawer({ caseItem, open, onClose, onStatusChange, onCaseUpdate }: Props) {
  const { projects, userName } = useSession();

  if (!caseItem) return null;

  const project = projects.find((p) => p.id === caseItem.projectId);

  const refresh = async () => {
    const updated = await api.getCaseV2(caseItem.id);
    if (updated && onCaseUpdate) onCaseUpdate(updated);
  };

  const statusSteps = (['PENDING_ANALYSIS', 'ANALYZING', 'ANALYSIS_COMPLETED', 'DEVELOPING', 'DEPLOYING', 'DEPLOYED', 'PENDING_VERIFICATION', 'COMPLETED'] as CaseStatus[]);
  const currentStep = statusSteps.indexOf(caseItem.status);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={820}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Text strong>{caseItem.caseKey}</Typography.Text>
          <CaseStatusTag status={caseItem.status} />
        </span>
      }
    >
      <Typography.Paragraph style={{ marginTop: 0 }} strong>
        {caseItem.title}
      </Typography.Paragraph>

      <Tabs
        defaultActiveKey="overview"
        items={[
          {
            key: 'overview',
            label: '概览',
            children: (
              <>
                <Steps
                  size="small"
                  current={currentStep}
                  style={{ marginBottom: 24 }}
                  items={statusSteps.map((s) => ({ title: CASE_STATUS_META[s]?.label ?? s }))}
                />

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
                    { key: 'cycle', label: 'Cycle', children: `#${caseItem.currentCycle?.cycleNo ?? 1}` },
                  ]}
                />

                <StatusActions caseItem={caseItem} onStatusChange={onStatusChange} onRefresh={refresh} />

                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                  页面 URL：{caseItem.pageUrl}
                </Typography.Text>
                <Typography.Paragraph type="secondary">{caseItem.description}</Typography.Paragraph>
              </>
            ),
          },
          {
            key: 'findings',
            label: `Findings (${caseItem.findings.length})`,
            children: <FindingsTab caseItem={caseItem} onRefresh={refresh} />,
          },
          {
            key: 'prs',
            label: `PR & 部署 (${caseItem.pullRequests.length})`,
            children: <PrDeployTab caseItem={caseItem} onRefresh={refresh} />,
          },
          {
            key: 'history',
            label: '运行历史',
            children: <HistoryTab caseItem={caseItem} />,
          },
        ]}
      />
    </Drawer>
  );
}

/* =========================== Status Actions =========================== */

function StatusActions({
  caseItem,
  onStatusChange,
  onRefresh,
}: {
  caseItem: CaseV2;
  onStatusChange: (id: string, s: CaseStatus) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const { can, userName: _un } = useSession();

  const handleTriggerDiagnosis = async () => {
    await api.triggerDiagnosis(caseItem.id, 'system');
    await onRefresh();
  };

  const handleMergeAll = async () => {
    await api.createMergeBatch(caseItem.id, 'system');
    await onRefresh();
  };

  const handleRetryDeploy = async () => {
    await api.retryDeployment(caseItem.id, 'system');
    await onRefresh();
  };

  const handleCompleteUat = async () => {
    await api.completeUat(caseItem.id, 'system');
    await onRefresh();
  };

  if (!can('case.status.modify')) return null;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {caseItem.status === 'PENDING_ANALYSIS' && (
        <Button type="primary" size="small" onClick={handleTriggerDiagnosis}>
          开始 AI 分析
        </Button>
      )}
      {caseItem.status === 'DEVELOPING' && caseItem.pullRequests.some((pr) => pr.state === 'OPEN') && (
        <Button type="primary" size="small" onClick={handleMergeAll}>
          Merge All
        </Button>
      )}
      {caseItem.status === 'DEPLOY_FAILED' && (
        <Button type="primary" size="small" danger onClick={handleRetryDeploy}>
          重试部署
        </Button>
      )}
      {caseItem.status === 'DEPLOYING' && (
        <Button size="small" onClick={handleCompleteUat}>
          UAT 部署完成
        </Button>
      )}
      {caseItem.status === 'DEPLOYED' && (
        <Button size="small" onClick={() => onStatusChange(caseItem.id, 'PENDING_VERIFICATION')}>
          进入验证
        </Button>
      )}
      {getNextStatuses(caseItem.status)
        .filter((s) => !['PENDING_VERIFICATION', 'DEPLOYING'].includes(s))
        .map((s) => (
          <Button key={s} size="small" onClick={() => onStatusChange(caseItem.id, s)}>
            → {CASE_STATUS_META[s]?.label ?? s}
          </Button>
        ))}
    </div>
  );
}

/* =========================== Findings Tab =========================== */

function FindingsTab({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { can, user } = useSession();
  const [registerPrFindingId, setRegisterPrFindingId] = useState<string>();
  const [prUrl, setPrUrl] = useState('');
  const [prSourceBranch, setPrSourceBranch] = useState('');
  const [prTargetBranch, setPrTargetBranch] = useState('main');

  const currentFindings = caseItem.findings.filter((f) => f.isCurrent);

  const handleAccept = async (findingId: string) => {
    await api.acceptFinding(caseItem.id, findingId, user.email);
    await onRefresh();
  };

  const handleResolve = async (findingId: string, type: FindingResolutionType) => {
    await api.resolveFinding(caseItem.id, findingId, type, user.email);
    await onRefresh();
  };

  const handleAutoFix = async (findingId: string) => {
    await api.triggerAutoFix(caseItem.id, findingId, user.email);
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

  if (currentFindings.length === 0) {
    return (
      <Empty
        description={
          caseItem.status === 'PENDING_ANALYSIS'
            ? '请先启动 AI 分析'
            : caseItem.status === 'ANALYZING'
              ? '分析进行中...'
              : '暂无 Finding'
        }
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {currentFindings.map((f) => (
        <div key={f.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
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
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {f.source}
            </Typography.Text>
          </div>

          <Typography.Paragraph strong>{f.title}</Typography.Paragraph>

          <Typography.Paragraph>
            <Typography.Text type="secondary">Root Cause</Typography.Text>
            <br />
            {f.currentRevision?.rootCause}
          </Typography.Paragraph>

          {f.currentRevision && (
            <Progress
              percent={Math.round(f.currentRevision.confidence * 100)}
              size="small"
              format={(pct) => `AI 置信度 ${pct}%`}
              style={{ marginBottom: 12 }}
            />
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {f.analysisStatus === 'DRAFT' && can('case.status.modify') && (
              <>
                <Button size="small" type="primary" onClick={() => handleAccept(f.id)}>
                  接受
                </Button>
                <Button
                  size="small"
                  onClick={async () => {
                    await api.reDiagnoseFinding(caseItem.id, f.id, user.email);
                    await onRefresh();
                  }}
                >
                  重新分析
                </Button>
              </>
            )}
            {f.analysisStatus === 'ACCEPTED' && !f.resolutionType && can('case.status.modify') && (
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
            {f.resolutionType === 'AUTO_FIX' && f.resolutionStatus === 'NOT_STARTED' && can('case.status.modify') && (
              <Button size="small" type="primary" onClick={() => handleAutoFix(f.id)}>
                触发 Auto Fix
              </Button>
            )}
            {f.resolutionType === 'MANUAL_FIX' && f.pullRequests.length === 0 && can('case.status.modify') && (
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

          {registerPrFindingId === f.id && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
              <Input
                size="small"
                style={{ width: 240 }}
                placeholder="PR URL"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
              />
              <Input
                size="small"
                style={{ width: 120 }}
                placeholder="源分支"
                value={prSourceBranch}
                onChange={(e) => setPrSourceBranch(e.target.value)}
              />
              <Input
                size="small"
                style={{ width: 120 }}
                placeholder="目标分支"
                value={prTargetBranch}
                onChange={(e) => setPrTargetBranch(e.target.value)}
              />
              <Button size="small" type="primary" onClick={() => handleRegisterPr(f.id)}>
                提交
              </Button>
            </div>
          )}

          {f.fixAttempts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
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

          <CommentThread caseItem={caseItem} finding={f} onRefresh={onRefresh} />
        </div>
      ))}
    </div>
  );
}

/* =========================== Comment Thread =========================== */

function CommentThread({
  caseItem,
  finding,
  onRefresh,
}: {
  caseItem: CaseV2;
  finding: Finding;
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
    <div style={{ marginTop: 12 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
        评论 ({finding.comments.length})
      </Typography.Text>
      {finding.comments.map((c) => (
        <div key={c.id} style={{ marginBottom: 8, paddingLeft: 8, borderLeft: `2px solid ${palette.line}` }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag
              color={c.authorType === 'USER' ? 'blue' : c.authorType === 'DEVIN' ? 'purple' : 'default'}
              style={{ fontSize: 11 }}
            >
              {c.authorType}
            </Tag>
            <Typography.Text type="secondary" style={{ fontSize: 11 }}>
              {fmtShort(c.createdAt)}
            </Typography.Text>
          </div>
          <Typography.Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>{c.content}</Typography.Paragraph>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Input.TextArea
          size="small"
          rows={2}
          placeholder="添加评论..."
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

/* =========================== PR & Deploy Tab =========================== */

function PrDeployTab({ caseItem, onRefresh }: { caseItem: CaseV2; onRefresh: () => Promise<void> }) {
  const { user } = useSession();

  const handleRegisterPr = async () => {
    const url = window.prompt('PR URL:');
    if (!url) return;
    await api.registerManualPullRequest(
      caseItem.id,
      caseItem.findings[0]?.id ?? '',
      { url, sourceBranch: `fix/${caseItem.caseKey}`, targetBranch: 'main' },
      user.email,
    );
    await onRefresh();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Text strong>Pull Requests</Typography.Text>
        <Button size="small" onClick={handleRegisterPr}>
          登记 Manual PR
        </Button>
      </div>

      {caseItem.pullRequests.length === 0 ? (
        <Empty description="暂无 PR" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
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
        <div style={{ marginBottom: 24 }}>
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
        </div>
      )}

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        部署记录
      </Typography.Text>
      {caseItem.deploymentRuns.length === 0 ? (
        <Empty description="暂无部署" />
      ) : (
        caseItem.deploymentRuns.map((r) => (
          <div key={r.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag
                color={r.status === 'SUCCEEDED' ? 'green' : r.status === 'FAILED' ? 'red' : 'blue'}
              >
                {r.status}
              </Tag>
              <Typography.Text style={{ fontSize: 12 }}>
                #{r.attemptNo} · {r.environment}
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
    </>
  );
}

/* =========================== History Tab =========================== */

function HistoryTab({ caseItem }: { caseItem: CaseV2 }) {
  const diagnosisLabels: Record<string, string> = {
    QUEUED: '排队中',
    RUNNING: '运行中',
    COMPLETED: '完成',
    FAILED: '失败',
    CANCELLED: '已取消',
  };

  return (
    <>
      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        诊断记录
      </Typography.Text>
      {caseItem.diagnosisRuns.length === 0 ? (
        <Empty description="暂无诊断记录" />
      ) : (
        <Timeline
          style={{ marginBottom: 24 }}
          items={caseItem.diagnosisRuns.map((r) => ({
            color: r.status === 'COMPLETED' ? 'green' : r.status === 'FAILED' ? 'red' : 'blue',
            children: (
              <div>
                <Tag>{diagnosisLabels[r.status] ?? r.status}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.mode} · {r.provider} · {fmtShort(r.createdAt)}
                </Typography.Text>
              </div>
            ),
          }))}
        />
      )}

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        验证记录
      </Typography.Text>
      {caseItem.verificationRecords.length === 0 ? (
        <Empty description="暂无验证记录" />
      ) : (
        caseItem.verificationRecords.map((v) => (
          <div key={v.id} style={{ border: `1px solid ${palette.line}`, borderRadius: 6, padding: '8px 12px', marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Tag color={v.result === 'PASSED' ? 'green' : 'red'}>{v.result === 'PASSED' ? '通过' : '失败'}</Tag>
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
        ))
      )}
    </>
  );
}
