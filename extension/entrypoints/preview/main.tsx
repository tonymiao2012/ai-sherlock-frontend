// 录制回放预览页（unlisted page）：被 content script 以 iframe 内嵌在当前网页的全屏遮罩中
// 握手：ready -> content 传入 rrweb 事件；Esc/✕ 通知 content 关闭遮罩
import './style.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CloseOutlined } from '@ant-design/icons';
import { CONTENT_SOURCE, PREVIEW_SOURCE, type ContentToPreviewMsg } from '../../core/messages';
import ReplayPlayer from '../../components/ReplayPlayer';
import type { eventWithTime } from '@rrweb/types';

function PreviewApp() {
  const [events, setEvents] = useState<eventWithTime[] | null>(null);
  const [size] = useState(() => ({
    width: Math.max(320, Math.min(1080, window.innerWidth - 40)),
    height: Math.max(240, window.innerHeight - 96),
  }));

  useEffect(() => {
    const close = () =>
      window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'preview-close' }, '*');
    window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'preview-ready' }, '*');
    const onMsg = (e: MessageEvent) => {
      const data = e.data as ContentToPreviewMsg | undefined;
      if (!data || data.source !== CONTENT_SOURCE || data.type !== 'preview-events') return;
      setEvents(data.events as eventWithTime[]);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('message', onMsg);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMsg);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', color: '#e6e6e6' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13 }}>
          Recording preview
          {events ? ` · ${events.length} events` : ''}
        </span>
        <button
          onClick={() =>
            window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'preview-close' }, '*')
          }
          style={{
            border: 'none',
            background: 'transparent',
            color: '#e6e6e6',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Close preview"
        >
          <CloseOutlined />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {events ? (
          <ReplayPlayer events={events} width={size.width} height={size.height} autoPlay />
        ) : (
          <span style={{ color: '#999', fontSize: 13 }}>Loading recording…</span>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
