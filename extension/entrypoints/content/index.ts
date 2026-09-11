// ISOLATED world content script：
// 1. 把 MAIN world 的实时证据事件转发到扩展上下文（sidepanel 实时统计）
// 2. 把 background 的指令（录制开始/停止、证据 dump）转发给 MAIN world 并等待结果
// 3. 微信式截图：整页灰遮罩 + 准星 + 放大镜框选，选完不弹新窗口，
//    直接在截图上批注（工具条浮在选区下方），✓ 后把成图回传侧边栏
import {
  CONTENT_SOURCE,
  PAGE_SOURCE,
  PREVIEW_SOURCE,
  uid,
  type CaptureResult,
  type ContentToPreviewMsg,
  type PageToContentMsg,
  type PreviewToContentMsg,
  type RuntimeMessage,
} from '../../core/messages';
import type { AudioTrack, EvidenceDump } from '../../core/types';
import { startMicRecording, type MicRecording } from '../../core/audio';

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

interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type SelectOutcome =
  | { ok: true; rect: RegionRect }
  | { ok: false; canceled?: boolean; error?: string };

/* ------------------------------------------------------------------ 截图 */

/** 框选 + 页内批注的完整流程（不新开窗口） */
async function startCapture(dataUrl?: string): Promise<CaptureResult> {
  if (!dataUrl) return { ok: false, error: 'No page screenshot to crop' };
  const src = await decodeCanvas(dataUrl);
  if (!src) return { ok: false, error: 'Failed to decode the page screenshot' };

  const sel = await selectRegion(src);
  if (!sel.ok) return sel;

  const base = cropCanvas(src, sel.rect);
  if (!base) return { ok: false, error: 'Selection is outside the capture' };
  const result = await openAnnotationEditor(base, {
    left: sel.rect.x,
    top: sel.rect.y,
    cssW: sel.rect.width,
    cssH: sel.rect.height,
    phase: 'capture',
  });
  if (!result.ok) return result;
  return { ok: true, dataUrl: result.dataUrl, annotated: result.annotated };
}

/** 重新批注侧边栏里已有的截图：居中展示同一套工具条 */
async function startReannotate(dataUrl: string): Promise<CaptureResult> {
  const base = await decodeCanvas(dataUrl);
  if (!base) return { ok: false, error: 'Failed to decode the image' };

  const maxW = Math.max(320, window.innerWidth * 0.86);
  const maxH = Math.max(240, window.innerHeight * 0.76);
  const k = Math.min(1, maxW / base.width, maxH / base.height);
  const cssW = Math.round(base.width * k);
  const cssH = Math.round(base.height * k);
  const result = await openAnnotationEditor(base, {
    left: Math.round((window.innerWidth - cssW) / 2),
    top: Math.round((window.innerHeight - cssH) / 2),
    cssW,
    cssH,
    phase: 'edit',
  });
  if (!result.ok) return result;
  return { ok: true, dataUrl: result.dataUrl, annotated: true };
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

/* ---------------------------------------------------------------- 录制预览 */

/** 当前打开中的预览遮罩；再次触发时先关闭（toggle） */
let closePreview: (() => void) | null = null;

/** 在当前页面上以遮罩 + iframe 预览本次录制的 rrweb 回放（audio 若有则同步播放） */
async function startRecordingPreview(audio?: AudioTrack): Promise<{ ok: boolean; error?: string }> {
  if (closePreview) {
    closePreview();
    return { ok: true };
  }
  const dumpResp = await postCommand('dump-evidence');
  if (!dumpResp.ok) {
    return { ok: false, error: dumpResp.error || 'The injected page script did not respond' };
  }
  const events = (dumpResp.payload as EvidenceDump | undefined)?.rrwebEvents ?? [];
  if (events.length === 0) {
    return { ok: false, error: 'No recording on this page' };
  }

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;';
  const frame = document.createElement('iframe');
  frame.src = chrome.runtime.getURL('/preview.html');
  frame.allow = 'autoplay';
  frame.style.cssText =
    'width:min(94vw,1120px);height:min(88vh,800px);border:none;border-radius:12px;box-shadow:0 12px 48px rgba(0,0,0,0.5);background:#1f1f1f;';
  overlay.appendChild(frame);
  document.documentElement.appendChild(overlay);

  const cleanup = () => {
    overlay.remove();
    window.removeEventListener('message', onMsg);
    window.removeEventListener('keydown', onKey, true);
    closePreview = null;
  };
  const onMsg = (e: MessageEvent) => {
    const data = e.data as PreviewToContentMsg | undefined;
    if (!data || data.source !== PREVIEW_SOURCE) return;
    if (data.type === 'preview-ready') {
      // rrweb 事件体积可观，用 postMessage 直传（structured clone），不走 chrome.storage
      frame.contentWindow?.postMessage(
        {
          source: CONTENT_SOURCE,
          type: 'preview-events',
          events,
          audio,
        } satisfies ContentToPreviewMsg,
        new URL(frame.src).origin
      );
    } else if (data.type === 'preview-close') {
      cleanup();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') cleanup();
  };
  window.addEventListener('message', onMsg);
  window.addEventListener('keydown', onKey, true);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cleanup();
  });
  closePreview = cleanup;
  return { ok: true };
}

