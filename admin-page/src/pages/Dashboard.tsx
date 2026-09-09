import { Button, Card, Col, List, Progress, Row, Space, Statistic, Table, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, RightOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CaseV2, DashboardOverview } from '../types';
import * as api from '../services/api';
import { CASE_STATUS_META } from '../domain/caseLifecycle';
import { CaseStatusTag } from '../components/CaseStatusTag';
import { useSession } from '../context/Session';

export function DashboardPage() {
  const nav = useNavigate();
  const { user, visibleProjects, can } = useSession();
  const [data, setData] = useState<DashboardOverview>();
  const [cases, setCases] = useState<CaseV2[]>([]);
  const scoped = user.role === 'ADMIN' ? undefined : visibleProjects.map((p) => p.id);

  useEffect(() => {
    setData(undefined);
    Promise.all([api.getDashboardOverview(scoped), api.listCasesV2()]).then(([o, c]) => {
      setData(o);
      setCases(c.filter((x) => (scoped ? scoped.includes(x.projectId) : true)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, visibleProjects.length]);

  const pendingCases = useMemo(
    () => cases.filter((c) => ['PENDING_VERIFICATION', 'ANALYSIS_COMPLETED'].includes(c.status)),
    [cases],
  );

  const kpis = [
    { title: '本周 Case 总数', value: data?.weeklyCases.value ?? 0, suffix: '', delta: data?.weeklyCases.delta, detail: '插件上报，按项目去重' },
    { title: 'AI 诊断成功率', value: data?.diagnosisRate.value ?? 0, suffix: '%', delta: data?.diagnosisRate.delta, detail: 'ACCEPTED / TOTAL Finding' },
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
          {can('case.status.modify') && pendingCases.length > 0 && (
            <Button size="small" type="link" onClick={() => nav('/cases')} icon={<RightOutlined />}>
              {pendingCases.length} 条待处理 Case
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

      <Col xs={24} xl={12}>
        <Card
          title="Case 状态分布"
          variant="borderless"
          style={{ height: '100%' }}
          extra={<Typography.Text type="secondary">{cases.length} 条</Typography.Text>}
        >
          <div className="ac-top">
            {data?.statusDistribution
              .filter((s) => s.count > 0)
              .map((s) => (
                <div key={s.status}>
                  <a className="ac-top__name" onClick={() => nav(`/cases?status=${s.status}`)}>
                    {CASE_STATUS_META[s.status]?.label ?? s.status}
                  </a>
                  <Progress
                    percent={(s.count / Math.max(cases.length, 1)) * 100}
                    format={() => `${s.count}`}
                    size="small"
                    strokeColor={CASE_STATUS_META[s.status]?.color}
                  />
                </div>
              ))}
          </div>
        </Card>
      </Col>

      <Col xs={24} xl={12}>
        <Card
          title="待我处理"
          variant="borderless"
          style={{ height: '100%' }}
          extra={
            <Space size={12}>
              {data?.pendingAnalysis != null && data.pendingAnalysis > 0 && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  待分析 {data.pendingAnalysis}
                </Typography.Text>
              )}
              {data?.deployFailed != null && data.deployFailed > 0 && (
                <Typography.Text type="danger" style={{ fontSize: 12 }}>
                  部署失败 {data.deployFailed}
                </Typography.Text>
              )}
              {data?.pendingVerification != null && data.pendingVerification > 0 && (
                <Typography.Text style={{ fontSize: 12, color: '#722ED1' }}>
                  待验证 {data.pendingVerification}
                </Typography.Text>
              )}
            </Space>
          }
        >
          <List
            size="small"
            dataSource={pendingCases.slice(0, 6)}
            locale={{ emptyText: can('case.status.modify') ? '没有待处理的 Case' : '普通成员无审批职责，请到「Case 列表」处理分配给你的 Case' }}
            renderItem={(c) => (
              <List.Item
                actions={[
                  <Button key="go" size="small" type="link" onClick={() => nav('/cases')}>
                    去处理
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space size={6}>
                      <Typography.Text>{c.caseKey}</Typography.Text>
                      <span style={{ display: 'inline' }}>{c.title}</span>
                    </Space>
                  }
                  description={
                    <Space size={6}>
                      <CaseStatusTag status={c.status} />
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {c.severity}
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
                title: '总数',
                key: 'total',
                width: 70,
                render: (_, p) => cases.filter((c) => c.projectId === p.id).length,
              },
              {
                title: '待分析',
                key: 'pending',
                width: 80,
                render: (_, p) => cases.filter((c) => c.projectId === p.id && c.status === 'PENDING_ANALYSIS').length,
              },
              {
                title: '开发中',
                key: 'dev',
                width: 80,
                render: (_, p) => cases.filter((c) => c.projectId === p.id && ['ANALYSIS_COMPLETED', 'DEVELOPING'].includes(c.status)).length,
              },
              {
                title: '部署失败',
                key: 'failed',
                width: 80,
                render: (_, p) => cases.filter((c) => c.projectId === p.id && c.status === 'DEPLOY_FAILED').length,
              },
              {
                title: '完成',
                key: 'done',
                width: 70,
                render: (_, p) => cases.filter((c) => c.projectId === p.id && c.status === 'COMPLETED').length,
              },
              {
                title: '',
                key: 'go',
                width: 70,
                render: (_, p) => (
                  <Button size="small" type="link" onClick={() => nav(`/cases?project=${p.projectKey}`)}>
                    Case
                  </Button>
                ),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}
