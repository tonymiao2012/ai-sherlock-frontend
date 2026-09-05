import { App as AntApp, Button, Space, Table, Tag, Typography } from 'antd';
import { LinkOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import type { Ticket } from '../types';
import {
  ANALYSIS_REVIEW_META,
  FINDING_TYPE_META,
  FIX_STATUS_META,
  SEVERITY_META,
  UAT_META,
  stageOf,
} from '../domain/ticket';
import { fmtDay, timeAgo } from '../domain/format';
import { StageTag } from './StageTag';
import { useSession } from '../context/Session';
import * as api from '../services/api';
import { copyText } from '../services/jiraText';

interface Props {
  tickets: Ticket[];
  loading?: boolean;
  canApprove: boolean;
  showProject?: boolean;
  onApprove: (t: Ticket) => void;
  onReject: (t: Ticket) => void;
  onOpenCase: (t: Ticket) => void;
  onSyncRow?: (t: Ticket) => void;
}

/** §6.2 工单列表：详情留在 JIRA，中台只做列表、分析与跳转 */
export function TicketTable({
  tickets,
  loading,
  canApprove,
  showProject,
  onApprove,
  onReject,
  onOpenCase,
  onSyncRow,
}: Props) {
  const { message } = AntApp.useApp();
  const { userName, projects } = useSession();
  const [selected, setSelected] = useState<React.Key[]>([]);

  const columns = useMemo<ColumnsType<Ticket>>(() => {
    const cols: ColumnsType<Ticket> = [
      {
        title: 'JIRA',
        dataIndex: 'jiraKey',
        width: 122,
        render: (_, t) => (
          <Space size={4}>
            <Typography.Link href={t.jiraUrl} target="_blank" rel="noopener">
              {t.jiraKey}
            </Typography.Link>
            {t.drift && <Tag color="warning">待同步</Tag>}
          </Space>
        ),
      },
      {
        title: '标题',
        dataIndex: 'title',
        width: 460,
        render: (_, t) => (
          <div>
            <div className="ac-ticket__title">{t.title}</div>
            <div className="ac-meta" style={{ marginTop: 2 }}>
              <span style={{ color: SEVERITY_META[t.severity].color }}>{t.severity}</span>
              <span>{FINDING_TYPE_META[t.findingType].short}</span>
              <span>{t.environment}</span>
              <span>{t.service}</span>
            </div>
          </div>
        ),
      },
      {
        title: 'Assignee',
        dataIndex: 'assigneeId',
        width: 108,
        render: (_, t) => (
          <div>
            <div>{userName(t.assigneeId)}</div>
            {t.assigneeId !== t.defaultAssigneeId && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                转派自 {userName(t.defaultAssigneeId)}
              </Typography.Text>
            )}
          </div>
        ),
      },
      {
        title: 'LLM 分析',
        dataIndex: 'analysisReview',
        width: 82,
        render: (v: Ticket['analysisReview']) => <Tag>{ANALYSIS_REVIEW_META[v]}</Tag>,
      },
      {
        title: '阶段',
        key: 'stage',
        width: 96,
        defaultSortOrder: 'ascend',
        sorter: (a, b) => stageRank(a) - stageRank(b),
        render: (_, t) => <StageTag stage={stageOf(t)} />,
      },
      {
        title: '修复状态',
        dataIndex: ['fix', 'status'],
        width: 92,
        render: (v: Ticket['fix']['status'], t) => (
          <div>
            <div>{FIX_STATUS_META[v]}</div>
            {t.uat !== 'NONE' && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                UAT {UAT_META[t.uat]}
              </Typography.Text>
            )}
          </div>
        ),
      },
      {
        title: 'PR',
        dataIndex: ['fix', 'prUrl'],
        width: 52,
        render: (url?: string) =>
          url ? (
            <a href={url} target="_blank" rel="noopener" aria-label="打开 PR">
              <LinkOutlined />
            </a>
          ) : (
            <Typography.Text type="secondary">—</Typography.Text>
          ),
      },
      {
        title: 'Case',
        dataIndex: 'caseKey',
        width: 88,
        render: (_, t) => <Typography.Link onClick={() => onOpenCase(t)}>{t.caseKey}</Typography.Link>,
      },
      {
        title: '更新',
        dataIndex: 'updatedAt',
        width: 96,
        sorter: (a, b) => +new Date(a.updatedAt) - +new Date(b.updatedAt),
        render: (_, t) => (
          <div>
            <div>{fmtDay(t.createdAt)}</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {timeAgo(t.updatedAt)}
            </Typography.Text>
          </div>
        ),
      },
    ];

    if (showProject) {
      cols.splice(1, 0, {
        title: '项目',
        dataIndex: 'projectId',
        width: 88,
        render: (id: string) => projects.find((p) => p.id === id)?.name ?? '—',
      });
    }

    cols.push({
      title: '操作',
      key: 'ops',
      fixed: 'right',
      width: canApprove ? 196 : 148,
      render: (_, t) => {
        const analysable = t.analysisReview === 'DONE';
        return (
          <Space size={4} wrap={false}>
            {canApprove && (
              <>
                <Button size="small" type="link" disabled={!analysable} onClick={() => onApprove(t)}>
                  批准
                </Button>
                <Button size="small" type="link" danger disabled={!analysable} onClick={() => onReject(t)}>
                  拒绝
                </Button>
              </>
            )}
            <Button size="small" type="link" onClick={() => onOpenCase(t)}>
              证据
            </Button>
            {onSyncRow && (
              <Button size="small" type="text" icon={<SyncOutlined />} title="同步该工单的 JIRA 状态" onClick={() => onSyncRow(t)} />
            )}
          </Space>
        );
      },
    });
    return cols;
  }, [canApprove, showProject, projects, userName, onApprove, onReject, onOpenCase, onSyncRow]);

  return (
    <>
      {selected.length > 0 && (
        <div className="ac-tools" style={{ marginBottom: 10 }}>
          <Typography.Text type="secondary">已选 {selected.length} 条</Typography.Text>
          <Button
            size="small"
            onClick={async () => {
              const text = tickets
                .filter((t) => selected.includes(t.id))
                .map((t) => `${t.jiraKey}\t${t.jiraUrl}`)
                .join('\n');
              const ok = await copyText(text);
              message[ok ? 'success' : 'error'](ok ? `已复制 ${selected.length} 条 JIRA 链接` : '复制失败');
            }}
          >
            复制 JIRA 链接
          </Button>
        </div>
      )}
      <Table
        rowKey="id"
        size="small"
        loading={loading}
        columns={columns}
        dataSource={tickets}
        pagination={{ pageSize: 12, showSizeChanger: true, size: 'small' }}
        scroll={{ x: 1520 }}
        rowSelection={{ selectedRowKeys: selected, onChange: setSelected }}
        expandable={{
          expandedRowRender: (t) => <InlineFinding ticket={t} />,
          rowExpandable: () => true,
        }}
        onRow={(t) => ({
          onDoubleClick: () => window.open(t.jiraUrl, '_blank', 'noopener'),
        })}
      />
    </>
  );
}