function decodeCanvas(dataUrl?: string): Promise<HTMLCanvasElement | null> {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/** 按选区（CSS px）从整页底图裁剪，dpr 由底图/视口比例推出 */
function cropCanvas(
  src: HTMLCanvasElement,
  rect: RegionRect
): HTMLCanvasElement | null {
  const kx = src.width / Math.max(1, window.innerWidth);
  const ky = src.height / Math.max(1, window.innerHeight);
  const sx = Math.max(0, Math.min(src.width - 1, Math.round(rect.x * kx)));
  const sy = Math.max(0, Math.min(src.height - 1, Math.round(rect.y * ky)));
  const sw = Math.max(1, Math.min(src.width - sx, Math.round(rect.width * kx)));
  const sh = Math.max(1, Math.min(src.height - sy, Math.round(rect.height * ky)));
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

/* --------------------------------------------------- 1) 微信式区域框选 */

/** 专业截图准星光标（白描边十字） */
const CROSSHAIR =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='25' height='25'><g stroke='white' stroke-width='3' fill='none'><path d='M12.5 0v9M12.5 16v9M0 12.5h9M16 12.5h9'/></g><circle cx='12.5' cy='12.5' r='1.5' fill='white'/></svg>\") 12 12, crosshair";

/** 微信式截图框选：整页灰遮罩、准星、放大镜、坐标/色值；Esc/右键取消，F 全屏 */
function selectRegion(src: HTMLCanvasElement): Promise<SelectOutcome> {
  return new Promise((resolve) => {
    let done = false;
    const kx = src.width / Math.max(1, window.innerWidth);
    const ky = src.height / Math.max(1, window.innerHeight);

    const overlay = document.createElement('div');
    overlay.style.cssText = `position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.28);cursor:${CROSSHAIR};user-select:none;touch-action:none;`;

    // 选区框：外围压暗由巨大 box-shadow 提供（拖拽后把遮罩背景置透明，避免双重变暗）
    const box = document.createElement('div');
    box.style.cssText =
      'position:fixed;display:none;border:1px solid #17240C;box-shadow:0 0 0 1px rgba(255,255,255,0.9),0 0 0 99999px rgba(0,0,0,0.28);pointer-events:none;';

    const sizeLabel = document.createElement('div');
    sizeLabel.style.cssText =
      'position:fixed;display:none;background:#67B820;color:#17240C;font:600 12px/1.6 ui-monospace,SFMono-Regular,monospace;padding:2px 8px;border-radius:6px;pointer-events:none;';

    const hintBar = document.createElement('div');
    hintBar.textContent = 'Drag to select  ·  F full page  ·  Esc / right-click cancel';
    hintBar.style.cssText =
      'position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(23,36,12,0.85);color:#fff;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;padding:5px 14px;border-radius:999px;pointer-events:none;letter-spacing:0.2px;';

    // 放大镜（圆形）+ 坐标/色值浮签
    const loupe = document.createElement('canvas');
    loupe.width = 132;
    loupe.height = 132;
    loupe.style.cssText =
      'position:fixed;width:66px;height:66px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.45);pointer-events:none;display:none;';
    const posTag = document.createElement('div');
    posTag.innerHTML =
      '<div style="display:flex;align-items:center;gap:5px"><i class="sw" style="width:10px;height:10px;border-radius:2px;display:inline-block;border:1px solid rgba(255,255,255,0.7)"></i><b class="hex"></b></div><div class="xy"></div>';
    posTag.style.cssText =
      'position:fixed;background:rgba(23,36,12,0.85);color:#fff;font:11px/1.5 ui-monospace,SFMono-Regular,monospace;padding:3px 7px;border-radius:6px;pointer-events:none;display:none;white-space:nowrap;';
    const swatchEl = posTag.querySelector<HTMLElement>('.sw')!;
    const hexEl = posTag.querySelector<HTMLElement>('.hex')!;
    const xyEl = posTag.querySelector<HTMLElement>('.xy')!;

    overlay.append(box, sizeLabel, hintBar, loupe, posTag);
    document.documentElement.appendChild(overlay);

    /** 取鼠标处像素（底图分辨率 = CSS × kx/ky） */
    const sampleAt = (cssX: number, cssY: number) => {
      const px = Math.max(0, Math.min(src.width - 1, Math.round(cssX * kx)));
      const py = Math.max(0, Math.min(src.height - 1, Math.round(cssY * ky)));
      const d = src.getContext('2d', { willReadFrequently: true })!.getImageData(px, py, 1, 1).data;
      return {
        hex:
          '#' +
          [d[0], d[1], d[2]]
            .map((v) => v!.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase(),
      };
    };

    let startX = 0;
    let startY = 0;
    let dragging = false;

    const finish = (r: SelectOutcome) => {
      if (done) return;
      done = true;
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
      resolve(r);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish({ ok: false, canceled: true });
      if ((e.key === 'f' || e.key === 'F') && !dragging) {
        finish({
          ok: true,
          rect: { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight },
        });
      }
    };
    window.addEventListener('keydown', onKey, true);

    // 右键取消（微信习惯）
    overlay.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      finish({ ok: false, canceled: true });
    });

    const updateLoupe = (clientX: number, clientY: number) => {
      xyEl.textContent = `(${Math.round(clientX)}, ${Math.round(clientY)})`;
      const s = sampleAt(clientX, clientY);
      if (s) {
        hexEl.textContent = s.hex;
        swatchEl.style.background = s.hex;
        // 放大镜：以鼠标为中心取 17x17 物理像素放大
        const half = 8;
        const px = Math.max(0, Math.min(src.width - 1, Math.round(clientX * kx)));
        const py = Math.max(0, Math.min(src.height - 1, Math.round(clientY * ky)));
        const sx = Math.max(0, Math.min(src.width - half * 2 - 1, px - half));
        const sy = Math.max(0, Math.min(src.height - half * 2 - 1, py - half));
        const lctx = loupe.getContext('2d')!;
        lctx.imageSmoothingEnabled = false;
        lctx.clearRect(0, 0, 132, 132);
        lctx.drawImage(src, sx, sy, half * 2 + 1, half * 2 + 1, 0, 0, 132, 132);
      } else {
        hexEl.textContent = '--';
      }
      const lx = Math.min(window.innerWidth - 90, clientX + 18);
      const ly = Math.min(window.innerHeight - 70, clientY + 18);
      loupe.style.left = lx + 'px';
      loupe.style.top = ly + 'px';
      posTag.style.left = lx + 'px';
      posTag.style.top = ly + 70 + 'px';
    };

    overlay.addEventListener('pointerenter', () => {
      loupe.style.display = 'block';
      posTag.style.display = 'block';
    });

    overlay.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      overlay.setPointerCapture(e.pointerId);
      overlay.style.background = 'transparent'; // 外围压暗交给选框 box-shadow
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;
      box.style.display = 'block';
      sizeLabel.style.display = 'block';
    });

    overlay.addEventListener('pointermove', (e) => {
      updateLoupe(e.clientX, e.clientY);
      if (!dragging) return;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      box.style.width = w + 'px';
      box.style.height = h + 'px';
      sizeLabel.style.left = x + 'px';
      sizeLabel.style.top = Math.min(window.innerHeight - 28, y + h + 6) + 'px';
      sizeLabel.textContent = `${w} × ${h}`;
    });

    overlay.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const x = Math.min(startX, e.clientX);
      const y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX);
      const h = Math.abs(e.clientY - startY);
      if (w < 8 || h < 8) {
        finish({ ok: false, error: 'Selection too small' });
        return;
      }
      finish({ ok: true, rect: { x, y, width: w, height: h } });
    });
  });
}

