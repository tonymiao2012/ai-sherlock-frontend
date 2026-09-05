// 统一主题容器：所有扩展页面入口都套一层，保证 antd 与自绘 DOM 同一套令牌
import React from 'react';
import { ConfigProvider } from 'antd';
import { sherlockTheme } from '../core/theme';

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConfigProvider theme={sherlockTheme}>{children}</ConfigProvider>;
}
