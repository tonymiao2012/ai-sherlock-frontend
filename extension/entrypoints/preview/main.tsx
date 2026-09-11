// 录制回放预览页（unlisted page）：被 content script 以 iframe 内嵌在当前网页的全屏遮罩中
// 握手：ready -> content 传入 rrweb 事件 + 麦克风音频；Esc/✕ 通知 content 关闭遮罩
// 音频与画面同一条时间轴：audio.startedAt 与 rrweb 事件戳同为 Date.now() 绝对毫秒，
// offset = startedAt - 首个事件时间戳；播放/暂停/拖动/倍速跟随 replayer
import './style.css';
import { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { CloseOutlined } from '@ant-design/icons';
import { CONTENT_SOURCE, PREVIEW_SOURCE, type ContentToPreviewMsg } from '../../core/messages';
import ReplayPlayer from '../../components/ReplayPlayer';
import type { AudioTrack } from '../../core/types';
import type { eventWithTime } from '@rrweb/types';

function PreviewApp() {
  const [events, setEvents] = useState<eventWithTime[] | null>(null);
  const [audio, setAudio] = useState<AudioTrack | null>(null);
  const [size] = useState(() => ({
    width: Math.max(320, Math.min(1080, window.innerWidth - 40)),
    height: Math.max(240, window.innerHeight - 130),
  }));

  useEffect(() => {
    const close = () =>
      window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'preview-close' }, '*');
    window.parent.postMessage({ source: PREVIEW_SOURCE, type: 'preview-ready' }, '*');
    const onMsg = (e: MessageEvent) => {
      const data = e.data as ContentToPreviewMsg | undefined;
      if (!data || data.source !== CONTENT_SOURCE || data.type !== 'preview-events') return;
      setEvents(data.events as eventWithTime[]);
      setAudio(data.audio ?? null);
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

  // 音频跟随回放：rrweb 只发 start/play-back/resume/pause/finish/skip-*（没有 play、
  // ui-update-*），事件只切换播放状态；对齐交给 rAF 阈值重同步（覆盖拖动与倍速）。
  // autoPlay 必须为 false：点击在侧边栏，iframe 里没有用户手势，自动 audio.play() 会被拦。
  const handlePlayerReady = (player: any) => {
    if (!audio || !events?.length) return;
    const el = new Audio(audio.dataUrl);
    const replayer = player.getReplayer();
    const offsetMs = Math.max(0, audio.startedAt - (events[0]?.timestamp ?? 0));

    let playing = false;
    let raf = 0;
    const tick = () => {
      if (!replayer.wrapper?.isConnected) return; // 预览已关闭/实例被销毁
      if (playing) {
        const expected = (offsetMs + replayer.getCurrentTime()) / 1000;
        el.playbackRate = replayer.config?.speed ?? 1;
        if (Number.isFinite(expected) && Math.abs(el.currentTime - expected) > 0.3) {
          try {
            el.currentTime = expected;
          } catch {
            // expected 超出音频时长时个别浏览器会抛，忽略即可
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    const play = () => {
      playing = true;
      void el.play().catch(() => {});
    };
    const stop = () => {
      playing = false;
      el.pause();
    };
    replayer.on('start', play);
    replayer.on('play-back', play);
    replayer.on('resume', play);
    replayer.on('pause', stop);
    replayer.on('finish', stop);
    raf = requestAnimationFrame(tick);
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', color: '#e6e6e6' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '10px 16px',
          flexShrink: 0,
        }}
      >
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
          <ReplayPlayer events={events} width={size.width} height={size.height} autoPlay={false} hideHint onReady={handlePlayerReady} />
        ) : (
          <span style={{ color: '#999', fontSize: 13 }}>Loading recording…</span>
        )}
      </div>
    </div>
  );
}

const rootEl = document.getElementById('root')!;
const existingRoot = (rootEl as any).__ai_sherlock_root__ as ReturnType<typeof ReactDOM.createRoot> | undefined;
if (existingRoot) {
  existingRoot.render(<PreviewApp />);
} else {
  (rootEl as any).__ai_sherlock_root__ = ReactDOM.createRoot(rootEl);
  (rootEl as any).__ai_sherlock_root__.render(<PreviewApp />);
}
