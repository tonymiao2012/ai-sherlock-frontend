import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CHROME_STORE_URL, LOGO_URL } from '../assets';
import { IconChrome, IconClose, IconMenu } from './icons';

const NAV_ITEMS = [
  { label: '首页', to: '/' },
  {
    label: '产品',
    children: [
      { label: 'Chrome插件', to: '/product/chrome' },
      { label: 'Replay SDK', to: '/product/replay' },
    ],
  },
  { label: '文档', to: '/docs' },
  { label: '博客', to: '/blog' },
  { label: '更新日志', to: '/changelog' },
];

export function Nav({ onLogin }: { onLogin: () => void }) {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest('.lp-nav')) setOpen(false);
    };
    const onResize = () => {
      if (window.innerWidth > 1000) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className={`lp-nav${stuck ? ' lp-nav--stuck' : ''}`}>
      <Link className="lp-brand" to="/">
        <img src={LOGO_URL} alt="" />
        <span>AI Sherlock</span>
      </Link>

      <nav className="lp-nav__tabs" aria-label="主导航">
        {NAV_ITEMS.map((item) => {
          if ('children' in item && item.children) {
            const hasActiveChild = item.children.some((c) => isActive(c.to));
            return (
              <div
                key={item.label}
                className="lp-nav__dropdown"
                onMouseEnter={() => setProductOpen(true)}
                onMouseLeave={() => setProductOpen(false)}
              >
                <button
                  type="button"
                  className={`lp-nav__tab${hasActiveChild ? ' lp-nav__tab--active' : ''}`}
                  aria-expanded={productOpen}
                >
                  {item.label}
                </button>
                {productOpen && (
                  <div className="lp-nav__dropdown-panel">
                    {item.children.map((child) => (
                      <Link
                        key={child.to}
                        className={`lp-nav__dropdown-item${isActive(child.to) ? ' lp-nav__dropdown-item--active' : ''}`}
                        to={child.to}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if ('to' in item) {
            return (
              <Link
                key={item.label}
                className={`lp-nav__tab${isActive(item.to) ? ' lp-nav__tab--active' : ''}`}
                to={item.to}
              >
                {item.label}
              </Link>
            );
          }
          return null;
        })}
      </nav>

      <span className="lp-nav__spacer" onClick={() => setOpen((v) => !v)} />

      <a
        className="lp-btn lp-btn--ghost lp-btn--sm lp-nav__install lp-only-pc"
        href={CHROME_STORE_URL}
        target="_blank"
        rel="noreferrer"
      >
        <IconChrome size={15} />
        <span>添加到Chrome</span>
      </a>
      <button
        type="button"
        className="lp-btn lp-btn--ghost lp-btn--sm lp-only-pc"
        onClick={onLogin}
      >
        登录
      </button>

      <button
        type="button"
        className="lp-nav__toc"
        aria-expanded={open}
        aria-label="页面目录"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <IconClose size={16} /> : <IconMenu size={16} />}
      </button>

      {open ? (
        <nav className="lp-nav__panel" aria-label="页面目录">
          {NAV_ITEMS.map((item) => {
            if ('children' in item && item.children) {
              return (
                <div key={item.label} className="lp-nav__panel-group">
                  <span className="lp-nav__panel-label">{item.label}</span>
                  {item.children.map((child) => (
                    <Link
                      key={child.to}
                      className={`lp-nav__item${isActive(child.to) ? ' lp-nav__item--active' : ''}`}
                      to={child.to}
                      onClick={() => setOpen(false)}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              );
            }
            if ('to' in item) {
              return (
                <Link
                  key={item.label}
                  className={`lp-nav__item${isActive(item.to) ? ' lp-nav__item--active' : ''}`}
                  to={item.to}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              );
            }
            return null;
          })}
        </nav>
      ) : null}
    </header>
  );
}
