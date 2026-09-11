// ISOLATED world content script：
// 1. 把 MAIN world 的实时证据事件转发到扩展上下文（sidepanel 实时统计）
// 2. 把 background 的指令（录制开始/停止、证据 dump）转发给 MAIN world 并等待结果
// 3. 录制覆盖层：确认 → 麦克风授权 → 倒计时 → 浮动控制条（截图改由 sidepanel 直接插入，预览也在 sidepanel）
import {
  CONTENT_SOURCE,
  PAGE_SOURCE,
  uid,
  type PageToContentMsg,
  type RuntimeMessage,
} from '../../core/messages';
import type { AudioTrack, EvidenceDump } from '../../core/types';
import {
  requestMicPermission,
  startMicRecording,
  type MicRecording,
} from '../../core/audio';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  runAt: 'document_start',
  main() {
    listenPageEvents();
    listenRuntimeCommands();
  },
});

function postCommand(
  type: 'start-recording' | 'stop-recording' | 'dump-evidence'
): Promise<{ ok: boolean; payload?: unknown; error?: string }> {
  const reqId = uid('req-');
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMsg);
      resolve({ ok: false, error: 'Timed out waiting for the injected script' });
    }, 5000);

    function onMsg(e: MessageEvent) {
      const data = e.data as PageToContentMsg | undefined;
      if (
        !data ||
        data.source !== PAGE_SOURCE ||
        data.type !== 'cmd-response' ||
        data.reqId !== reqId
      ) {
        return;
      }
      clearTimeout(timer);
      window.removeEventListener('message', onMsg);
      resolve({ ok: data.ok, payload: data.payload, error: data.error });
    }

    window.addEventListener('message', onMsg);
    window.postMessage({ source: CONTENT_SOURCE, type, reqId }, '*');
  });
}

/** MAIN world 实时证据事件 -> chrome.runtime（sidepanel 订阅展示） */
function listenPageEvents() {
  window.addEventListener('message', (e) => {
    const data = e.data as PageToContentMsg | undefined;
    if (!data || data.source !== PAGE_SOURCE || data.type !== 'evidence-event')
      return;
    try {
      chrome.runtime.sendMessage(
        { type: 'evidence-event', event: data.event } satisfies RuntimeMessage,
        () => void chrome.runtime.lastError
      );
    } catch {
      // 扩展上下文不可用时静默
    }
  });
}

/* ------------------------------------------------------- 录制 + 麦克风 */

/** 当前录制会话的麦克风。授权必须在 content script 里发起：
 *  Chrome 的麦克风授权框挂在页面所属站点上，extension 上下文（sidepanel）弹不了授权框 */
let activeMic: MicRecording | null = null;

/** 授权有结果（允许=带声音，拒绝/失败=纯录屏）后才启动 rrweb */
async function startRecordingWithMic(): Promise<{
  ok: boolean;
  withAudio?: boolean;
  error?: string;
}> {
  if (activeMic) return { ok: false, error: 'Recording already in progress' };
  let mic: MicRecording | null = null;
  try {
    mic = await startMicRecording();
  } catch {
    mic = null;
  }
  const r = await postCommand('start-recording');
  if (!r.ok) {
    await mic?.stop().catch(() => null);
    return { ok: false, error: r.error || 'The injected page script did not respond' };
  }
  activeMic = mic;
  return { ok: true, withAudio: !!mic };
}

async function stopRecordingWithMic(): Promise<{
  ok: boolean;
  dump?: EvidenceDump;
  error?: string;
}> {
  const r = await postCommand('stop-recording');
  const mic = activeMic;
  activeMic = null;
  if (!r.ok) {
    await mic?.stop().catch(() => null);
    return { ok: false, error: r.error || 'The injected page script did not respond' };
  }
  const audio = mic ? await mic.stop().catch(() => null) : null;
  return { ok: true, dump: { ...(r.payload as EvidenceDump), audio: audio ?? undefined } };
}

/* ---------------------------------------------- 录制确认 + 倒计时 + 浮动控制条 */

