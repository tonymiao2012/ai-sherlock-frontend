import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Role } from './types';
import { ConsoleLayout, HOME_BY_ROLE } from './layouts/ConsoleLayout';
import { SessionProvider, useSession } from './context/Session';
import { DashboardPage } from './pages/Dashboard';
import { ProjectsPage } from './pages/Projects';
import { JiraBoardPage } from './pages/JiraBoard';
import { CasesPage } from './pages/Cases';
import { MembersPage } from './pages/Members';
import { SettingsPage } from './pages/Settings';
import { sherlockTheme } from './theme';

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

/** §3.6 登录后按角色落地；越权路由直接回到该角色首页 */
function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useSession();
  if (!roles.includes(user.role)) return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useSession();
  return <Navigate to={HOME_BY_ROLE[user.role]} replace />;
}

export default function App() {
  return (
    <ConfigProvider theme={sherlockTheme} locale={zhCN}>
      <AntApp>
        <SessionProvider>
          <BrowserRouter basename={BASENAME}>
            <Routes>
              <Route element={<ConsoleLayout />}>
                <Route index element={<Home />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireRole roles={['ADMIN', 'PROJECT_OWNER']}>
                      <DashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/projects"
                  element={
                    <RequireRole roles={['ADMIN', 'PROJECT_OWNER', 'DEVELOPER']}>
                      <ProjectsPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/tickets"
                  element={
                    <RequireRole roles={['ADMIN', 'PROJECT_OWNER', 'DEVELOPER']}>
                      <JiraBoardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/my-tickets"
                  element={
                    <RequireRole roles={['DEVELOPER']}>
                      <JiraBoardPage meOnly />
                    </RequireRole>
                  }
                />
                <Route
                  path="/cases"
                  element={
                    <RequireRole roles={['ADMIN', 'PROJECT_OWNER']}>
                      <CasesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/members"
                  element={
                    <RequireRole roles={['ADMIN']}>
                      <MembersPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <RequireRole roles={['ADMIN']}>
                      <SettingsPage />
                    </RequireRole>
                  }
                />
                <Route path="*" element={<Home />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SessionProvider>
      </AntApp>
    </ConfigProvider>
  );
}