/* ----------------------------------------------------- 2) 页内批注编辑器 */

type Tool = 'rect' | 'ellipse' | 'arrow' | 'pen' | 'mosaic' | 'text';

interface Shape {
  tool: Tool;
  color: string;
  /** 底图分辨率坐标：rect/ellipse/arrow/mosaic 为 [x0,y0,x1,y1]，pen 为折线，text 为 [x,y] */
  pts: number[];
  text?: string;
  size?: number;
}

const COLORS = ['#f5222d', '#fa8c16', '#1677ff', '#52c41a'];

const ICONS: Record<string, string> = {
  rect: '<rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/>',
  ellipse: '<circle cx="12" cy="12" r="8"/>',
  arrow: '<path d="M5 19L19 5M19 5h-7M19 5v7"/>',
  pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
  mosaic:
    '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="currentColor" stroke="none"/>',
  text: '<path d="M5 7V4.5h14V7M12 4.5v15M8.5 19.5h7"/>',
  undo: '<path d="M4 9h11a5 5 0 1 1 0 10h-6"/><path d="M8 5L4 9l4 4"/>',
  close: '<path d="M5 5l14 14M19 5L5 19"/>',
  check: '<path d="M4 12.5l5.5 6L20 6"/>',
};

function svg(name: string): string {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] ?? ''}</svg>`;
}

/**
 * 在页面上原地批注：截图就贴在它原来的位置，工具条浮在选区下方（空间不足则浮到上方）。
 * ✓ 导出成图，✕ / Esc / 右键放弃。
 */
function openAnnotationEditor(
  base: HTMLCanvasElement,
  pos: { left: number; top: number; cssW: number; cssH: number; phase: 'capture' | 'edit' }
): Promise<
  | { ok: true; dataUrl: string; annotated: boolean }
  | { ok: false; canceled?: boolean; error?: string }
> {
  return new Promise((resolve) => {
    const scale = base.width / Math.max(1, pos.cssW);
    let tool: Tool = 'rect';
    let color = COLORS[0]!;
    const shapes: Shape[] = [];
    let draft: Shape | null = null;
    let settled = false;
    let textEditing = false;

    const root = document.createElement('div');
    root.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.28);user-select:none;touch-action:none;';

    const style = document.createElement('style');
    style.textContent = `
