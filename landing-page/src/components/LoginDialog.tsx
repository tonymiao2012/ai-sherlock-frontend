import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN_URL } from '../assets';
import { IconClose, IconGoogle, IconLock } from './icons';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function LoginDialog({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const googleLogin = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('未配置 VITE_GOOGLE_CLIENT_ID，暂时无法发起 Google 登录。');
      return;
    }
    window.location.href = `${API_BASE}/auth/google/start`;
  };

  const passwordLogin = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.status === 404 || res.status === 405) {
        setError(`后端未连接：${API_BASE}/auth/login 不存在。`);
        return;
      }
      if (!res.ok) {
        setError(res.status === 401 ? '用户名或密码错误。' : `登录失败（HTTP ${res.status}）。`);
        return;
      }
      // 后端未启动时开发服务器会回退返回 index.html，需按 JSON 判定真实登录结果
      try {
        await res.json();
      } catch {
        setError(`后端未连接：${API_BASE}/auth/login 返回了非 JSON 响应。`);
        return;
      }
      window.location.href = ADMIN_URL;
    } catch {
      setError(`后端未连接：${API_BASE}/auth/login 不可达。`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="lp-modal" role="dialog" aria-modal="true" aria-label="登录 AI Sherlock" onClick={onClose}>
      <div className="lp-modal__card" onClick={(e) => e.stopPropagation()}>
        <div className="lp-modal__head">
          <div>
            <h3 className="lp-h3" style={{ fontSize: 22 }}>
              登录 AI Sherlock
            </h3>
            <p className="lp-form__note">一个 Email，一个用户：Google 与企业 SSO 共用同一账号。</p>
          </div>
          <button type="button" className="lp-modal__close" aria-label="关闭" onClick={onClose}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="lp-modal__body">
          <button type="button" className="lp-btn lp-btn--ghost" onClick={googleLogin}>
            <IconGoogle />
            Sign in with Google
          </button>
          <button type="button" className="lp-btn lp-btn--ghost" disabled>
            企业登录 <span className="lp-soon">Coming Soon</span>
          </button>

          <span className="lp-signin__divider">开发 / 演示账号</span>

          <form className="lp-form" onSubmit={passwordLogin}>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              autoComplete="username"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              autoComplete="current-password"
              required
            />
            <button type="submit" className="lp-btn lp-btn--primary" disabled={pending}>
              <IconLock size={14} />
              {pending ? '登录中…' : '登录控制台'}
            </button>
            {error ? <p className="lp-form__error">{error}</p> : null}
            <p className="lp-form__note">用户名密码通道仅用于本地开发与演示，生产环境可关闭。</p>
          </form>
        </div>
      </div>
    </div>
  );
}
