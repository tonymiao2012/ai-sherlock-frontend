import { Card, Tag, Typography } from 'antd';

/** 其余模块的占位页：列出 PRD 规划范围，接口与页面待实现 */
export function ModulePage({ title, prdRef, scope }: { title: string; prdRef: string; scope: string[] }) {
  return (
    <Card title={title} extra={<Tag>MVP 脚手架</Tag>} variant="borderless">
      <Typography.Paragraph type="secondary">
        按中台 PRD {prdRef} 规划，以下能力待接入后端 API。
      </Typography.Paragraph>
      <ul className="ac-scope">
        {scope.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </Card>
  );
}
