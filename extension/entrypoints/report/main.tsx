// 数据接收页（unlisted page）：展示最近一次提交的问题包全量证据
// 由 index.html 以普通 module 加载，需直接挂载（defineUnlistedScript 只返回 { main } 不会自执行）
import 'antd/dist/reset.css';
import '../../styles/theme.css';
import './style.css';
import ReactDOM from 'react-dom/client';
import ThemeProvider from '../../components/ThemeProvider';
import ReportApp from '../../components/ReportApp';

const rootEl = document.getElementById('root')!;
const existingRoot = (rootEl as any).__ai_sherlock_root__ as ReturnType<typeof ReactDOM.createRoot> | undefined;
const app = (
  <ThemeProvider>
    <ReportApp />
  </ThemeProvider>
);
if (existingRoot) {
  existingRoot.render(app);
} else {
  (rootEl as any).__ai_sherlock_root__ = ReactDOM.createRoot(rootEl);
  (rootEl as any).__ai_sherlock_root__.render(app);
}
