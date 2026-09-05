import { App as AntApp, Button, Descriptions, Drawer, Empty, Progress, Spin, Tabs, Tag, Timeline, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { Case, Ticket } from '../types';
import * as api from '../services/api';
import { buildJiraDescription, copyText } from '../services/jiraText';
import { FINDING_TYPE_META, SEVERITY_META, UAT_META, ANALYSIS_REVIEW_META, FIX_STATUS_META, stageOf } from '../domain/ticket';
import { StageSteps, StageTag } from './StageTag';
import { useSession } from '../context/Session';

interface Props {
  ticket?: Ticket;
  open: boolean;
  onClose: () => void;
  canApprove: boolean;
  onApprove: (ticket: Ticket) => void;
  onReject: (ticket: Ticket) => void;
}

/** §13.3 Case 详情：证据链只在中台留档，处理动作回到 JIRA */
export function CaseDrawer({ ticket, open, onClose, canApprove, onApprove, onReject }: Props) {
  const { message } = AntApp.useApp();
  const { projects, userName } = useSession();
  const [kase, setKase] = useState<Case>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !ticket) return;
    setLoading(true);
    api.getCase(ticket.caseKey).then((c) => {
      setKase(c);
      setLoading(false);
    });
  }, [open, ticket?.caseKey]);

  if (!ticket) return null;
  const project = projects.find((p) => p.id === ticket.projectId);
  const finding = kase?.findings[0];

  const actions = (
    <div className="ac-tools">
      {canApprove && ticket.analysisReview === 'DONE' && (
        <>
          <Button size="small" type="primary" onClick={() => onApprove(ticket)}>
            批准修复
          </Button>
          <Button size="small" danger onClick={() => onReject(ticket)}>
            拒绝
          </Button>
        </>
      )}
      <Button size="small" onClick={() => window.open(ticket.jiraUrl, '_blank', 'noopener')}>
        在 JIRA 中处理
      </Button>
    </div>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={760}
      title={
        <span className="ac-tools">
          <Typography.Text strong>{ticket.caseKey}</Typography.Text>
          <StageTag stage={stageOf(ticket)} />
        </span>
      }
      extra={<Typography.Text type="secondary" copyable={{ text: ticket.jiraKey }}>{ticket.jiraKey}</Typography.Text>}
    >
      <Spin spinning={loading}>
        <Typography.Paragraph style={{ marginTop: 0 }} strong>
          {ticket.title}
        </Typography.Paragraph>
        <StageSteps ticket={ticket} />

        <Descriptions
          size="small"
          column={2}
          style={{ marginBlock: 18 }}
          items={[
            { key: 'p', label: '项目', children: project?.name ?? '—' },
            { key: 's', label: '服务', children: ticket.service },
            { key: 'e', label: '环境', children: ticket.environment },
            { key: 'sv', label: '严重程度', children: SEVERITY_META[ticket.severity].label },
            { key: 't', label: '类型', children: FINDING_TYPE_META[ticket.findingType].label },
            { key: 'a', label: 'Assignee', children: `${userName(ticket.assigneeId)}（默认 ${userName(ticket.defaultAssigneeId)}）` },
            { key: 'an', label: '分析状态', children: ANALYSIS_REVIEW_META[ticket.analysisReview] },
            { key: 'f', label: '修复状态', children: FIX_STATUS_META[ticket.fix.status] },
            { key: 'u', label: 'UAT', children: UAT_META[ticket.uat] },
            { key: 'c', label: '创建 / 更新', children: `${fmt(ticket.createdAt)} · ${fmt(ticket.updatedAt)}` },
          ]}
        />

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
                    <Typography.Text code>{finding.locations.map((l) => `${l.file}:${l.line}`).join('\n')}</Typography.Text>
                  </Typography.Paragraph>
                  <Typography.Paragraph>
                    <Typography.Text type="secondary">建议修复</Typography.Text>
                    <br />
                    {finding.recommendedFix}
                  </Typography.Paragraph>
                  <Button
                    onClick={async () => {
                      const ok = await copyText(buildJiraDescription(ticket, kase!, project));
                      message[ok ? 'success' : 'error'](ok ? 'JIRA 描述已复制，粘贴到工单即可' : '复制失败，请手动选择文本');
                    }}
                  >
                    一键生成 JIRA 描述
                  </Button>
                </div>
              ) : (
                <Empty description="暂无诊断结论" />
              ),
            },
            {
              key: 'evidence',
              label: '证据链',
              children: kase ? (
                <div>
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
                    {kase.evidenceChain.map((n) => `${n.node}(${n.label})`).join(' → ')}
                  </Typography.Paragraph>
                  <EvidenceGroup title="Network" items={kase.network} />
                  <EvidenceGroup title="Console" items={kase.consoleLogs} />
                  <EvidenceGroup title="异常堆栈" items={kase.stacks} />
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      { key: 'url', label: '页面 URL', children: <Typography.Text copyable>{kase.pageUrl}</Typography.Text> },
                      { key: 'bv', label: 'Build Version', children: kase.buildVersion },
                      { key: 'rp', label: '上报人', children: kase.reporter },
                    ]}
                  />
                </div>
              ) : null,
            },
            {
              key: 'pipeline',
              label: '修复流水线',
              children: (
                <div>
                  <Timeline
                    items={ticket.fix.logs.map((l) => ({
                      color: l.actor === 'system' || l.actor === 'llm' ? 'blue' : 'green',
                      children: (
                        <div>
                          <Typography.Text strong>{l.message}</Typography.Text>
                          <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                            {l.actor} · {fmt(l.at)}
                          </Typography.Text>
                        </div>
                      ),
                    }))}
                  />
                  {ticket.fix.prUrl && (
                    <Typography.Paragraph>
                      PR：
                      <Typography.Link href={ticket.fix.prUrl} target="_blank">
                        {ticket.fix.prBranch}
                      </Typography.Link>
                      <Typography.Text type="secondary"> （Merge 在 Bitbucket 完成，中台不代操作）</Typography.Text>
                    </Typography.Paragraph>
                  )}
                </div>
              ),
            },
            {
              key: 'raw',
              label: '原始上报',
              children: (
                <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {kase?.description}
                  {'\n\n'}
                  {JSON.stringify(
                    { caseKey: ticket.caseKey, findingKey: ticket.findingKey, jiraKey: ticket.jiraKey, promptTokens: 1842, latencyMs: 38_600 },
                    null,
                    2,
                  )}
                </Typography.Paragraph>
              ),
            },
          ]}
        />
      </Spin>
      <div style={{ marginTop: 18 }}>{actions}</div>
    </Drawer>
  );
}

function EvidenceGroup({ title, items }: { title: string; items: { id: string; label: string; detail: string }[] }) {
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

function fmt(v: string) {
  if (!v) return '—';
  const d = new Date(v);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
