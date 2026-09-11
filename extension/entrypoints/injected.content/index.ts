// MAIN world 注入脚本：页面运行时证据采集核心
// 职责：hook fetch/XHR（Network）、console.error/warn（日志）、
//       window.onerror / unhandledrejection（错误堆栈）、rrweb 录制
// 注意：顶层不能 import 依赖浏览器环境的库（rrweb 在录制时动态加载），
//       因为 WXT 构建时会在 Node 环境导入本文件提取入口配置
type EventWithTime = import('@rrweb/types').eventWithTime;
import {
  CONTENT_SOURCE,
  PAGE_SOURCE,
  uid,
  type ContentToPageMsg,
} from '../../core/messages';
import type {
  ConsoleEntry,
  ConsoleLevel,
  ErrorEntry,
  EvidenceDump,
  EvidenceEvent,
  NetworkEntry,
  PageContext,
} from '../../core/types';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  world: 'MAIN',
  runAt: 'document_start',
  main: () => {
    installHooks();
    listenCommands();
  },
});

// ---------- 缓冲区（滚动上限，防止数据爆炸，对齐 PRD 控量要求） ----------
const MAX_NETWORK = 300;
const MAX_CONSOLE = 300;
const MAX_ERRORS = 100;
const MAX_RRWEB_EVENTS = 40000;
const BODY_SUMMARY_LIMIT = 2000;

const networkBuffer: NetworkEntry[] = [];
const consoleBuffer: ConsoleEntry[] = [];
const errorBuffer: ErrorEntry[] = [];

function pushCapped<T>(arr: T[], item: T, max: number) {
  arr.push(item);
  if (arr.length > max) arr.splice(0, arr.length - max);
}

function emitEvent(event: EvidenceEvent) {
  try {
    window.postMessage(
      { source: PAGE_SOURCE, type: 'evidence-event', event },
      '*'
    );
  } catch {
    // 静默：实时推送失败不影响本地缓冲
  }
}

// ---------- Console hook ----------
const CONSOLE_LEVELS: ConsoleLevel[] = ['error', 'warn', 'log'];
const hookedConsole = new Map<ConsoleLevel, (...args: unknown[]) => void>();