/** 在主页面展示录制确认 → 3 秒倒计时 → 浮动录制控制条（业界主流风格） */
function startRecordingOverlay(): void {
  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;';

  const style = document.createElement('style');
  style.textContent = `
@keyframes shr-fadein{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes shr-pulse-ring{0%{transform:scale(1);opacity:.5}100%{transform:scale(2.2);opacity:0}}
@keyframes shr-count-in{0%{opacity:0;transform:scale(.4)}25%{opacity:1;transform:scale(1.08)}100%{opacity:1;transform:scale(1)}}
@keyframes shr-rec-dot{0%,100%{opacity:1}50%{opacity:.25}}
`;
  overlay.appendChild(style);

  /* ---- 阶段 1：确认对话框 ---- */
  const card = document.createElement('div');
  card.style.cssText =
    'background:#fff;border-radius:16px;padding:36px 44px;text-align:center;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.35);animation:shr-fadein .2s ease-out;';
  card.innerHTML = `
    <div style="width:56px;height:56px;border-radius:50%;background:#f0f5e8;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#67B820" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    </div>
    <div style="font-size:18px;font-weight:600;color:#1a1a1a;margin-bottom:10px">Start recording?</div>
    <div style="font-size:14px;color:#666;line-height:1.7;margin-bottom:28px">
      Your page actions and microphone audio will be recorded.<br/>
      First time on this site? Chrome will ask for mic permission on the page.
    </div>
    <div style="display:flex;gap:12px;justify-content:center">
      <button data-act="cancel" style="padding:10px 28px;border-radius:10px;border:1px solid #d9d9d9;background:#fff;font-size:14px;cursor:pointer;color:#333;font-family:inherit">Cancel</button>
      <button data-act="start" style="padding:10px 28px;border-radius:10px;border:none;background:#67B820;color:#17240C;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Start</button>
    </div>
  `;
  overlay.appendChild(card);
  document.documentElement.appendChild(overlay);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    overlay.remove();
  };

  const cancel = () => {
    cleanup();
    try {
      chrome.runtime.sendMessage({ type: 'recording-canceled' } as RuntimeMessage, () => void chrome.runtime.lastError);
    } catch { /* 扩展上下文不可用时静默 */ }
  };

  card.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'cancel') cancel();
    else if (act === 'start') beginCountdown();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cancel();
  });

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cancel();
  };
  window.addEventListener('keydown', onKey, true);

  /* ---- 阶段 2：先请求麦克风授权，有结果后再 3 秒倒计时 ---- */
  const beginCountdown = async () => {
    card.remove();

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'color:#fff;font-size:16px;text-shadow:0 2px 8px rgba(0,0,0,.4);';
    statusEl.textContent = 'Waiting for microphone permission…';
    overlay.appendChild(statusEl);

    /* ---- 先请求麦克风授权（只授权，不正式录音）---- */
    let permissionStream: MediaStream | null = null;
    try {
      permissionStream = await requestMicPermission();
    } catch {
      permissionStream = null;
    }
    if (cleaned) {
      permissionStream?.getTracks().forEach((t) => t.stop());
      return;
    }
    statusEl.remove();

    const countEl = document.createElement('div');
    countEl.style.cssText = 'position:relative;display:flex;align-items:center;justify-content:center;';
    const ring = document.createElement('div');
    ring.style.cssText =
      'position:absolute;width:120px;height:120px;border-radius:50%;border:3px solid #67B820;animation:shr-pulse-ring 1s ease-out infinite;';
    const num = document.createElement('div');
    num.style.cssText =
      'font-size:80px;font-weight:700;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.4);line-height:1;';
    countEl.append(ring, num);
    overlay.appendChild(countEl);

    for (let i = 3; i >= 1; i--) {
      if (cleaned) {
        permissionStream?.getTracks().forEach((t) => t.stop());
        return;
      }
      num.textContent = String(i);
      num.style.animation = 'none';
      void num.offsetWidth;
      num.style.animation = 'shr-count-in .6s ease-out';
      await sleep(1000);
    }
    if (cleaned) {
      permissionStream?.getTracks().forEach((t) => t.stop());
      return;
    }

    /* ---- 倒计时结束：rrweb 与麦克风正式同步开录 ---- */
    num.remove();
    ring.remove();

    statusEl.textContent = 'Starting recording…';
    overlay.appendChild(statusEl);

    const r = await postCommand('start-recording');
    if (!r.ok) {
      permissionStream?.getTracks().forEach((t) => t.stop());
      statusEl.textContent = 'Failed to start recording';
      await sleep(1500);
      cancel();
      return;
    }

    let mic: MicRecording | null = null;
    let micStartTime = 0;
    if (permissionStream) {
      try {
        mic = await startMicRecording(permissionStream);
        micStartTime = Date.now();
      } catch {
        mic = null;
      }
    }
    activeMic = mic;
    const withAudio = !!mic;

    try {
      chrome.runtime.sendMessage({ type: 'recording-started' } as RuntimeMessage, () => void chrome.runtime.lastError);
    } catch { /* ignore */ }

    statusEl.remove();
    window.removeEventListener('keydown', onKey, true);

    showRecordingBar(overlay, withAudio, micStartTime || Date.now());

    overlay.style.background = 'transparent';
    overlay.style.pointerEvents = 'none';
  };
}

