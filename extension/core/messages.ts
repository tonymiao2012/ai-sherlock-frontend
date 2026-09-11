// 消息协议：页面(MAIN world) <-> content script <-> 扩展上下文(background/sidepanel/report)
import type { EvidenceEvent, UserFormInput } from './types';

export const PAGE_SOURCE = 'ai-sherlock-page';
export const CONTENT_SOURCE = 'ai-sherlock-content';
export const PREVIEW_SOURCE = 'ai-sherlock-preview';

/** MAIN world -> content script 的 window.postMessage */
export type PageToContentMsg =
  | { source: typeof PAGE_SOURCE; type: 'evidence-event'; event: EvidenceEvent }
  | {
      source: typeof PAGE_SOURCE;
      type: 'cmd-response';
      reqId: string;
      ok: boolean;
      payload?: unknown;
      error?: string;
    };

/** content script -> MAIN world 的 window.postMessage */
export type ContentToPageMsg = {
  source: typeof CONTENT_SOURCE;
  type: 'start-recording' | 'stop-recording' | 'dump-evidence';
  reqId: string;
};

/** preview iframe -> content script 的 window.parent.postMessage */
export type PreviewToContentMsg =
  | { source: typeof PREVIEW_SOURCE; type: 'preview-ready' }
  | { source: typeof PREVIEW_SOURCE; type: 'preview-close' };

/** content script -> preview iframe 的 window.postMessage */
export type ContentToPreviewMsg = {
  source: typeof CONTENT_SOURCE;
  type: 'preview-events';
  events: unknown[];
  audio?: import('./types').AudioTrack;
};

/** chrome.runtime 消息（扩展上下文之间） */
export type RuntimeMessage =
  | { type: 'capture-screenshot' }
  /** dataUrl：预取的全页底图，供取色/放大镜、裁剪与页内批注 */
  | { type: 'start-region-select'; dataUrl?: string }
  /** 面板聚焦时页面收不到 Esc，经此转发让覆盖层取消 */
  | { type: 'cancel-capture' }
  /** 让页面重新批注一张已有截图（侧边栏 -> content） */
  | { type: 'reannotate-image'; dataUrl: string }
  | { type: 'submit-issue'; form: UserFormInput; screenshots: import('./types').ScreenshotItem[]; audio?: import('./types').AudioTrack }
  | { type: 'dump-evidence' }
  | { type: 'preview-recording'; audio?: import('./types').AudioTrack }
  | { type: 'start-recording' }
  | { type: 'stop-recording' }
  | { type: 'evidence-event'; event: EvidenceEvent }
  | { type: 'get-report' }
  | { type: 'fetch-cases' }
  | { type: 'fetch-case-detail'; caseKey: string };

/** content -> 侧边栏：页内批注后的成图 */
export type CaptureResult =
  | { ok: true; dataUrl: string; annotated: boolean }
  | { ok: false; canceled?: boolean; error?: string };

/** 带完整 sendResponse 语义的运行时消息发送 */
export function sendRuntime<T = any>(message: RuntimeMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp as T);
        }
      });
    } catch (e) {
      reject(e as Error);
    }
  });
}

/** 向当前激活标签页的 content script 发消息 */
export async function sendToActiveTab<T = any>(
  message: RuntimeMessage
): Promise<T> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab?.id) throw new Error('No active tab');
  return chrome.tabs.sendMessage(tab.id, message);
}

export function uid(prefix = ''): string {
  return (
    prefix +
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  );
}
