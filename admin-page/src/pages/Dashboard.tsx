import { Button, Card, Col, Empty, List, Progress, Row, Space, Statistic, Table, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DashboardOverview, Stage, Ticket } from '../types';
import * as api from '../services/api';
import { STAGE_META, stageOf } from '../domain/ticket';
import { timeAgo } from '../domain/format';
import { StageTag } from '../components/StageTag';
import { useSession } from '../context/Session';

/** §4.2 Dashboard：指标随身份收敛，Owner 只看自己项目，Admin 看全局 */
export function DashboardPage() {
  const nav = useNavigate();
  const { user, visibleProjects, can } = useSession();
  const [data, setData] = useState<DashboardOverview>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const scoped = user.role === 'ADMIN' ? undefined : visibleProjects.map((p) => p.id);

  useEffect(() => {
    setData(undefined);
    Promise.all([api.getDashboardOverview(scoped), api.listTickets(scoped)]).then(([o, t]) => {
      setData(o);
      setTickets(t.filter((x) => (scoped ? scoped.includes(x.projectId) : true)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, visibleProjects.length]);

  const pending = useMemo(() => tickets.filter((t) => t.analysisReview === 'DONE'), [tickets]);
  const maxTrend = Math.max(...(data?.trend.map((t) => t.case) ?? [1]), 1);

  const kpis = [
    { title: '本周 Case 总数', value: data?.weeklyCases.value ?? 0, suffix: '', delta: data?.weeklyCases.delta, detail: '插件上报，按项目去重' },
    { title: 'AI 诊断成功率', value: data?.diagnosisRate.value ?? 0, suffix: '%', delta: data?.diagnosisRate.delta, detail: 'COMPLETED / TOTAL Run' },
    { title: '平均诊断耗时', value: data?.avgDuration.value ?? 0, suffix: 's', delta: data?.avgDuration.delta, detail: '提交到 Finding 产出' },
    { title: '自动修复成功率', value: data?.autoFixRate.value ?? 0, suffix: '%', delta: data?.autoFixRate.delta, detail: 'PR Merged / PR Created' },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text type="secondary">
            {user.name}（
            {user.role === 'ADMIN' ? '系统管理员 · 全局视角' : user.role === 'OWNER' ? `Group Owner · ${visibleProjects.length} 个项目` : 'Staff · 只读'}
            ）
          </Typography.Text>
          {can('case.status.modify') && pending.length > 0 && (
            <Button size="small" type="link" onClick={() => nav('/tickets')} icon={<RightOutlined />}>
              {pending.length} 条待审批修复
            </Button>
          )}
        </Space>
      </Col>

      {kpis.map((k) => (
        <Col key={k.title} xs={24} sm={12} xl={6}>
          <Card variant="borderless">
            <Statistic
              title={k.title}
              value={k.value}
              suffix={
                <>
                  {k.suffix}
                  {k.delta !== undefined && k.delta !== 0 && (
                    <span className={`ac-kpi__delta ${k.delta > 0 ? 'is-up' : 'is-down'}`}>
                      {k.delta > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                      {Math.abs(k.delta)}
                    </span>
                  )}
                </>
              }
            />
            <Typography.Text type="secondary" className="ac-kpi__detail">
              {k.detail}
            </Typography.Text>
          </Card>
        </Col>
      ))}

      <Col xs={24} xl={14}>
        <Card title="Case 趋势（近 7 天）" variant="borderless" style={{ height: '100%' }}>
          {data ? (
            <div className="ac-trend">
              {data.trend.map((t) => (
                <div key={t.date} className="ac-trend__col">
                  <div className="ac-trend__bars">
                    <i className="is-case" style={{ height: `${(t.case / maxTrend) * 100}%` }} />
                    <i className="is-finding" style={{ height: `${(t.finding / maxTrend) * 100}%` }} />
                    <i className="is-jira" style={{ height: `${(t.jira / maxTrend) * 100}%` }} />
                  </div>
                  <span className="ac-trend__value">{t.case}</span>
                  <span className="ac-trend__day">{t.date}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
          <div className="ac-legend" style={{ marginTop: 10 }}>
            {[
              ['Case 上报', 'var(--sh-brand)'],
              ['Finding 产出', '#8fbf4f'],
              ['JIRA 建单', '#c9dcb2'],
            ].map(([label, color]) => (
              <span key={label} className="ac-legend__item">
                <i style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                <em>{label}</em>
              </span>
            ))}
          </div>
        </Card>
      </Col>

      <Col xs={24} xl={10}>
        <Card title="工单阶段分布" variant="borderless" style={{ height: '100%' }} extra={<Typography.Text type="secondary">{tickets.length} 条</Typography.Text>}>
          <div className="ac-top">
            {data?.stageDistribution.map((s) => (
              <div key={s.stage}>
                <a className="ac-top__name" onClick={() => nav(`/tickets?stage=${s.stage}`)}>
                  {STAGE_META[s.stage as Stage].label}
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                    {STAGE_META[s.stage as Stage].desc}
                  </Typography.Text>
                </a>
                <Progress percent={(s.count / Math.max(tickets.length, 1)) * 100} format={() => `${s.count}`} size="small" strokeColor={STAGE_META[s.stage as Stage].color} />
              </div>
            ))}
          </div>
        </Card>
      </Col>

      <Col xs={24} xl={10}>
        <Card title="Top 异常服务" variant="borderless" style={{ height: '100%' }}>
          <div className="ac-top">
            {data?.topServices.map((s) => (
              <div key={s.name}>
                <Typography.Text ellipsis className="ac-top__name">
                  {s.name} · {s.count}
                </Typography.Text>
                <Progress percent={s.percent} showInfo={false} size="small" />
              </div>
            ))}
          </div>
        </Card>
      </Col>

      <Col xs={24} xl={14}>
        <Card title="待我处理" variant="borderless" style={{ height: '100%' }} extra={<Typography.Text type="secondary">分析完成、等待批准修复</Typography.Text>}>
          <List
            size="small"
            dataSource={pending.slice(0, 6)}
            locale={{ emptyText: can('case.status.modify') ? '没有待审批的修复建议' : '普通成员无审批职责，请到「Case 列表」处理分配给你的 Case' }}
            renderItem={(t) => (
              <List.Item
                actions={[
                  can('case.status.modify') ? (
                    <Button key="go" size="small" type="link" onClick={() => nav(`/tickets?assignee=${t.assigneeId}`)}>
                      去审批
                    </Button>
                  ) : (
                    <Button key="jira" size="small" type="link" onClick={() => window.open(t.jiraUrl, '_blank', 'noopener')}>
                      JIRA
                    </Button>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      <Typography.Text>{t.jiraKey}</Typography.Text>
                      <span className="ac-ticket__title" style={{ display: 'inline' }}>
                        {t.title}
                      </span>
                    </Space>
                  }
                  description={
                    <Space size={6}>
                      <StageTag stage={stageOf(t)} />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t.severity} · 更新 {timeAgo(t.updatedAt)}
                      </Typography.Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </Col>

      <Col xs={24}>
        <Card title="项目维度" variant="borderless">
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={visibleProjects}
            columns={[
              { title: '项目', dataIndex: 'name', width: 140 },
              { title: 'Key', dataIndex: 'projectKey', width: 140 },
              {
                title: 'Open',
                key: 'open',
                width: 90,
                render: (_, p) => tickets.filter((t) => t.projectId === p.id && stageOf(t) !== 'DONE' && stageOf(t) !== 'REJECTED').length,
              },
              {
                title: '待审批',
                key: 'pending',
                width: 90,
                render: (_, p) => tickets.filter((t) => t.projectId === p.id && t.analysisReview === 'DONE').length,
              },
              {
                title: '完成',
                key: 'done',
                width: 90,
                render: (_, p) => tickets.filter((t) => t.projectId === p.id && stageOf(t) === 'DONE').length,
              },
              {
                title: '拒绝',
                key: 'rejected',
                width: 90,
                render: (_, p) => tickets.filter((t) => t.projectId === p.id && stageOf(t) === 'REJECTED').length,
              },
              { title: '', key: 'go', width: 70, render: (_, p) => <Button size="small" type="link" onClick={() => nav(`/tickets?project=${p.projectKey}`)}>工单</Button> },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