/** 阶段 3：底部浮动录制控制条（计时 + 停止按钮） */
function showRecordingBar(overlay: HTMLElement, withAudio: boolean, startTime: number): void {
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:fixed;bottom:32px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:14px;padding:10px 10px 10px 18px;background:rgba(30,30,30,.92);border-radius:999px;box-shadow:0 8px 32px rgba(0,0,0,.45);backdrop-filter:blur(12px);z-index:2147483647;pointer-events:auto;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;opacity:0;transition:opacity .2s ease-out;';

  const dot = document.createElement('div');
  dot.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#ff4d4f;animation:shr-rec-dot 1.2s ease-in-out infinite;flex-shrink:0;';

  const timer = document.createElement('div');
  timer.style.cssText = 'color:#fff;font-size:15px;font-weight:500;font-variant-numeric:tabular-nums;min-width:42px;';

  const label = document.createElement('div');
  label.style.cssText = 'color:rgba(255,255,255,.5);font-size:12px;white-space:nowrap;';
  label.textContent = withAudio ? 'REC · Audio' : 'REC';

  const stopBtn = document.createElement('button');
  stopBtn.style.cssText =
    'display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;border:none;background:#ff4d4f;cursor:pointer;flex-shrink:0;transition:background .15s;';
  stopBtn.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" fill="#fff"><rect x="2" y="2" width="10" height="10" rx="1.5"/></svg>';
  stopBtn.addEventListener('mouseenter', () => { stopBtn.style.background = '#e03e3e'; });
  stopBtn.addEventListener('mouseleave', () => { stopBtn.style.background = '#ff4d4f'; });

  bar.append(dot, timer, label, stopBtn);
  overlay.appendChild(bar);
  void bar.offsetWidth;
  bar.style.opacity = '1';

  const tick = () => {
    if (!bar.isConnected) return;
    const elapsed = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
    const m = Math.floor(elapsed / 60);
    const s = elapsed % 60;
    timer.textContent = `${m}:${String(s).padStart(2, '0')}`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  stopBtn.addEventListener('click', async () => {
    stopBtn.disabled = true;
    stopBtn.style.opacity = '0.5';
    const resp = await stopRecordingWithMic();
    overlay.remove();
    if (resp.ok && resp.dump) {
      try {
        chrome.runtime.sendMessage(
          { type: 'recording-stopped', dump: resp.dump } as RuntimeMessage,
          () => void chrome.runtime.lastError
        );
      } catch { /* ignore */ }
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


/* --------------------------------------------------------- 指令中转 */

/** background -> content -> MAIN world 指令中转 */
function listenRuntimeCommands() {
  chrome.runtime.onMessage.addListener(
    (
      msg: RuntimeMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (resp: unknown) => void
    ) => {
      if (msg?.type === 'start-recording-overlay') {
        startRecordingOverlay();
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'start-recording') {
        startRecordingWithMic().then(sendResponse);
        return true;
      }
      if (msg?.type === 'stop-recording') {
        stopRecordingWithMic().then(sendResponse);
        return true;
      }
      if (msg?.type === 'dump-evidence') {
        postCommand('dump-evidence').then((r) => {
          if (!r.ok) {
            sendResponse({
              ok: false,
              error: r.error || 'The injected page script did not respond',
            });
            return;
          }
          sendResponse({ ok: true, dump: r.payload as EvidenceDump });
        });
        return true; // 异步 sendResponse
      }
      return false;
    }
  );
}
