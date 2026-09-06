import { useState, useEffect } from 'react';
import { FlowMock } from './mocks';
import { CHROME_STORE_URL } from '../assets';
import { IconArrowUpRight, IconBolt, IconChrome, IconGoogle, IconStar } from './icons';
import { fetchStatistics, type Statistics } from '../services/api';

/** 上线公告先不展示，等有真实变更 Log 可挂再打开 */
const SHOW_NOTICE = false;

export function Hero({ onLogin }: { onLogin: () => void }) {
  const [stats, setStats] = useState<Statistics | null>(null);

  useEffect(() => {
    fetchStatistics()
      .then(setStats)
      .catch((err) => console.warn('Failed to fetch statistics:', err));
  }, []);

  const teams = stats ? Math.max(60, Math.floor(stats.totalCases / 100)) : 60;
  const cases = stats ? stats.totalCases : 10000;

  return (
    <section className="lp-hero" id="top">
      <div className="lp-container lp-hero__inner">
        {SHOW_NOTICE ? (
          <div className="lp-hero__notice">
            <span className="lp-hero__notice-tag">
              <IconBolt size={11} /> New
            </span>
            AI 自动修复流水线上线
            <a className="lp-hero__notice-link" href="#features">
              查看详情 <IconArrowUpRight size={12} />
            </a>
          </div>
        ) : null}

        <h1 className="lp-h1 lp-hero__title">
          让每一个 Bug
          <br />
          都<span className="lp-mark">有迹可循</span>
        </h1>

        <p className="lp-lead lp-hero__lead">
          {'AI 驱动的问题诊断平台 —— 采集完整现场，自动补全日志与源码证据，'}
          <span className="lp-nb">LLM 定位根因</span>，审批后一键修复、合并、发布 UAT。
        </p>

        <div className="lp-hero__actions lp-only-pc">
          <a
            className="lp-btn lp-btn--primary lp-btn--lg"
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <IconChrome size={18} />
            添加到Chrome
          </a>
        </div>

        <div className="lp-hero__metrics">
          <span className="lp-hero__stars">
            <IconStar size={14} /> 4.8
          </span>
          <span className="lp-hero__dot">·</span>
          <span>
            已服务 <strong>{teams}+</strong> 内部团队
          </span>
          <span className="lp-hero__dot">·</span>
          <span>
            累计诊断 <strong>{cases.toLocaleString()}+</strong> Case
          </span>
        </div>

        <div className="lp-signin lp-only-pc">
          <span className="lp-signin__divider">或已有账号，直接登录</span>
          <button type="button" className="lp-btn lp-btn--ghost" onClick={onLogin}>
            <IconGoogle />
            Sign in with Google
          </button>
          <button type="button" className="lp-btn lp-btn--ghost" disabled>
            企业登录 <span className="lp-soon">Coming Soon</span>
          </button>
        </div>
      </div>

      <div className="lp-container lp-hero__visual">
        <FlowMock />
      </div>
    </section>
  );
}
