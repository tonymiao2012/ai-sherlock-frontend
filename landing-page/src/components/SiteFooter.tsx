import { Link } from 'react-router-dom';
import { LOGO_URL } from '../assets';

const FOOTER_COLS: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: '产品',
    links: [
      { label: 'Chrome插件', to: '/product/chrome' },
      { label: 'Replay SDK', to: '/product/replay' },
    ],
  },
  {
    title: '文档',
    links: [{ label: '文档', to: '/docs' }],
  },
  {
    title: '博客',
    links: [{ label: '博客', to: '/blog' }],
  },
  {
    title: '更新日志',
    links: [{ label: '更新日志', to: '/changelog' }],
  },
];

export function SiteFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-container">
        <div className="lp-footer__grid">
          <div className="lp-footer__brand">
            <Link className="lp-brand" to="/">
              <img src={LOGO_URL} alt="" />
              <span>AI Sherlock</span>
            </Link>
            <p>AI 驱动的问题诊断平台：从现场采集到 UAT 发布的端到端闭环。</p>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.title} className="lp-footer__col">
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="lp-footer__legal">
          <span>© AI Sherlock 2026</span>
          <span>
            <a href="#">隐私条款</a> · <a href="#">服务条款</a>
          </span>
        </div>
      </div>
    </footer>
  );
}
