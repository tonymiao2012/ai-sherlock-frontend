// 消息协议：页面(MAIN world) <-> content script <-> 扩展上下文(background/sidepanel/report)
import type { EvidenceEvent, UserFormInput } from './types';

export const PAGE_SOURCE = 'ai-sherlock-page';
export const CONTENT_SOURCE = 'ai-sherlock-content';

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

/** chrome.runtime 消息（扩展上下文之间） */
export type RuntimeMessage =
  | { type: 'capture-screenshot' }
  | { type: 'submit-issue'; form: UserFormInput; screenshots: import('./types').ScreenshotItem[]; audio?: import('./types').AudioTrack }
  | { type: 'dump-evidence' }
  | { type: 'start-recording' }
  | { type: 'stop-recording' }
  /** 让 content script 在主页面展示录制确认 + 倒计时 + 浮动控制条的完整流程 */
  | { type: 'start-recording-overlay' }
  /** content script → sidepanel：倒计时结束，录制真正开始 */
  | { type: 'recording-started' }
  /** content script → sidepanel：用户在主页面取消了录制确认 */
  | { type: 'recording-canceled' }
  /** content script → sidepanel：录制已在主页面停止，附带完整证据 */
  | { type: 'recording-stopped'; dump: import('./types').EvidenceDump }
  | { type: 'evidence-event'; event: EvidenceEvent }
  | { type: 'get-report' }
  | { type: 'fetch-cases' }
  | { type: 'fetch-case-detail'; caseKey: string };

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
