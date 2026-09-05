// 数据接收页（unlisted page）：展示最近一次提交的问题包全量证据
// 由 index.html 以普通 module 加载，需直接挂载（defineUnlistedScript 只返回 { main } 不会自执行）
import 'antd/dist/reset.css';
import '../../styles/theme.css';
import './style.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ThemeProvider from '../../components/ThemeProvider';
import ReportApp from '../../components/ReportApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <ReportApp />
    </ThemeProvider>
  </React.StrictMode>
);