function serializeArg(a: unknown): string {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.stack || a.message;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function hookConsole() {
  for (const level of CONSOLE_LEVELS) {
    const original = console[level].bind(console);
    hookedConsole.set(level, original);
    console[level] = (...args: unknown[]) => {
      try {
        const entry: ConsoleEntry = {
          id: uid('c-'),
          level,
          ts: Date.now(),
          message: args
            .map(serializeArg)
            .join(' ')
            .slice(0, BODY_SUMMARY_LIMIT),
        };
        pushCapped(consoleBuffer, entry, MAX_CONSOLE);
        emitEvent({ kind: 'console', entry });
      } catch {
        // ignore
      }
      original(...args);
    };
  }
}

const rawConsole = {
  error: (...a: unknown[]) => hookedConsole.get('error')?.(...a),
  log: (...a: unknown[]) => hookedConsole.get('log')?.(...a),
};

// ---------- 未捕获异常 / Promise rejection ----------
function hookErrors() {
  window.addEventListener('error', (e) => {
    const entry: ErrorEntry = {
      id: uid('e-'),
      kind: 'uncaught-error',
      ts: Date.now(),
      message: e.message || String(e.error ?? 'unknown error'),
      stack: e.error?.stack,
      source: e.filename,
      line: e.lineno,
      column: e.colno,
    };
    pushCapped(errorBuffer, entry, MAX_ERRORS);
    emitEvent({ kind: 'error', entry });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const reason: any = e.reason;
    const entry: ErrorEntry = {
      id: uid('e-'),
      kind: 'unhandledrejection',
      ts: Date.now(),
      message: reason?.message || String(reason),
      stack: reason?.stack,
    };
    pushCapped(errorBuffer, entry, MAX_ERRORS);
    emitEvent({ kind: 'error', entry });
  });
}

// ---------- Network hook ----------
const TRACE_KEYS = [
  'transactionid',
  'x-transaction-id',
  'traceid',
  'x-trace-id',
  'sessionid',
  'x-session-id',
];

function extractTraceIds(
  url: string,
  headerPairs: Array<[string, string]>
): Record<string, string> | undefined {
  const ids: Record<string, string> = {};
  try {
    const u = new URL(url, location.href);
    u.searchParams.forEach((v, k) => {
      if (TRACE_KEYS.includes(k.toLowerCase())) ids[k] = v;
    });
  } catch {
    // ignore
  }
  for (const [k, v] of headerPairs) {
    if (TRACE_KEYS.includes(k.toLowerCase())) ids[k] = v;
  }
  return Object.keys(ids).length ? ids : undefined;
}

function summarizeBody(body: unknown): string | undefined {
  if (body == null) return undefined;
  try {
    if (typeof body === 'string') return body.slice(0, BODY_SUMMARY_LIMIT);
    if (body instanceof URLSearchParams)
      return body.toString().slice(0, BODY_SUMMARY_LIMIT);
    if (body instanceof FormData) return '[FormData]';
    if (body instanceof Blob) return `[Blob ${body.type || 'unknown'}]`;
    if (body instanceof ArrayBuffer) return `[ArrayBuffer ${body.byteLength}B]`;
    return JSON.stringify(body).slice(0, BODY_SUMMARY_LIMIT);
  } catch {
    return undefined;
  }
}

function finishNetwork(entry: NetworkEntry) {
  pushCapped(networkBuffer, entry, MAX_NETWORK);
  emitEvent({ kind: 'network', entry });
}

function shouldSkipUrl(url: string): boolean {
  return url.startsWith('chrome-extension://');
}

async function captureResponseSummary(
  res: Response,
  entry: NetworkEntry
): Promise<void> {
  // 控量：仅失败请求深采集响应体
  if (res.ok) return;
  try {
    const text = await res.clone().text();
    entry.responseSummary = text.slice(0, BODY_SUMMARY_LIMIT);
  } catch {
    // 部分响应不可读（如 opaque）
  }
}

function hookFetch() {
  const originalFetch = window.fetch;
  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const req = input instanceof Request ? input : undefined;
    const url =
      typeof input === 'string'
        ? new URL(input, location.href).href
        : input instanceof URL
          ? input.href
          : input.url;
    const method = (
      init?.method ||
      req?.method ||
      'GET'
    ).toUpperCase();

    if (shouldSkipUrl(url)) return originalFetch.call(this, input, init);

    const headerPairs: Array<[string, string]> = [];
    try {
      const h = init?.headers
        ? new Headers(init.headers)
        : req?.headers
          ? new Headers(req.headers)
          : undefined;
      h?.forEach((v, k) => headerPairs.push([k, v]));
    } catch {
      // ignore
    }

    const entry: NetworkEntry = {
      id: uid('n-'),
      kind: 'fetch',
      method,
      url,
      startedAt: Date.now(),
      requestSummary: summarizeBody(init?.body ?? req),
      traceIds: extractTraceIds(url, headerPairs),
    };

    try {
      const res = await originalFetch.call(this, input, init);
      entry.status = res.status;
      entry.statusText = res.statusText;
      entry.ok = res.ok;
      entry.duration = Date.now() - entry.startedAt;
      void captureResponseSummary(res, entry).finally(() =>
        finishNetwork(entry)
      );
      return res;
    } catch (err) {
      entry.ok = false;
      entry.error = (err as Error)?.message || String(err);
      entry.duration = Date.now() - entry.startedAt;
      finishNetwork(entry);
      throw err;
    }
  };
}