.sh-ed-canvas{position:fixed;touch-action:none;cursor:crosshair;background:#fff;box-shadow:0 0 0 1px #17240C,0 0 0 2px rgba(255,255,255,.92),0 14px 34px rgba(0,0,0,.4)}
.sh-ed-bar{position:fixed;display:flex;align-items:center;gap:3px;padding:5px 7px;background:#fff;border:1px solid #E8EAE2;border-radius:999px;box-shadow:0 6px 22px rgba(0,0,0,.35);font:13px/1 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif}
.sh-ed-colors{display:flex;gap:5px;padding:0 3px}
.sh-ed-color{width:17px;height:17px;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer;display:block}
.sh-ed-color[data-on="1"]{border-color:#1B2117}
.sh-ed-sep{width:1px;height:18px;background:#E8EAE2;margin:0 4px;flex:none}
.sh-ed-tool{width:29px;height:29px;display:inline-flex;align-items:center;justify-content:center;border:none;background:transparent;border-radius:8px;cursor:pointer;color:#454C3F;padding:0;flex:none}
.sh-ed-tool:hover{background:#EEF0E7}
.sh-ed-tool[data-on="1"]{background:#F3FAE9;color:#67B820}
.sh-ed-tool[disabled]{color:#C9CEC2;cursor:default;background:transparent}
.sh-ed-ok{background:#67B820;color:#17240C;border-radius:8px}
.sh-ed-ok:hover{background:#7CC94A}
.sh-ed-hint{position:fixed;top:14px;left:50%;transform:translateX(-50%);background:rgba(23,36,12,.85);color:#fff;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;padding:5px 14px;border-radius:999px;pointer-events:none;letter-spacing:.2px}
.sh-ed-input{position:fixed;background:transparent;border:none;outline:2px dashed rgba(255,255,255,.9);border-radius:2px;padding:0 2px;margin:0;font-weight:600;min-width:60px}
`;
    const canvas = document.createElement('canvas');
    canvas.className = 'sh-ed-canvas';
    canvas.width = base.width;
    canvas.height = base.height;
    canvas.style.left = pos.left + 'px';
    canvas.style.top = pos.top + 'px';
    canvas.style.width = pos.cssW + 'px';
    canvas.style.height = pos.cssH + 'px';

    const ctx = canvas.getContext('2d')!;
    const tmp = document.createElement('canvas');
    const tmpCtx = tmp.getContext('2d')!;

    const hint = document.createElement('div');
    hint.className = 'sh-ed-hint';
    hint.textContent =
      pos.phase === 'capture'
        ? 'Annotate, then ✓ to insert  ·  Esc to cancel'
        : 'Annotate, then ✓ to save  ·  Esc to cancel';

    const bar = document.createElement('div');
    bar.className = 'sh-ed-bar';
    bar.innerHTML =
      `<span class="sh-ed-colors">${COLORS.map(
        (c) => `<button class="sh-ed-color" data-color="${c}" style="background:${c}" data-on="${c === color ? 1 : 0}"></button>`
      ).join('')}</span><i class="sh-ed-sep"></i>` +
      (['rect', 'ellipse', 'arrow', 'pen', 'mosaic', 'text'] as Tool[])
        .map((t) => `<button class="sh-ed-tool" data-tool="${t}" data-on="${t === tool ? 1 : 0}">${svg(t)}</button>`)
        .join('') +
      '<i class="sh-ed-sep"></i>' +
      `<button class="sh-ed-tool" data-act="undo" disabled>${svg('undo')}</button>` +
      '<i class="sh-ed-sep"></i>' +
      `<button class="sh-ed-tool" data-act="cancel">${svg('close')}</button>` +
      `<button class="sh-ed-tool sh-ed-ok" data-act="done">${svg('check')}</button>`;

    root.append(style, canvas, hint, bar);
    document.documentElement.appendChild(root);

    // 工具条：默认浮在选区下方，放不下就浮到上方（微信的做法）
    const layoutBar = () => {
      const r = bar.getBoundingClientRect();
      const below = pos.top + pos.cssH + 10;
      const top =
        below + r.height + 8 <= window.innerHeight
          ? below
          : Math.max(8, pos.top - r.height - 10);
      const left = Math.min(
        Math.max(8, pos.left + pos.cssW / 2 - r.width / 2),
        Math.max(8, window.innerWidth - r.width - 8)
      );
      bar.style.left = Math.round(left) + 'px';
      bar.style.top = Math.round(top) + 'px';
      const hr = hint.getBoundingClientRect();
      const hintTop = Math.min(hr.top, window.innerHeight - hr.height - (r.height + 20));
      hint.style.top = Math.max(8, hintTop) + 'px';
    };
    layoutBar();
    redraw();

    bar.addEventListener('pointerdown', (e) => e.preventDefault());
    bar.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-color],[data-tool],[data-act]');
      if (!el) return;
      const c = el.dataset.color;
      if (c) {
        color = c;
        bar.querySelectorAll<HTMLElement>('[data-color]').forEach((n) => {
          n.dataset.on = n.dataset.color === c ? '1' : '0';
        });
        return;
      }
      const t = el.dataset.tool;
      if (t) {
        tool = t as Tool;
        bar.querySelectorAll<HTMLElement>('[data-tool]').forEach((n) => {
          n.dataset.on = n.dataset.tool === tool ? '1' : '0';
        });
        return;
      }
      if (el.dataset.act === 'undo') {
        shapes.pop();
        syncUndo();
        redraw();
      } else if (el.dataset.act === 'cancel') {
        finish(false);
      } else if (el.dataset.act === 'done') {
        finish(true);
      }
    });

    const syncUndo = () => {
      const undoBtn = bar.querySelector<HTMLButtonElement>('[data-act="undo"]');
      if (undoBtn) undoBtn.disabled = shapes.length === 0;
    };

    const toCanvas = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(base.width, ((clientX - r.left) / r.width) * base.width)),
        y: Math.max(0, Math.min(base.height, ((clientY - r.top) / r.height) * base.height)),
      };
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (e.button !== 0) return;
      const p = toCanvas(e.clientX, e.clientY);
      if (tool === 'text') {
        startText(e.clientX, e.clientY, p.x, p.y);
        return;
      }
      canvas.setPointerCapture(e.pointerId);
      draft =
        tool === 'pen'
          ? { tool, color, pts: [p.x, p.y] }
          : { tool, color, pts: [p.x, p.y, p.x, p.y] };
      redraw();
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!draft) return;
      const p = toCanvas(e.clientX, e.clientY);
      if (draft.tool === 'pen') draft.pts.push(p.x, p.y);
      else {
        draft.pts[2] = p.x;
        draft.pts[3] = p.y;
      }
      redraw();
    });

    canvas.addEventListener('pointerup', () => {
      if (!draft) return;
      const s = draft;
      draft = null;
      const [x0, y0, x1, y1] = s.pts;
      const tiny =
        s.tool === 'pen'
          ? s.pts.length < 4
          : Math.abs((x1 ?? 0) - (x0 ?? 0)) < 3 && Math.abs((y1 ?? 0) - (y0 ?? 0)) < 3;
      if (!tiny) shapes.push(s);
      syncUndo();
      redraw();
    });

    const startText = (clientX: number, clientY: number, cx: number, cy: number) => {
      textEditing = true;
      const size = Math.max(15, base.width * 0.018);
      const input = document.createElement('input');
      input.className = 'sh-ed-input';
      input.type = 'text';
      input.style.left = clientX + 'px';
      input.style.top = clientY - 12 + 'px';
      input.style.color = color;
      input.style.fontSize = size / scale + 'px';
      root.append(input);
      input.focus();
      let closed = false;
      const commit = () => {
        if (closed) return;
        closed = true;
        const v = input.value.trim();
        input.remove();
        textEditing = false;
        if (v) {
          shapes.push({ tool: 'text', color, pts: [cx, cy], text: v, size });
          syncUndo();
          redraw();
        }
      };
      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') commit();
        else if (ev.key === 'Escape') {
          input.value = '';
          commit();
        }
      });
    };

    const onKey = (e: KeyboardEvent) => {
      if (textEditing) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finish(false);
      } else if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        shapes.pop();
        syncUndo();
        redraw();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        finish(true);
      }
    };
    window.addEventListener('keydown', onKey, true);

    root.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      finish(false);
    });

    function redraw() {
      ctx.clearRect(0, 0, base.width, base.height);
      ctx.drawImage(base, 0, 0, base.width, base.height);
      for (const s of shapes) drawShape(s);
      if (draft) drawShape(draft);
    }

    function drawShape(s: Shape) {
      const lw = Math.max(2, base.width * 0.004);
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (s.tool === 'pen') {
        ctx.beginPath();
        for (let i = 0; i + 1 < s.pts.length; i += 2) {
          const [x, y] = [s.pts[i]!, s.pts[i + 1]!];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
        return;
      }
      if (s.tool === 'text') {
        const size = s.size ?? Math.max(15, base.width * 0.018);
        ctx.font = `600 ${size}px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(2, size * 0.12);
        ctx.strokeText(s.text ?? '', s.pts[0]!, s.pts[1]!);
        ctx.fillStyle = s.color;
        ctx.fillText(s.text ?? '', s.pts[0]!, s.pts[1]!);
        ctx.restore();
        return;
      }
      const [x0, y0, x1, y1] = [s.pts[0]!, s.pts[1]!, s.pts[2]!, s.pts[3]!];
      const bx = Math.min(x0, x1);
      const by = Math.min(y0, y1);
      const bw = Math.abs(x1 - x0);
      const bh = Math.abs(y1 - y0);
      if (s.tool === 'mosaic') {
        const block = Math.max(6, Math.round(base.width / 70));
        const tw = Math.max(1, Math.round(bw / block));
        const th = Math.max(1, Math.round(bh / block));
        if (bw < 2 || bh < 2) {
          ctx.restore();
          return;
        }
        tmp.width = tw;
        tmp.height = th;
        tmpCtx.clearRect(0, 0, tw, th);
        tmpCtx.drawImage(base, bx, by, bw, bh, 0, 0, tw, th);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tmp, 0, 0, tw, th, bx, by, tw * block, th * block);
        ctx.restore();
        return;
      }
      if (s.tool === 'rect') ctx.strokeRect(bx, by, bw, bh);
      else if (s.tool === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.max(10, lw * 4);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 6), y1 - head * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6), y1 - head * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
      ctx.restore();
    }

    function finish(ok: boolean) {
      if (settled) return;
      settled = true;
      window.removeEventListener('keydown', onKey, true);
      root.remove();
      if (!ok) {
        resolve({ ok: false, canceled: true });
        return;
      }
      try {
        resolve({
          ok: true,
          dataUrl: canvas.toDataURL('image/jpeg', 0.92),
          annotated: shapes.length > 0,
        });
      } catch (e) {
        resolve({ ok: false, error: String(e) });
      }
    }
  });
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
      // 截图 + 页内批注：纯 DOM 交互，在 ISOLATED world 直接处理
      if (msg?.type === 'start-region-select') {
        startCapture(msg.dataUrl).then(sendResponse);
        return true;
      }
      if (msg?.type === 'cancel-capture') {
        // 键盘焦点在侧边栏时页面收不到 Esc，注入合成 Esc 触发覆盖层的取消监听
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        sendResponse({ ok: true });
        return false;
      }
      if (msg?.type === 'reannotate-image') {
        startReannotate(msg.dataUrl).then(sendResponse);
        return true;
      }
      if (msg?.type === 'preview-recording') {
        startRecordingPreview(msg.audio).then(sendResponse);
        return true;
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
