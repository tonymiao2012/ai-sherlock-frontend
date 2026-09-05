import { App as AntApp, Alert, Button, Card, Input, Modal, Select, Space, Switch, Tag, Typography } from 'antd';
import { ReloadOutlined, SyncOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Stage, SyncResult, Ticket } from '../types';
import * as api from '../services/api';
import { STAGE_META, stageOf } from '../domain/ticket';
import { fmtDateTime } from '../domain/format';
import { useSession } from '../context/Session';
import { TicketTable } from '../components/TicketTable';
import { CaseDrawer } from '../components/CaseDrawer';
import { StageLegend } from '../components/StageTag';

const STAGES: Stage[] = ['ANALYZING', 'DEVELOPING', 'VERIFYING', 'DEPLOYING', 'DONE', 'REJECTED'];

/**
 * §6 JIRA 看板：列表 + 阶段 + 审批入口。
 * meOnly 复用为「我的工单」（§3.6 DEVELOPER 落地页），只读并固定按当前登录人过滤。
 */
export function JiraBoardPage({ meOnly = false }: { meOnly?: boolean }) {
  const { message } = AntApp.useApp();
  const [params, setParams] = useSearchParams();
  const { user, visibleProjects, can, userName } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState<string | undefined>();
  const [stage, setStage] = useState<Stage>();
  const [keyword, setKeyword] = useState('');
  const [severity, setSeverity] = useState<Ticket['severity']>();
  const [type, setType] = useState<Ticket['findingType']>();
  const [assignee, setAssignee] = useState<string>();
  const [fresh, setFresh] = useState<'ALL' | '7' | '30'>('ALL');
  const [onlyDrift, setOnlyDrift] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>();
  const [syncResult, setSyncResult] = useState<SyncResult>();
  const [active, setActive] = useState<Ticket>();
  const [rejecting, setRejecting] = useState<Ticket>();
  const [reason, setReason] = useState('');

  useEffect(() => {
    const key = params.get('project');
    if (key) setProjectId(visibleProjects.find((p) => p.projectKey === key)?.id);
  }, [params, visibleProjects]);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await api.listTickets(meOnly ? undefined : visibleProjects.map((p) => p.id));
    setTickets(meOnly ? list.filter((t) => t.assigneeId === user.id) : list);
    setLoading(false);
  }, [visibleProjects, meOnly, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return tickets
      .filter((t) => (projectId ? t.projectId === projectId : true))
      .filter((t) => (stage ? stageOf(t) === stage : true))
      .filter((t) => (severity ? t.severity === severity : true))
      .filter((t) => (type ? t.findingType === type : true))
      .filter((t) => (assignee ? t.assigneeId === assignee : true))
      .filter((t) => (onlyDrift ? Boolean(t.drift) : true))
      .filter((t) => (fresh === 'ALL' ? true : Date.now() - +new Date(t.createdAt) < Number(fresh) * 86400000))
      .filter((t) => !kw || `${t.jiraKey}${t.title}${t.caseKey}${t.service}`.toLowerCase().includes(kw))
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [tickets, projectId, stage, severity, type, assignee, onlyDrift, fresh, keyword]);

  const counts = useMemo(() => {
    const map = new Map<Stage, number>();
    tickets.forEach((t) => {
      const s = stageOf(t);
      map.set(s, (map.get(s) ?? 0) + 1);
    });
    return map;
  }, [tickets]);

  const canApprove = can('ticket.approve', projectId ? visibleProjects.find((p) => p.id === projectId) : undefined);
  const assigneeOptions = useMemo(
    () => [...new Set(tickets.map((t) => t.assigneeId))].map((id) => ({ value: id, label: userName(id) })),
    [tickets, userName],
  );

  const sync = async (target?: Ticket) => {
    setSyncing(true);
    try {
      const result = await api.syncJiraStatus(projectId, user.email);
      setLastSync(result.at);
      setSyncResult(target ? { ...result, items: result.items.filter((i) => i.jiraKey === target.jiraKey), checked: 1 } : result);
      await load();
      if (result.changed === 0) message.info('JIRA 状态已是最新');
      else message.success(`同步完成，${result.changed} 条状态有变更`);
    } finally {
      setSyncing(false);
    }
  };

  const approve = async (t: Ticket) => {
    const next = await api.approveFix(t.id, user.email);
    setTickets((prev) => prev.map((x) => (x.id === t.id ? next : x)));
    message.success(`${t.jiraKey} 已批准，Fix Agent 已入队`);
  };

  const reject = async () => {
    if (!rejecting) return;
    const next = await api.rejectFix(rejecting.id, reason || '结论与现象不匹配', user.email);
    setTickets((prev) => prev.map((x) => (x.id === rejecting.id ? next : x)));
    setRejecting(undefined);
    setReason('');
    message.warning(`${rejecting.jiraKey} 已拒绝，JIRA 已回写评论`);
  };

  return (
    <Card
      variant="borderless"
      title={meOnly ? '我的工单' : 'JIRA 看板'}
      styles={{ body: { paddingTop: 14 } }}
      extra={
        <Space>
          {lastSync && (
            <Typography.Text type="secondary" className="ac-sync">
              上次同步 {fmtDateTime(lastSync)}
            </Typography.Text>
          )}
          <Button icon={<SyncOutlined spin={syncing} />} loading={syncing} onClick={() => sync()}>
            同步 JIRA 状态
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: 12 }}>
        {meOnly
          ? '这里只列分配给你的 JIRA 工单，处理动作（评论、流转、Merge）都在 JIRA / Bitbucket 完成。'
          : '工单详情以 JIRA 为准，中台只做列表、AI 分析与状态同步；自动同步走 Bitbucket Webhook，另每 5 分钟轮询兜底。'}
      </Typography.Paragraph>

      {syncResult && (
        <Alert
          style={{ marginBottom: 12 }}
          type={syncResult.changed ? 'success' : 'info'}
          showIcon
          closable
          onClose={() => setSyncResult(undefined)}
          message={`比对 ${syncResult.checked} 条，${syncResult.changed} 条变更，${syncResult.skipped} 条无变化`}
          description={
            syncResult.items.length ? (
              <div className="ac-sync">
                {syncResult.items.map((i) => (
                  <span key={i.jiraKey}>
                    <b>{i.jiraKey}</b> {i.from} → {i.to}
                  </span>
                ))}
              </div>
            ) : undefined
          }
        />
      )}

      {!meOnly && (
        <StageLegend />
      )}

      <div className="ac-stage-bar">
        {STAGES.map((s) => (
          <Tag.CheckableTag
            key={s}
            checked={stage === s}
            onChange={(checked) => setStage(checked ? s : undefined)}
          >
            <span style={{ color: STAGE_META[s].color }}>{STAGE_META[s].label}</span>
            <b style={{ marginLeft: 6 }}>{counts.get(s) ?? 0}</b>
          </Tag.CheckableTag>
        ))}
      </div>

      <Space wrap style={{ marginBottom: 12, width: '100%' }}>
        {!meOnly && (
          <Select
            style={{ width: 168 }}
            placeholder="全部项目"
            allowClear
            value={projectId}
            onChange={setProjectId}
            options={visibleProjects.map((p) => ({ value: p.id, label: p.name }))}
          />
        )}
        <Input
          allowClear
          style={{ width: 240 }}
          placeholder="搜索 JIRA Key / 标题 / Case"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select
          style={{ width: 130 }}
          placeholder="严重程度"
          allowClear
          value={severity}
          onChange={setSeverity}
          options={['Critical', 'Major', 'Minor'].map((v) => ({ value: v as Ticket['severity'], label: v }))}
        />
        <Select
          style={{ width: 128 }}
          placeholder="类型"
          allowClear
          value={type}
          onChange={setType}
          options={[
            { value: 'FRONTEND', label: '前端 FE' },
            { value: 'BACKEND', label: '后端 BE' },
            { value: 'INTEGRATION', label: '集成 INT' },
          ]}
        />
        <Select style={{ width: 130 }} placeholder="处理人" allowClear value={assignee} onChange={setAssignee} options={assigneeOptions} />
        <Select
          style={{ width: 116 }}
          value={fresh}
          onChange={setFresh}
          options={[
            { value: 'ALL', label: '全部时间' },
            { value: '7', label: '近 7 天' },
            { value: '30', label: '近 30 天' },
          ]}
        />
        <Space size={6}>
          <Switch size="small" checked={onlyDrift} onChange={setOnlyDrift} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            仅看与 JIRA 不一致
          </Typography.Text>
        </Space>
        <Button
          size="small"
          type="text"
          icon={<ReloadOutlined />}
          onClick={() => {
            setStage(undefined);
            setKeyword('');
            setSeverity(undefined);
            setType(undefined);
            setAssignee(undefined);
            setFresh('ALL');
            setOnlyDrift(false);
            setProjectId(undefined);
            setParams({}, { replace: true });
            load();
          }}
        >
          重置
        </Button>
      </Space>

      <TicketTable
        tickets={filtered}
        loading={loading}
        canApprove={!meOnly && canApprove}
        showProject={!projectId}
        onApprove={approve}
        onReject={setRejecting}
        onOpenCase={setActive}
        onSyncRow={can('ticket.sync') ? sync : undefined}
      />

      <CaseDrawer
        ticket={active}
        open={Boolean(active)}
        onClose={() => setActive(undefined)}
        canApprove={!meOnly && canApprove}
        onApprove={(t) => {
          setActive(undefined);
          approve(t);
        }}
        onReject={(t) => {
          setActive(undefined);
          setRejecting(t);
        }}
      />

      <Modal
        open={Boolean(rejecting)}
        title={`拒绝 ${rejecting?.jiraKey ?? ''} 的 AI 修复建议`}
        okText="确认拒绝并回写 JIRA"
        okButtonProps={{ danger: true }}
        onCancel={() => setRejecting(undefined)}
        onOk={reject}
      >
        <Typography.Paragraph type="secondary">拒绝原因会作为评论写回 JIRA，工单进入终态。</Typography.Paragraph>
        <Input.TextArea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="例如：根因判断与日志时间线不符，需人工排查" />
      </Modal>
    </Card>
  );
}