function hookXhr() {
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  proto.open = function (
    this: XMLHttpRequest & { __sherlock?: Partial<NetworkEntry> },
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    const resolvedUrl = typeof url === 'string' ? new URL(url, location.href).href : url.href;
    this.__sherlock = { method: method.toUpperCase(), url: resolvedUrl };
    return (originalOpen as any).call(this, method, url, ...rest);
  };

  proto.send = function (
    this: XMLHttpRequest & { __sherlock?: Partial<NetworkEntry> },
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const meta = this.__sherlock;
    if (!meta?.url || shouldSkipUrl(meta.url)) {
      return originalSend.call(this, body);
    }
    const entry: NetworkEntry = {
      id: uid('n-'),
      kind: 'xhr',
      method: meta.method || 'GET',
      url: meta.url,
      startedAt: Date.now(),
      requestSummary: summarizeBody(body),
      traceIds: extractTraceIds(meta.url, []),
    };

    this.addEventListener('loadend', () => {
      entry.status = this.status;
      entry.statusText = this.statusText;
      entry.ok = this.status >= 200 && this.status < 400;
      entry.duration = Date.now() - entry.startedAt;
      if (!entry.ok) {
        try {
          entry.responseSummary = this.responseText?.slice(
            0,
            BODY_SUMMARY_LIMIT
          );
        } catch {
          // ignore
        }
      }
      finishNetwork(entry);
    });

    return originalSend.call(this, body);
  };
}

// ---------- rrweb 录制（动态加载，避免构建期在 Node 导入浏览器依赖） ----------
let stopRecording: (() => void) | null = null;
let rrwebEvents: EventWithTime[] = [];
let recordingStartedAt = 0;

async function startRecording(): Promise<{ ok: boolean; error?: string }> {
  if (stopRecording) return { ok: true };
  try {
    const { record } = await import('rrweb');
    rrwebEvents = [];
    recordingStartedAt = Date.now();
    stopRecording = record({
      emit(event) {
        rrwebEvents.push(event);
        if (rrwebEvents.length > MAX_RRWEB_EVENTS) {
          stopRecordingFn();
        }
      },
      inlineStylesheet: false,
      recordCanvas: false,
      slimDOMOptions: {
        script: true,
        comment: true,
      },
      sampling: {
        mousemove: 120,
        mouseInteraction: true,
        scroll: 250,
        input: 'last',
      },
    }) as unknown as () => void;
    return { ok: true };
  } catch (e) {
    stopRecording = null;
    return { ok: false, error: String(e) };
  }
}

function stopRecordingFn(): { ok: boolean; seconds: number } {
  if (stopRecording) {
    try {
      stopRecording();
    } catch {
      // ignore
    }
    stopRecording = null;
  }
  const seconds = recordingStartedAt
    ? Math.round((Date.now() - recordingStartedAt) / 1000)
    : 0;
  return { ok: true, seconds };
}

// ---------- 证据 dump ----------
function buildPageContext(): PageContext {
  return {
    url: location.href,
    title: document.title,
    route: location.pathname + location.hash,
    referrer: document.referrer,
    userAgent: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight },
    language: navigator.language,
    submittedAt: new Date().toISOString(),
  };
}

function buildDump(): EvidenceDump {
  return {
    pageContext: buildPageContext(),
    network: [...networkBuffer],
    consoleEntries: [...consoleBuffer],
    errors: [...errorBuffer],
    rrwebEvents: [...rrwebEvents],
    recordingActive: !!stopRecording,
    recordingSeconds: recordingStartedAt
      ? Math.round((Date.now() - recordingStartedAt) / 1000)
      : 0,
  };
}

// ---------- 命令通道（content script -> MAIN world） ----------
function listenCommands() {
  window.addEventListener('message', (e) => {
    const data = e.data as ContentToPageMsg | undefined;
    if (!data || data.source !== CONTENT_SOURCE) return;

    const respond = (ok: boolean, payload?: unknown, error?: string) => {
      window.postMessage(
        {
          source: PAGE_SOURCE,
          type: 'cmd-response',
          reqId: data.reqId,
          ok,
          payload,
          error,
        },
        '*'
      );
    };

    switch (data.type) {
      case 'start-recording': {
        startRecording().then((r) => respond(r.ok, undefined, r.error));
        break;
      }
      case 'stop-recording': {
        const r = stopRecordingFn();
        respond(r.ok, { seconds: r.seconds, eventCount: rrwebEvents.length });
        break;
      }
      case 'dump-evidence': {
        try {
          respond(true, buildDump());
        } catch (err) {
          respond(false, undefined, String(err));
        }
        break;
      }
    }
  });
}

// ---------- 安装 ----------
function installHooks() {
  hookConsole();
  hookErrors();
  hookFetch();
  hookXhr();
  rawConsole.log(
    '[AI Sherlock] injected: Network / Console / error capture is on'
  );
}
