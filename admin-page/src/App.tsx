import { App as AntApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { NewRole } from './types';
import { ConsoleLayout, HOME_BY_ROLE } from './layouts/ConsoleLayout';
import { SessionProvider, useSession } from './context/Session';
import { DashboardPage } from './pages/Dashboard';
import { CasesPage } from './pages/Cases';
import { OrganizationPage } from './pages/Organization';
import { MembersPage } from './pages/Members';
import { SettingsPage } from './pages/Settings';
import { sherlockTheme } from './theme';

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

/** §3.6 登录后按角色落地；越权路由直接回到该角色首页 */
function RequireRole({ roles, children }: { roles: NewRole[]; children: React.ReactNode }) {
  const { user } = useSession();
  const role = user.role as NewRole;
  if (!roles.includes(role)) return <Navigate to={HOME_BY_ROLE[role]} replace />;
  return <>{children}</>;
}

function Home() {
  const { user } = useSession();
  const role = user.role as NewRole;
  return <Navigate to={HOME_BY_ROLE[role]} replace />;
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
                    <RequireRole roles={['ADMIN', 'OWNER']}>
                      <DashboardPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/cases"
                  element={
                    <RequireRole roles={['ADMIN', 'OWNER', 'STAFF']}>
                      <CasesPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/organization"
                  element={
                    <RequireRole roles={['ADMIN']}>
                      <OrganizationPage />
                    </RequireRole>
                  }
                />
                <Route
                  path="/members"
                  element={
                    <RequireRole roles={['ADMIN', 'OWNER']}>
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
