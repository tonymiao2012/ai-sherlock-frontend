// background service worker：
// 1. 点击图标打开 Side Panel
// 2. 可见区域截图（captureVisibleTab）
// 3. 提交时向页面拉取证据、组装问题包、写入 IndexedDB、打开数据接收页
import { loadReport, saveReport } from '../../core/db';
import { sendToActiveTab, uid, type RuntimeMessage } from '../../core/messages';
import type {
  EvidenceDump,
  IssuePackage,
  ScreenshotItem,
  UserFormInput,
} from '../../core/types';

export default defineBackground(() => {
  // 点击扩展图标直接打开 Side Panel
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});

  chrome.runtime.onMessage.addListener(
    (
      msg: RuntimeMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (resp: unknown) => void
    ) => {
      handleMessage(msg)
        .then(sendResponse)
        .catch((e) => sendResponse({ ok: false, error: String(e) }));
      return true; // 异步 sendResponse
    }
  );
});

async function handleMessage(msg: RuntimeMessage): Promise<unknown> {
  switch (msg.type) {
    case 'capture-screenshot':
      return captureScreenshot();
    case 'submit-issue':
      return submitIssue(msg.form, msg.screenshots);
    case 'get-report':
      return { ok: true, report: await loadReport() };
    case 'evidence-event':
      // sidepanel 自行订阅，background 仅 ack，避免 "no listener" 报错
      return { ok: true };
    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

async function captureScreenshot(): Promise<
  { ok: true; dataUrl: string } | { ok: false; error: string }
> {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.windowId) return { ok: false, error: 'No active window' };
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 92,
    });
    return { ok: true, dataUrl };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function submitIssue(
  form: UserFormInput,
  screenshots: ScreenshotItem[]
): Promise<{ ok: boolean; error?: string }> {
  let dump: EvidenceDump | undefined;
  let evidenceError: string | undefined;
  try {
    const resp = await sendToActiveTab<{
      ok: boolean;
      dump?: EvidenceDump;
      error?: string;
    }>({ type: 'dump-evidence' });
    if (resp?.ok) dump = resp.dump;
    else evidenceError = resp?.error || 'Page returned no evidence';
  } catch (e) {
    // 页面未注入（如 chrome:// 页面）时降级：仅提交表单与截图
    evidenceError = String(e);
    console.warn('[AI Sherlock] evidence dump failed, submitting without it', e);
  }
  if (evidenceError) {
    // 带上当前页地址：采集失败几乎都是“注入脚本没跑在这个 tab 上”
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    evidenceError += ` (active tab: ${tab?.url ?? 'none'})`;
  }

  const pkg = buildPackage(form, screenshots, dump, evidenceError);
  // MVP：直接打印完整 payload，可在 chrome://extensions -> service worker 控制台查看
  console.log('[AI Sherlock] issue payload:', pkg);
  console.log(
    '[AI Sherlock] payload JSON:',
    JSON.stringify(pkg, null, 2)
  );
  await saveReport(pkg);
  await chrome.tabs.create({ url: chrome.runtime.getURL('/report.html') });
  return { ok: true };
}

function buildPackage(
  form: UserFormInput,
  screenshots: ScreenshotItem[],
  dump?: EvidenceDump,
  evidenceError?: string
): IssuePackage {
  const now = new Date().toISOString();
  return {
    issueId: uid('iss-'),
    sessionId: uid('ses-'),
    title: form.title,
    description: form.description,
    steps: form.steps || undefined,
    expectedResult: form.expectedResult || undefined,
    severity: form.severity,
    screenshots,
    pageContext:
      dump?.pageContext ?? {
        url: 'unknown',
        title: '',
        route: '',
        referrer: '',
        userAgent: '',
        viewport: { width: 0, height: 0 },
        language: '',
        submittedAt: now,
      },
    network: dump?.network ?? [],
    consoleErrors: dump?.consoleEntries ?? [],
    stacks: dump?.errors ?? [],
    sourceHints: {},
    ...(evidenceError ? { evidenceError } : {}),
    rrwebEvents: dump?.rrwebEvents?.length ? dump.rrwebEvents : undefined,
    recordingSeconds: dump?.recordingSeconds,
    meta: { pluginVersion: '0.1.0-mvp', assembledAt: now },
  };
}
