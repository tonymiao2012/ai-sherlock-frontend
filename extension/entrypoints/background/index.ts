// background service worker：
// 1. 点击图标打开 Side Panel
// 2. 可见区域截图（captureVisibleTab）
// 3. 提交时向页面拉取证据、组装问题包、写入 IndexedDB、打开数据接收页
import { loadCases, loadReport, saveCase, saveReport } from '../../core/db';
import { sendToActiveTab, uid, type RuntimeMessage } from '../../core/messages';
import { isPendingVerifyStatus } from '../../core/types';
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

  // 待验证红点：MV3 service worker 会被回收，SSE 保不住连接，用 alarms 轮询
  chrome.alarms.create('poll-pending-verify', { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'poll-pending-verify') updateVerifyBadge();
  });
  updateVerifyBadge();
});

async function handleMessage(msg: RuntimeMessage): Promise<unknown> {
  switch (msg.type) {
    case 'capture-screenshot':
      return captureScreenshot();
    case 'submit-issue':
      return submitIssue(msg.form, msg.screenshots);
    case 'get-report':
      return { ok: true, report: await loadReport() };
    case 'fetch-cases':
      return fetchCasesList();
    case 'fetch-case-detail':
      return fetchCaseDetail(msg.caseKey);
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
): Promise<{ ok: boolean; error?: string; caseId?: string; caseKey?: string }> {
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
    // 带上当前页地址：采集失败几乎都是”注入脚本没跑在这个 tab 上”
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

  // 调用后端 API
  const apiResp = await postIssue(pkg);
  if (!apiResp.ok) {
    return { ok: false, error: apiResp.error };
  }
  pkg.caseKey = apiResp.caseKey;
  pkg.status = apiResp.status ?? 'RECEIVED';

  // 保存到 IndexedDB（兼容旧逻辑 + 新 Case 列表）
  await saveReport(pkg);
  await saveCase(pkg);
  return { ok: true, caseId: pkg.issueId, caseKey: pkg.caseKey };
}

async function postIssue(
  pkg: IssuePackage
): Promise<{ ok: true; caseKey?: string; status?: string } | { ok: false; error: string }> {
  try {
    const token = await getIngestToken();
    const resp = await fetch('https://www.aisherlock.vip/api/v1/plugin/issues', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Ingest ${token}`,
      },
      body: JSON.stringify(pkg),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error('[AI Sherlock] API error:', resp.status, text);
      return { ok: false, error: `API ${resp.status}: ${text.slice(0, 200)}` };
    }
    const data = (await resp.json()) as { caseKey?: string; status?: string } | undefined;
    console.log('[AI Sherlock] API success:', resp.status, data);
    return { ok: true, caseKey: data?.caseKey, status: data?.status };
  } catch (e) {
    console.error('[AI Sherlock] API request failed:', e);
    return { ok: false, error: `Request failed: ${String(e)}` };
  }
}

async function getIngestToken(): Promise<string> {
  const result = await chrome.storage.local.get('ingestToken');
  return result.ingestToken || '849d5c028ce7bd3ecf54690e1a0457bd5f6abfbb762accff8ee730f5de3166f6';
}

async function apiHeaders(): Promise<Record<string, string>> {
  const token = await getIngestToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Ingest ${token}`,
  };
}

async function fetchCasesList(): Promise<{
  ok: boolean;
  cases?: IssuePackage[];
  error?: string;
}> {
  try {
    const headers = await apiHeaders();
    const resp = await fetch('https://www.aisherlock.vip/api/v1/cases?page=0&size=50', {
      headers,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `API ${resp.status}: ${text.slice(0, 200)}` };
    }
    const data = (await resp.json()) as {
      items?: Array<{ caseKey: string; status: string; title?: string; createdAt?: string }>;
    };
    const localCases = await loadCases();
    const remoteMap = new Map(
      (data.items ?? []).map((i) => [i.caseKey, i])
    );
    const localKeys = new Set(
      localCases.map((c) => c.caseKey).filter(Boolean) as string[]
    );
    const merged = localCases
      .filter((c) => !c.caseKey || remoteMap.has(c.caseKey))
      .map((c) => {
        const remote = c.caseKey ? remoteMap.get(c.caseKey) : undefined;
        if (remote) {
          return {
            ...c,
            status: remote.status ?? c.status,
            title: remote.title || c.title,
          };
        }
        return c;
      });
    // 后端有、本地没有的 Case（清库/多端提交）：补骨架记录，点开时由详情接口补全
    for (const item of data.items ?? []) {
      if (!item.caseKey || localKeys.has(item.caseKey)) continue;
      const ts = item.createdAt ?? new Date().toISOString();
      merged.push({
        issueId: uid('iss-remote-'),
        sessionId: '',
        caseKey: item.caseKey,
        title: item.title ?? item.caseKey,
        description: '',
        status: item.status,
        screenshots: [],
        pageContext: {
          url: '',
          title: '',
          route: '',
          referrer: '',
          userAgent: '',
          viewport: { width: 0, height: 0 },
          language: '',
          submittedAt: ts,
        },
        network: [],
        consoleErrors: [],
        stacks: [],
        sourceHints: {},
        meta: { pluginVersion: '0.1.0-mvp', assembledAt: ts },
      });
    }
    for (const c of merged) {
      await saveCase(c);
    }
    return { ok: true, cases: merged };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function fetchCaseDetail(
  caseKey: string
): Promise<{ ok: boolean; case?: IssuePackage; error?: string }> {
  try {
    const headers = await apiHeaders();
    const resp = await fetch(`https://www.aisherlock.vip/api/v1/cases/${encodeURIComponent(caseKey)}`, {
      headers,
    });
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `API ${resp.status}: ${text.slice(0, 200)}` };
    }
    const detail = (await resp.json()) as {
      caseKey: string;
      title?: string;
      description?: string;
      status?: string;
      latestDiagnosis?: {
        status?: string;
        summary?: string;
      } | null;
      findings?: Array<Record<string, unknown> & { id: string }>;
    };
    const localCases = await loadCases();
    const local = localCases.find((c) => c.caseKey === caseKey);
    if (!local) {
      return { ok: false, error: `Case ${caseKey} not found locally` };
    }
    if (detail.status) local.status = detail.status;
    if (!local.description && detail.description) {
      local.description = detail.description;
    }
    if (detail.latestDiagnosis?.summary || detail.findings) {
      local.diagnosis = {
        complete: detail.latestDiagnosis?.status === 'COMPLETED',
        findings: detail.findings ?? [],
        caseSummary: detail.latestDiagnosis?.summary ?? '',
      };
    }
    await saveCase(local);
    return { ok: true, case: local };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// 待验证红点：每轮只拉一次列表，统计待验证数量 → 图标角标 + storage（sidepanel 监听）
async function updateVerifyBadge(): Promise<void> {
  try {
    const headers = await apiHeaders();
    const resp = await fetch('https://www.aisherlock.vip/api/v1/cases?page=0&size=50', {
      headers,
    });
    if (!resp.ok) return; // 失败保留上次角标
    const data = (await resp.json()) as { items?: Array<{ status?: string }> };
    const count = (data.items ?? []).filter((i) => isPendingVerifyStatus(i.status)).length;
    await chrome.action.setBadgeBackgroundColor({ color: '#ff4d4f' });
    await chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    await chrome.storage.local.set({ pendingVerifyCount: count });
  } catch {
    // 网络异常时保留上次角标
  }
}

function buildPackage(
  form: UserFormInput,
  screenshots: ScreenshotItem[],
  dump?: EvidenceDump,
  evidenceError?: string
): IssuePackage {  const now = new Date().toISOString();
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
    scope: { sourceApplication: 'ai-sherlock-web', environment: 'poc' },
    meta: { pluginVersion: '0.1.0-mvp', assembledAt: now },
  };
}
