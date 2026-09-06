import { useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav';
import { SiteFooter } from './components/SiteFooter';
import { LoginDialog } from './components/LoginDialog';
import { HomePage } from './pages/HomePage';
import { ChromePluginPage } from './pages/ChromePluginPage';
import { ReplaySdkPage } from './pages/ReplaySdkPage';
import { DocsPage } from './pages/DocsPage';
import { ApiDocsPage } from './pages/ApiDocsPage';
import { BlogPage } from './pages/BlogPage';
import { ChangelogPage } from './pages/ChangelogPage';

export default function App() {
  const [loginOpen, setLoginOpen] = useState(false);
  const openLogin = () => setLoginOpen(true);

  return (
    <HashRouter>
      <Nav onLogin={openLogin} />
      <main>
        <Routes>
          <Route path="/" element={<HomePage onLogin={openLogin} />} />
          <Route path="/product/chrome" element={<ChromePluginPage />} />
          <Route path="/product/replay" element={<ReplaySdkPage />} />
          <Route path="/docs" element={<ApiDocsPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/changelog" element={<ChangelogPage />} />
        </Routes>
      </main>
      <SiteFooter />
      {loginOpen ? <LoginDialog onClose={() => setLoginOpen(false)} /> : null}
    </HashRouter>
  );
}