const ORDER = ['ANALYZING', 'DEVELOPING', 'VERIFYING', 'DEPLOYING', 'DONE', 'REJECTED'] as const;

function stageRank(t: Ticket) {
  return ORDER.indexOf(stageOf(t));
}

/** 行内摘要面板：只给结论与置信度，完整证据在 Case 抽屉与 JIRA */
function InlineFinding({ ticket }: { ticket: Ticket }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getCase>>>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getCase(ticket.caseKey).then((c) => {
      if (!alive) return;
      setData(c);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ticket.caseKey]);

  const finding = data?.findings[0];
  return (
    <div style={{ paddingBlock: 4 }}>
      <div className="ac-meta" style={{ marginBottom: 6 }}>
        <span>
          证据链 <b>{data?.evidenceChain.map((n) => n.node).join(' → ') ?? '加载中…'}</b>
        </span>
        {loading ? (
          <Typography.Text type="secondary">Loading…</Typography.Text>
        ) : (
          <>
            <span>
              AI 置信度 <b>{finding?.aiConfidence}</b>
            </span>
            <span>
              验证状态 <b>{finding?.verificationStatus}</b>
            </span>
          </>
        )}
      </div>
      <Typography.Paragraph style={{ marginBottom: 4 }}>{finding?.rootCause ?? '分析进行中，暂无结论'}</Typography.Paragraph>
      {finding && (
        <Typography.Text type="secondary">涉及 {finding.locations.map((l) => l.file.split('/').pop()).join('、')}</Typography.Text>
      )}
    </div>
  );
}
