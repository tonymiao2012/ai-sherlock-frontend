import { App as AntApp, Alert, Button, Divider, Drawer, Form, Input, Select, Space, Steps, Switch, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import type { FormInstance } from 'antd';
import type { Project, Repository, ValidationItem } from '../types';
import { useSession } from '../context/Session';
import * as api from '../services/api';

const EMPTY_REPO: Repository = {
  id: '',
  repoType: 'BACKEND',
  provider: 'BITBUCKET',
  repoProject: '',
  repoSlug: '',
  defaultBranch: 'main',
  urlPatterns: [],
  verifyState: 'PENDING',
};

/** §5.1 / §5.2：Owner 建项目时一次配齐仓库、日志与 JIRA 映射 */
export function ProjectForm({
  open,
  project,
  onClose,
  onSaved,
}: {
  open: boolean;
  project?: Project;
  onClose: () => void;
  onSaved: (p: Project) => void;
}) {
  const { message } = AntApp.useApp();
  const { user, users, groups, refresh } = useSession();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [report, setReport] = useState<ValidationItem[]>([]);
  const [form] = Form.useForm<Project>();

  const ownerCandidates = users.filter((u) => u.role !== 'ADMIN' && u.status !== 'DISABLED');
  const editable = !project || user.role === 'ADMIN' || project.ownerId === user.id;

  const next = async () => {
    const fields = STEP_FIELDS[step];
    try {
      await form.validateFields(fields);
      setStep((s) => s + 1);
    } catch {
      message.warning(STEP_HINT[step]);
    }
  };

  const submit = async () => {
    const values = form.getFieldsValue(true) as Project;
    setSaving(true);
    const payload: Project = {
      ...values,
      id: project?.id ?? `p_${values.projectKey}`,
      status: project?.status ?? 'ACTIVE',
      createdAt: project?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repos: (values.repos ?? []).map((r, i) => ({ ...r, id: r.id || `r_${Date.now()}_${i}` })),
      urlMappings: values.urlMappings ?? [],
    };
    const saved = project ? await api.updateProject(project.projectKey, payload, user.email) : await api.createProject(payload, user.email);
    await refresh();
    setSaving(false);
    message.success(`项目 ${saved.projectKey} 已${project ? '更新' : '创建'}`);
    onSaved(saved);
  };

  const validateNow = async () => {
    const values = form.getFieldsValue(true) as Project;
    if (!values.repos?.length) return message.warning('请先绑定仓库');
    setValidating(true);
    const result = await api.validateProject(values.projectKey ?? 'draft', user.email);
    setReport(result);
    setValidating(false);
    message[result.every((r) => r.ok) ? 'success' : 'warning'](`校验完成：${result.filter((r) => r.ok).length}/${result.length} 项通过`);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={860}
      destroyOnHidden
      title={project ? `编辑项目 · ${project.projectKey}` : '创建项目'}
      extra={
        <Space>
          <Button loading={validating} onClick={validateNow}>配置校验</Button>
          <Button type="primary" loading={saving} disabled={!editable} onClick={submit}>
            {project ? '保存' : '创建项目'}
          </Button>
        </Space>
      }
    >
      {!editable && <Alert type="warning" showIcon message="只有项目 Owner 或管理员可编辑该项目" style={{ marginBottom: 16 }} />}
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={['基本信息', '代码仓库', '日志与映射', '授权与能力'].map((title) => ({ title }))}
      />
      {report.length > 0 && (
        <div className="ac-validate">
          <Typography.Text strong>{`配置校验：${report.filter((r) => r.ok).length}/${report.length} 项通过`}</Typography.Text>
          {report.map((r) => (
            <div key={r.target} className={`ac-validate__row ${r.ok ? 'is-ok' : 'is-bad'}`}>
              <span className="ac-validate__mark">{r.ok ? '✓' : '✕'}</span>
              <div>
                <div>{r.target}</div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {r.detail}
                </Typography.Text>
              </div>
            </div>
          ))}
        </div>
      )}
      <Form
        form={form}
        layout="vertical"
        initialValues={
          project ?? {
            projectKey: '',
            name: '',
            description: '',
            ownerId: user.id,
            access: { groupIds: [], userIds: [] },
            repos: [EMPTY_REPO],
            urlMappings: [],
            logging: {
              provider: 'ELASTIC',
              baseUrl: 'https://kibana.company.com/app/discover',
              indexPattern: '',
              versionMapping: 'TAG',
              fieldMap: {
                timestamp: '@timestamp',
                level: 'level',
                traceId: 'traceId',
                message: 'message',
                stackTrace: 'exception.stack_trace',
                service: 'service.name',
              },
              verifyState: 'PENDING',
            },
            jira: {
              site: 'https://jira.company.com',
              projectKey: '',
              issueType: 'Bug',
              descriptionTemplate: '问题描述 / 复现步骤 / 日志与 Trace / AI 诊断结论 / 建议修复',
              autoCreate: true,
            },
            uat: { pipelineId: '', deployMethod: 'WEBHOOK_DIRECT', enabled: false },
            capability: { aiDiagnosis: true, sourceAnalysis: true, autoFix: false, approvalMode: 'REVIEW_REQUIRED' },
          }
        }
      >
        <div hidden={step !== 0}>
          <Form.Item label="项目 Key" name="projectKey" rules={[{ required: true }, { pattern: /^[a-z0-9-]{3,32}$/, message: '小写字母、数字与连字符，3–32 位' }]}>
            <Input placeholder="account-center" disabled={Boolean(project)} />
          </Form.Item>
          <Form.Item label="项目名称" name="name" rules={[{ required: true }]}>
            <Input placeholder="账户中心" />
          </Form.Item>
          <Form.Item label="说明" name="description">
            <Input.TextArea rows={2} placeholder="一句话说明这个项目覆盖的业务范围" />
          </Form.Item>
          <Form.Item label="项目 Owner" name="ownerId" rules={[{ required: true }]} extra="同时是该项目的默认 JIRA Assignee 与修复审批人">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="选择已授予 PROJECT_OWNER 的成员"
              options={ownerCandidates.map((u) => ({
                value: u.id,
                label: `${u.name} · ${u.email}${u.role === 'PROJECT_OWNER' ? '' : '（普通成员，需先授权）'}`,
              }))}
            />
          </Form.Item>
          <Divider titlePlacement="left" plain>
            JIRA 关联
          </Divider>
          <Space.Compact block>
            <Form.Item label="JIRA 站点" name={['jira', 'site']} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="https://jira.company.com" />
            </Form.Item>
            <Form.Item label="Project Key" name={['jira', 'projectKey']} rules={[{ required: true }]} style={{ width: 180 }}>
              <Input placeholder="ACCOUNT" />
            </Form.Item>
            <Form.Item label="Issue Type" name={['jira', 'issueType']} style={{ width: 140 }}>
              <Select options={['Bug', 'Task', 'Story', 'Improvement'].map((v) => ({ value: v }))} />
            </Form.Item>
          </Space.Compact>
          <Form.Item label="工单描述模板" name={['jira', 'descriptionTemplate']} extra="生成 JIRA 详情正文时附带的段落顺序">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Finding 验证通过后自动建单" name={['jira', 'autoCreate']} valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>

        <div hidden={step !== 1}>
          <Typography.Paragraph type="secondary">
            前端仓库支持多个（微前端）；后端仓库用 URL Pattern 关联到服务，诊断时据此定位代码。
          </Typography.Paragraph>
          <Form.List name="repos">
            {(rows, { add, remove }) => (
              <>
                {rows.map(({ key, name }) => (
                  <div key={key} className="ac-repo-row">
                    <Form.Item name={[name, 'repoType']} label="类型" initialValue="BACKEND" style={{ marginBottom: 0 }}>
                      <Select
                        style={{ width: 96 }}
                        options={[
                          { value: 'FRONTEND', label: '前端' },
                          { value: 'BACKEND', label: '后端' },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name={[name, 'provider']} label="平台" initialValue="BITBUCKET" style={{ marginBottom: 0 }}>
                      <Select style={{ width: 118 }} options={[{ value: 'BITBUCKET' }, { value: 'GITHUB' }]} />
                    </Form.Item>
                    <Form.Item name={[name, 'repoProject']} label="Project" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                      <Input style={{ width: 100 }} placeholder="ACCT" />
                    </Form.Item>
                    <Form.Item name={[name, 'repoSlug']} label="Repository" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                      <Input style={{ width: 160 }} placeholder="account-ms" />
                    </Form.Item>
                    <Form.Item name={[name, 'defaultBranch']} label="默认分支" initialValue="main" style={{ marginBottom: 0 }}>
                      <Input style={{ width: 100 }} />
                    </Form.Item>
                    <Form.Item name={[name, 'subAppKey']} label="子应用" style={{ marginBottom: 0 }}>
                      <Input style={{ width: 100 }} placeholder="Qiankun key" />
                    </Form.Item>
                    <Space align="end" style={{ paddingBottom: 2 }}>
                      <Button size="small" onClick={() => message.info('已提交校验：读取 /rest/api/1.0/projects/{project}/repos/{slug}')}>
                        校验
                      </Button>
                      <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} />
                    </Space>
                  </div>
                ))}
                <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ ...EMPTY_REPO })} style={{ marginTop: 8 }}>
                  添加仓库
                </Button>
              </>
            )}
          </Form.List>
          <Form.Item style={{ marginTop: 24 }} label="Build Version → Git Commit 解析方式" name={['logging', 'versionMapping']}>
            <Select
              style={{ maxWidth: 260 }}
              options={[
                { value: 'TAG', label: 'Git Tag' },
                { value: 'COMMIT_HASH', label: 'Commit Hash' },
                { value: 'CI_BUILD_NUMBER', label: 'CI Build Number' },
              ]}
            />
          </Form.Item>
        </div>

        <div hidden={step !== 2}>
          <Divider titlePlacement="left" plain>
            URL Pattern → 服务映射
          </Divider>
          <Form.List name="urlMappings">
            {(rows, { add, remove }) => (
              <>
                {rows.map(({ key, name }) => (
                  <div key={key} className="ac-repo-row">
                    <Form.Item name={[name, 'pattern']} label="URL Pattern" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                      <Input style={{ width: 240 }} placeholder="/api/account/**" />
                    </Form.Item>
                    <Form.Item name={[name, 'service']} label="服务" rules={[{ required: true, message: '必填' }]} style={{ marginBottom: 0 }}>
                      <Input style={{ width: 180 }} placeholder="account-ms" />
                    </Form.Item>
                    <Button size="small" type="text" danger icon={<MinusCircleOutlined />} onClick={() => remove(name)} style={{ marginBottom: 2 }} />
                  </div>
                ))}
                <Button block type="dashed" icon={<PlusOutlined />} onClick={() => add({ id: `m_${Date.now()}`, pattern: '', service: '' })}>
                  添加映射
                </Button>
              </>
            )}
          </Form.List>

          <Divider titlePlacement="left" plain>
            Kibana / Elastic 日志
          </Divider>
          <Space.Compact block>
            <Form.Item label="数据源" name={['logging', 'provider']} style={{ width: 150 }}>
              <Select options={[{ value: 'ELASTIC', label: 'Elasticsearch' }, { value: 'KIBANA', label: 'Kibana API' }]} />
            </Form.Item>
            <Form.Item label="Kibana 地址" name={['logging', 'baseUrl']} rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="https://kibana.company.com/app/discover" />
            </Form.Item>
            <Form.Item label="索引 Pattern" name={['logging', 'indexPattern']} rules={[{ required: true, message: '必填' }]} style={{ width: 240 }}>
              <Input placeholder="account-ms-*" />
            </Form.Item>
          </Space.Compact>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
            查询优先级：traceId → transactionId → sessionId → 服务 + 时间窗（§9.1），日志侧仅取原始数据，不绑 Kibana 界面。
          </Typography.Paragraph>
          <div className="ac-field-map">
            {FIELD_MAP_LABELS.map(([path, label, placeholder]) => (
              <Form.Item key={label} label={label} name={['logging', 'fieldMap', path]} initialValue={DEFAULT_FIELD_MAP[path]} style={{ marginBottom: 8 }}>
                <Input size="small" placeholder={placeholder} />
              </Form.Item>
            ))}
          </div>
        </div>

        <div hidden={step !== 3}>
          <Divider titlePlacement="left" plain>
            谁可以访问这个项目
          </Divider>
          <Form.Item label="授权 Group" name={['access', 'groupIds']} extra="组内成员都能查看该项目的工单列表">
            <Select
              mode="multiple"
              optionFilterProp="label"
              placeholder="选择 Group"
              options={groups.map((g) => ({ value: g.id, label: `${g.name}（${g.memberCount} 人）` }))}
            />
          </Form.Item>
          <Form.Item label="追加个人授权" name={['access', 'userIds']} extra="跨组协作时单独加人，不需要改 Group">
            <Select
              mode="multiple"
              optionFilterProp="label"
              placeholder="按姓名或邮箱搜索"
              options={users.map((u) => ({ value: u.id, label: `${u.name} · ${u.email}` }))}
            />
          </Form.Item>
          <Divider titlePlacement="left" plain>
            Capability Profile
          </Divider>
          <Space size={28} wrap>
            <Form.Item label="AI 诊断" name={['capability', 'aiDiagnosis']} valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="源码分析" name={['capability', 'sourceAnalysis']} valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="自动修复" name={['capability', 'autoFix']} valuePropName="checked" style={{ marginBottom: 0 }}>
              <Switch />
            </Form.Item>
            <Form.Item label="修复审批" name={['capability', 'approvalMode']} style={{ marginBottom: 0, minWidth: 190 }}>
              <Select
                options={[
                  { value: 'REVIEW_REQUIRED', label: '需 Owner 审批（推荐）' },
                  { value: 'AUTO', label: '自动执行' },
                  { value: 'DISABLED', label: '停用修复' },
                ]}
              />
            </Form.Item>
          </Space>
          <Divider titlePlacement="left" plain>
            UAT 发布
          </Divider>
          <Space.Compact block>
            <Form.Item label="Pipeline" name={['uat', 'pipelineId']} style={{ flex: 1 }}>
              <Input placeholder="account-ms-uat" />
            </Form.Item>
            <Form.Item label="触发方式" name={['uat', 'deployMethod']} style={{ width: 200 }}>
              <Select
                options={[
                  { value: 'WEBHOOK_DIRECT', label: 'Webhook 直通' },
                  { value: 'API_TRIGGER', label: 'API 触发' },
                ]}
              />
            </Form.Item>
            <Form.Item label="启用" name={['uat', 'enabled']} valuePropName="checked" style={{ width: 90 }}>
              <Switch />
            </Form.Item>
          </Space.Compact>
        </div>

        <Space style={{ marginTop: 24 }}>
          <Button disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            上一步
          </Button>
          {step < 3 ? (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          ) : (
            <Button type="primary" loading={saving} disabled={!editable} onClick={submit}>
              {project ? '保存修改' : '创建项目'}
            </Button>
          )}
          <Typography.Text type="secondary">第 {step + 1} / 4 步</Typography.Text>
        </Space>
      </Form>
    </Drawer>
  );
}

type FieldList = NonNullable<Parameters<FormInstance['validateFields']>[0]>;

const STEP_FIELDS: FieldList[] = [
  ['projectKey', 'name', 'ownerId', ['jira', 'site'], ['jira', 'projectKey']],
  ['repos'],
  [['logging', 'baseUrl'], ['logging', 'indexPattern']],
  [['access', 'groupIds']],
];

const STEP_HINT = ['请完整填写项目 Key、名称、Owner 与 JIRA 关联', '请至少绑定一个仓库并填全字段', '日志地址与索引 Pattern 为必填', '请至少选择一个授权 Group'];

const DEFAULT_FIELD_MAP: Record<string, string> = {
  timestamp: '@timestamp',
  level: 'level',
  traceId: 'traceId',
  message: 'message',
  stackTrace: 'exception.stack_trace',
  service: 'service.name',
};

const FIELD_MAP_LABELS: [string, string, string][] = [
  ['timestamp', '时间戳', '@timestamp'],
  ['level', '级别', 'level'],
  ['traceId', 'TraceId', 'traceId'],
  ['message', '消息', 'message'],
  ['stackTrace', '异常堆栈', 'exception.stack_trace'],
  ['service', '服务名', 'service.name'],
];
