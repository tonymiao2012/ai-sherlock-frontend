import { App as AntApp, Alert, Badge, Button, Card, Descriptions, Form, Input, InputNumber, Select, Space, Switch, Table, Tabs, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useSession } from '../context/Session';
import { fmtDateTime } from '../domain/format';

/** §3 鉴权与 §8/§9 集成策略：MVP 只放 Google OAuth，SSO 预留 */
export function SettingsPage() {
  const { message } = AntApp.useApp();
  const { can, user } = useSession();
  const [domains, setDomains] = useState<string[]>(['company.com', 'company-inc.com']);
  const [polling, setPolling] = useState(true);
  const [pollInterval, setPollInterval] = useState(5);
  const editable = can('settings.manage');

  const save = (what: string) => message.success(`${what}已保存`);

  return (
    <Card variant="borderless" title="系统设置" styles={{ body: { paddingTop: 14 } }}>
      {!editable && <Alert type="warning" showIcon message="仅系统管理员可修改全局配置" style={{ marginBottom: 12 }} />}
      <Tabs
        items={[
          {
            key: 'auth',
            label: '登录与鉴权',
            children: (
              <Form layout="vertical" disabled={!editable} style={{ maxWidth: 620 }}>
                <Form.Item label="启用的 AuthProvider">
                  <CheckboxGroup
                    value={['GOOGLE', 'PASSWORD']}
                    onChange={() => message.info('MVP 阶段固定启用 Google OAuth 与开发态用户名密码')}
                  />
                </Form.Item>
                <Form.Item label="Google OAuth Client ID" name="clientId" initialValue="81234567890-abc123.apps.googleusercontent.com">
                  <Input />
                </Form.Item>
                <Form.Item label="邮箱域名白名单" extra="不在白名单的 Google 账号登录直接被拒，并写入登录审计">
                  <Select
                    mode="tags"
                    value={domains}
                    onChange={setDomains}
                    tokenSeparators={[',', ' ']}
                    placeholder="company.com"
                  />
                </Form.Item>
                <Form.Item label="企业 SSO（SAML / OIDC）" valuePropName="checked">
                  <Switch disabled checked={false} />
                </Form.Item>
                <Space size={24}>
                  <Form.Item label="Access Token" initialValue={15}>
                    <InputNumber min={5} max={120} addonAfter="分钟" disabled={!editable} />
                  </Form.Item>
                  <Form.Item label="Refresh Token" initialValue={7}>
                    <InputNumber min={1} max={30} addonAfter="天" disabled={!editable} />
                  </Form.Item>
                  <Form.Item label="Token Rotation" valuePropName="checked" initialValue>
                    <Switch disabled={!editable} defaultChecked />
                  </Form.Item>
                </Space>
                <Button type="primary" disabled={!editable} onClick={() => save('鉴权配置 ')}>
                  保存
                </Button>
              </Form>
            ),
          },
          {
            key: 'sync',
            label: 'JIRA / 仓库同步',
            children: (
              <div style={{ maxWidth: 720 }}>
                <Typography.Paragraph type="secondary">
                  工单状态以 JIRA 为唯一事实源。中台通过 Bitbucket Webhook（pr:created / pr:reviewer:approved / pr:merged / pr:declined）驱动
                  fix_pipeline，再回写 JIRA Transition；Webhook 漏推时由轮询兜底。
                </Typography.Paragraph>
                <Descriptions
                  size="small"
                  column={1}
                  title="Webhook 接收"
                  items={[
                    { key: 'url', label: '回调地址', children: <Typography.Text copyable>https://sherlock.company.com/api/v1/webhooks/bitbucket</Typography.Text> },
                    {
                      key: 'st',
                      label: '最近事件',
                      children: (
                        <Space>
                          <Badge status="processing" />
                          pr:merged · ACCOUNT-1266 · {fmtDateTime(new Date().toISOString())}
                        </Space>
                      ),
                    },
                    { key: 'sec', label: '密钥校验', children: 'HMAC-SHA256，X-Hub-Signature-256' },
                  ]}
                />
                <Space style={{ marginTop: 16 }} size={20} align="end">
                  <div>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                      轮询兜底
                    </Typography.Paragraph>
                    <Switch checked={polling} onChange={setPolling} disabled={!editable} />
                  </div>
                  <div>
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 4 }}>
                      间隔（分钟）
                    </Typography.Paragraph>
                    <InputNumber min={1} max={60} value={pollInterval} onChange={(v) => setPollInterval(v ?? 5)} disabled={!editable || !polling} />
                  </div>
                  <Button disabled={!editable} onClick={() => save('同步策略 ')}>
                    保存
                  </Button>
                </Space>
                <Table
                  size="small"
                  style={{ marginTop: 18 }}
                  rowKey="k"
                  pagination={false}
                  dataSource={[
                    { k: 'Open', a: '建单 / 评论', b: 'PENDING_APPROVAL' },
                    { k: 'Analysis Ready', a: '回写诊断结论', b: 'PENDING_APPROVAL' },
                    { k: 'Fix Approved', a: '批准修复', b: 'APPROVED → FIXING' },
                    { k: 'In Review', a: 'PR 创建', b: 'PR_CREATED' },
                    { k: 'Ready to Merge', a: 'PR Approved', b: 'PR_APPROVED' },
                    { k: 'In Deploy', a: 'PR Merged', b: 'MERGED + 触发 UAT' },
                    { k: 'Done', a: 'UAT 成功', b: 'UAT_DEPLOYED' },
                  ]}
                  columns={[
                    { title: 'JIRA 状态', dataIndex: 'k', width: 150 },
                    { title: '中台动作', dataIndex: 'a', width: 150 },
                    { title: 'fix_pipeline', dataIndex: 'b' },
                  ]}
                />
              </div>
            ),
          },
          {
            key: 'llm',
            label: 'AI 诊断',
            children: (
              <Form layout="vertical" disabled={!editable} style={{ maxWidth: 620 }} initialValues={{ model: 'gpt-5.1', window: 128, keep: 30 }}>
                <Form.Item label="LLM Provider" name="provider" initialValue="OPENAI">
                  <Select options={[{ value: 'OPENAI', label: 'OpenAI' }, { value: 'AZURE', label: 'Azure OpenAI' }, { value: 'SELF_HOST', label: '自建网关' }]} />
                </Form.Item>
                <Form.Item label="模型" name="model">
                  <Input />
                </Form.Item>
                <Space size={24}>
                  <Form.Item label="Context Window (K)" name="window">
                    <InputNumber min={16} max={512} step={16} />
                  </Form.Item>
                  <Form.Item label="日志保留（天）" name="keep">
                    <InputNumber min={7} max={180} />
                  </Form.Item>
                </Space>
                <Form.Item label="证据裁剪策略" valuePropName="checked">
                  <Switch defaultChecked />
                </Form.Item>
                <Typography.Paragraph type="secondary">
                  诊断仅使用项目已授权的日志索引与仓库快照；Finding 未通过人工确认前不会自动建 JIRA 单（可在项目 Capability 里调整为 AUTO）。
                </Typography.Paragraph>
                <Button type="primary" disabled={!editable} onClick={() => save('AI 配置 ')}>
                  保存
                </Button>
              </Form>
            ),
          },
          {
            key: 'about',
            label: '关于',
            children: (
              <Descriptions
                size="small"
                column={1}
                style={{ maxWidth: 620 }}
                items={[
                  { key: 'v', label: '控制台版本', children: '0.1.0 · MVP 脚手架（前端已成型，接口待接）' },
                  { key: 'u', label: '当前身份', children: `${user.name} · ${user.email} · ${user.role}` },
                  { key: 'doc', label: '文档', children: <Typography.Text code>docs/middle-platform-prd.html</Typography.Text> },
                  { key: 'api', label: 'API 前缀', children: '/api/v1（PRD §12 契约）' },
                ]}
              />
            ),
          },
        ]}
      />
    </Card>
  );
}

function CheckboxGroup({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <Space wrap>
      <Tag color="success">Google OAuth（MVP）</Tag>
      <Tag color="success">用户名密码（开发态）</Tag>
      <Tag>企业 SSO —— 预留</Tag>
      <Button size="small" type="link" onClick={() => onChange(value)}>
        配置说明
      </Button>
    </Space>
  );
}
