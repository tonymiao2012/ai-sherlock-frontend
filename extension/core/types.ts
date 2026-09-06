// 证据采集与问题包的数据结构定义（与 PRD 问题包结构对齐）

export interface NetworkEntry {
  id: string;
  kind: 'fetch' | 'xhr';
  method: string;
  url: string;
  startedAt: number;
  duration?: number;
  status?: number;
  statusText?: string;
  ok?: boolean;
  error?: string;
  /** 请求体摘要（截断） */
  requestSummary?: string;
  /** 响应体摘要（仅失败请求深采集，截断） */
  responseSummary?: string;
  /** 链路键值：transactionId / sessionId 等 */
  traceIds?: Record<string, string>;
}

export type ConsoleLevel = 'error' | 'warn' | 'log';

export interface ConsoleEntry {
  id: string;
  level: ConsoleLevel;
  ts: number;
  message: string;
}

export type ErrorKind = 'uncaught-error' | 'unhandledrejection';

export interface ErrorEntry {
  id: string;
  kind: ErrorKind;
  ts: number;
  message: string;
  stack?: string;
  source?: string;
  line?: number;
  column?: number;
}

export interface PageContext {
  url: string;
  title: string;
  route: string;
  referrer: string;
  userAgent: string;
  viewport: { width: number; height: number };
  language: string;
  submittedAt: string;
}

export type EvidenceEventKind = 'network' | 'console' | 'error';

export interface EvidenceEvent {
  kind: EvidenceEventKind;
  entry: NetworkEntry | ConsoleEntry | ErrorEntry;
}

/** Root Cause 分析结果（由后端诊断服务返回） */
export interface Finding {
  id: string;
  type?: string;
  title?: string;
  application?: string;
  repository?: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  rootCause?: string;
  recommendedFix?: string;
  aiConfidence?: number;
  severity?: string;
}

export interface Diagnosis {
  complete: boolean;
  findings: Finding[];
  caseSummary: string;
}

/** 截图内容块（批注后图像 + 对该图的描述） */
export interface ScreenshotItem {
  dataUrl: string;
  annotated: boolean;
  note?: string;
}

/** 侧边栏内嵌的截图（带本地 id，用于草稿与重新批注） */
export type AnnotatedShot = ScreenshotItem & { id: string };

/** 侧边栏草稿：面板重开后恢复未提交的内容 */
export interface SidebarDraft {
  title: string;
  description: string;
  shots: AnnotatedShot[];
  record?: { seconds: number; eventCount: number };
}

/** 用户表单输入 */
export interface UserFormInput {
  title: string;
  description: string;
  steps?: string;
  expectedResult?: string;
  severity?: 'high' | 'medium' | 'low';
}

/** MAIN world 注入脚本回传的全量证据 */
export interface EvidenceDump {
  pageContext: PageContext;
  network: NetworkEntry[];
  consoleEntries: ConsoleEntry[];
  errors: ErrorEntry[];
  rrwebEvents: unknown[];
  recordingActive: boolean;
  recordingSeconds: number;
}

/** 最终问题包（插件与后端的交接对象） */
export interface IssuePackage {
  issueId: string;
  sessionId: string;
  caseKey?: string;
  title: string;
  description: string;
  steps?: string;
  expectedResult?: string;
  severity?: string;
  status?: string;
  /** 截图（含批注后的 dataURL 与描述） */
  screenshots: ScreenshotItem[];
  pageContext: PageContext;
  network: NetworkEntry[];
  consoleErrors: ConsoleEntry[];
  stacks: ErrorEntry[];
  sourceHints: { buildVersion?: string; sourcemapRef?: string };
  /** 页面证据（Network/Console/堆栈）采集失败的原因，用于定位注入问题 */
  evidenceError?: string;
  /** rrweb 录制事件，可回放 */
  rrwebEvents?: unknown[];
  recordingSeconds?: number;
  /** 后端 Root Cause 诊断结果 */
  diagnosis?: Diagnosis;
  /** 应用与环境，帮助后端做 Endpoint → Application 映射 */
  scope?: {
    sourceApplication?: string;
    environment?: string;
  };
  meta: {
    pluginVersion: string;
    assembledAt: string;
  };
}
