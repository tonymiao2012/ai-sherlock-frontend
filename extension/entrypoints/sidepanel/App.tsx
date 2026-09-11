// Side Panel：编辑器式提报面板
// 流程：截图 -> 页面内微信式批注（不弹新窗口）-> 成图内嵌；Record -> 确认内嵌；提交打印 payload
// 未提交内容（标题/描述/截图/录制）自动存 IndexedDB，面板重开后可恢复
import React, { useEffect, useRef, useState } from 'react';
import { App as AntApp, Button, Modal, Space, Spin, Tag } from 'antd';
import {
  CameraOutlined,
  CheckCircleFilled,
  CopyOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import type { eventWithTime } from '@rrweb/types';
import { BRAND_LOGO_URL } from '../../components/BrandLogo';
import { sendRuntime, uid, type CaptureResult, type RuntimeMessage } from '../../core/messages';
import { clearDraft, loadCases, loadDraft, saveDraft } from '../../core/db';
import {
  isPendingVerifyStatus,
  type AnnotatedShot,
  type AudioTrack,
  type IssuePackage,
  type SidebarDraft,
} from '../../core/types';

interface RecordInfo {
  seconds: number;
  eventCount: number;
  audio?: AudioTrack;
  /** 停止录制时的页面缩略图（本地预览用，不进提交 payload） */
  thumbnail?: string;
}

const IS_MAC = /Mac/i.test(navigator.platform || navigator.userAgent);
const CAPTURE_HINT = IS_MAC ? '⌥C' : 'Alt+C';
const RECORD_HINT = IS_MAC ? '⌥V' : 'Alt+V';
const SHORTCUT_HINT_STYLE: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 11,
  fontWeight: 400,
  color: 'var(--sh-muted)',
};

function isResolvedStatus(status?: string): boolean {
  const s = status?.toUpperCase() ?? '';
  return ['DIAGNOSED', 'VERIFIED', 'VERIFY_SUCCESS', 'COMPLETED'].includes(s);
}

function statusColor(status?: string): string {
  const s = status?.toUpperCase() ?? '';
  if (isPendingVerifyStatus(s)) return 'red';
  if (isResolvedStatus(s)) return 'green';
  if (s === 'FAILED') return 'red';
  if (s === 'DIAGNOSING') return 'orange';
  return 'blue';
}

const GREEN_TAG_STYLE: React.CSSProperties = {
  background: 'var(--sh-accent-soft)',
  color: 'var(--sh-accent-dark)',
  borderColor: 'var(--sh-accent-line)',
};

function statusTagProps(status?: string): { color?: string; style?: React.CSSProperties } {
  const color = statusColor(status);
  return color === 'green' ? { style: GREEN_TAG_STYLE } : { color };
}

function CaseListPanel({ list, loading, emptyText }: { list: IssuePackage[]; loading: boolean; emptyText: string }) {
  const { message } = AntApp.useApp();
  if (loading) {
    return <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>Loading...</div>;
  }
  if (list.length === 0) {
    return <div style={{ textAlign: 'center', padding: 32, color: '#999', fontSize: 16 }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((c) => {
        const pending = isPendingVerifyStatus(c.status);
        return (
          <div
            key={c.issueId}
            onClick={async () => {
              if (c.caseKey) {
                await sendRuntime({ type: 'fetch-case-detail', caseKey: c.caseKey });
              }
              const reportUrl = chrome.runtime.getURL(`/report.html?caseId=${c.issueId}`);
              const [existing] = await chrome.tabs.query({ url: reportUrl });
              if (existing?.id) {
                await chrome.tabs.update(existing.id, { active: true });
                if (existing.windowId) {
                  await chrome.windows.update(existing.windowId, { focused: true });
                }
                await chrome.tabs.reload(existing.id);
              } else {
                chrome.tabs.create({ url: reportUrl });
              }
            }}
            style={{
              padding: 16,
              border: `1px solid ${pending ? '#ff4d4f' : '#e8e8e8'}`,
              borderRadius: 12,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: pending ? '#fff1f0' : '#fff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--sh-brand)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(103,184,32,0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = pending ? '#ff4d4f' : '#e8e8e8';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 15 }}>{c.title || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', display: 'flex', alignItems: 'center', gap: 4 }}>
                {c.caseKey ?? c.issueId}
                {(c.caseKey || c.issueId) && (
                  <CopyOutlined
                    style={{ cursor: 'pointer', color: '#999' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(c.caseKey ?? c.issueId).then(() => {
                        message.success('Copied');
                      });
                    }}
                  />
                )}
              </span>
              <span>{new Date(c.meta.assembledAt).toLocaleString()}</span>
              <Tag {...statusTagProps(c.status)}>{c.status ?? 'RECEIVED'}</Tag>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const { message } = AntApp.useApp();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<AnnotatedShot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordInfo, setRecordInfo] = useState<RecordInfo | null>(null);
  const [recordEvents, setRecordEvents] = useState<eventWithTime[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [activeTab, setActiveTab] = useState('submit');
  const [cases, setCases] = useState<IssuePackage[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [successInfo, setSuccessInfo] = useState<{ caseKey?: string } | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lastSelectionRef = useRef<Range | null>(null);

  // 快捷键：⌥/Alt+C 截图、⌥/Alt+V 录制（面板聚焦时生效；用 e.code 兼容 macOS Alt 特殊字符）
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.code === 'KeyC' && !capturing) {
      e.preventDefault();
      capture();
    } else if (e.code === 'KeyV' && !recording) {
      e.preventDefault();
      sendToTab('start-recording-overlay').catch(() => {});
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 录制计时
  useEffect(() => {
    if (recording) {
      recordTimerRef.current = window.setInterval(
        () => setRecordSeconds((s) => s + 1),
        1000
      );
    } else if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [recording]);

  // 草稿恢复：面板重开后接回上次未提交的内容。
  // 录制卡（事件流/音频仍在页面上）只在同一扩展会话内恢复：chrome.storage.session
  // 会在扩展重载/浏览器重启时清空，作为会话哨兵，避免恢复出一张点不动预览的死卡。
  useEffect(() => {
    Promise.all([loadDraft(), chrome.storage.session.get('recordAlive')])
      .then(([draft, session]) => {
        if (draft) {
          setTitle(draft.title);
          setText(draft.description);
          setShots(draft.shots ?? []);
          // 恢复 contenteditable 编辑器内容（含内联截图位置）
          if (draft.editorHtml && editorRef.current) {
            editorRef.current.innerHTML = draft.editorHtml;
          }
          const record = session.recordAlive ? (draft.record ?? null) : null;
          setRecordInfo(record);
          if (draft.record && !record) {
            void saveDraft({ ...draft, record: undefined });
          }
        }
        setDraftReady(true);
      })
      .catch(() => setDraftReady(true));
  }, []);

  // 草稿落盘：内容变化后防抖写入（截图是 base64，避免每次按键写整包）
  useEffect(() => {
    if (!draftReady) return;
    const editorHtml = editorRef.current?.innerHTML || '';
    const draft: SidebarDraft = {
      title,
      description: text,
      shots,
      record: recordInfo ?? undefined,
      editorHtml,
    };
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = window.setTimeout(() => {
      draftTimerRef.current = null;
      const isEmpty =
        !draft.title &&
        !draft.description &&
        draft.shots.length === 0 &&
        !draft.record;
      void (isEmpty ? clearDraft() : saveDraft(draft));
    }, 400);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [draftReady, title, text, shots, recordInfo]);

  // 录制卡会话哨兵：有录制卡才标记；扩展重载后 storage.session 被清，恢复时据此丢弃死卡
  useEffect(() => {
    if (recordInfo) {
      void chrome.storage.session.set({ recordAlive: true });
    } else if (draftReady) {
      void chrome.storage.session.remove('recordAlive');
    }
  }, [recordInfo, draftReady]);

  // 录制卡被替换或删除时，清掉旧事件
  useEffect(() => {
    setRecordEvents(null);
  }, [recordInfo?.audio?.startedAt, recordInfo?.seconds]);

  // 加载 Case 列表（点击 Cases tab 从后端同步最新状态；打开面板时拉一次）
  // 已有数据时静默刷新，旧列表原地保留，避免切 Tab 闪 Loading
  const refreshCases = () => {
    if (cases.length === 0) setCasesLoading(true);
    const apply = (list: IssuePackage[]) => {
      setCases(list);
      const count = list.filter((c) => isPendingVerifyStatus(c.status)).length;
      setPendingVerifyCount(count);
      chrome.storage.local.set({ pendingVerifyCount: count });
    };
    sendRuntime<{ ok: boolean; cases?: IssuePackage[]; error?: string }>({
      type: 'fetch-cases',
    })
      .then((resp) => {
        if (resp?.ok && resp.cases) {
          apply(resp.cases);
        } else {
          return loadCases().then(apply);
        }
      })
      .catch(() => loadCases().then(apply))
      .finally(() => setCasesLoading(false));
  };

  // 所有 tab 切换都走这里；Cases 每次点击都重新拉列表（含已选中态的重复点击）
  const openTab = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'cases') refreshCases();
  };

  // 打开面板拉一次列表；待验证数量由后台轮询写入 storage，这里监听变化实时更新红点
  useEffect(() => {
    refreshCases();
    chrome.storage.local
      .get('pendingVerifyCount')
      .then((r) => {
        if (typeof r.pendingVerifyCount === 'number') {
          setPendingVerifyCount(r.pendingVerifyCount);
        }
      })
      .catch(() => {});
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && typeof changes.pendingVerifyCount?.newValue === 'number') {
        setPendingVerifyCount(changes.pendingVerifyCount.newValue);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 截图覆盖层激活时，sidepanel 焦点下按 Esc 转发给页面
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sendToTab('cancel-capture').catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capturing]);

  const sendToTab = async (
    type: 'start-recording-overlay' | 'dump-evidence' | 'start-region-select' | 'cancel-capture' | 'reannotate-image',
    extra?: Record<string, unknown>
  ) => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) return { ok: false, error: 'No active tab' };
    try {
      return (await chrome.tabs.sendMessage(tab.id, { type, ...extra })) as
        | Record<string, unknown>
        | undefined;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  // 保存/恢复 contenteditable 光标位置，用于在光标处插入图片
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
      lastSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    const range = lastSelectionRef.current;
    if (!range) return false;
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  };

  // 在 contenteditable 光标位置（或末尾）插入一张内联截图（独占一行，点击可重新批注）
  const insertShotInline = (shot: AnnotatedShot) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();

    const wrapper = document.createElement('div');
    wrapper.contentEditable = 'false';
    wrapper.dataset.shotId = shot.id;
    wrapper.style.cssText = 'position:relative;max-width:100%;margin:6px 0;cursor:pointer;';

    const img = document.createElement('img');
    img.src = shot.dataUrl;
    img.dataset.dataUrl = shot.dataUrl;
    img.alt = 'Screenshot';
    img.style.cssText = 'max-width:100%;border-radius:6px;display:block;border:1px solid #e8e8e8;';

    const del = document.createElement('button');
    del.type = 'button';
    del.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    del.style.cssText = 'position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:6px;border:none;background:#ff4d4f;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;z-index:10;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
    del.addEventListener('mouseenter', () => { del.style.background = '#ff7875'; });
    del.addEventListener('mouseleave', () => { del.style.background = '#ff4d4f'; });
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      wrapper.remove();
      setShots((prev) => prev.filter((x) => x.id !== shot.id));
      syncTextFromEditor();
    });

    img.addEventListener('click', async (e) => {
      e.stopPropagation();
      const currentDataUrl = img.dataset.dataUrl || shot.dataUrl;
      const result = (await sendToTab('reannotate-image', {
        dataUrl: currentDataUrl,
      })) as CaptureResult | undefined;
      if (!result?.ok || !result.dataUrl) return;
      img.src = result.dataUrl;
      img.dataset.dataUrl = result.dataUrl;
      setShots((prev) =>
        prev.map((s) => (s.id === shot.id ? { ...s, dataUrl: result.dataUrl, annotated: true } : s))
      );
      syncTextFromEditor();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(del);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(wrapper);
      const br = document.createElement('br');
      wrapper.after(br);
      const newRange = document.createRange();
      newRange.setStartAfter(br);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
    } else {
      editor.appendChild(wrapper);
      editor.appendChild(document.createElement('br'));
    }
    syncTextFromEditor();
  };

  // 从 contenteditable 同步纯文本到 text state（用于草稿 & 提交）
  const syncTextFromEditor = () => {
    const editor = editorRef.current;
    if (!editor) return;
    setText(editor.innerText || '');
  };

  // 截图：截取全页 → 页面框选 → 批注 → 内联插入到编辑区
  const capture = async () => {
    setCapturing(true);
    try {
      const resp = await sendRuntime<{
        ok: boolean;
        dataUrl?: string;
        error?: string;
      }>({ type: 'capture-screenshot' });
      if (!resp?.ok || !resp.dataUrl) {
        console.error('[AI Sherlock] capture failed:', resp);
        message.error(`Capture failed: ${resp?.error ?? 'unknown error'}`);
        return;
      }
      const result = (await sendToTab('start-region-select', {
        dataUrl: resp.dataUrl,
      })) as CaptureResult | undefined;
      if (!result) {
        message.error('Capture failed: the page did not respond');
        return;
      }
      if (!result.ok) {
        if (!result.canceled) message.error(`Capture failed: ${result.error}`);
        return;
      }
      const shot: AnnotatedShot = { id: uid('shot-'), dataUrl: result.dataUrl, annotated: result.annotated };
      setShots((prev) => [...prev, shot]);
      insertShotInline(shot);
    } catch (e) {
      console.error('[AI Sherlock] capture error:', e);
      message.error(`Capture error: ${(e as Error).message}`);
    } finally {
      setCapturing(false);
    }
  };

  // 开始录制：让 content script 在主页面展示确认 → 倒计时 → 浮动控制条
  const startRecordingOverlay = () => {
    if (recording) return;
    sendToTab('start-recording-overlay').catch(() => {
      message.error('Cannot start recording: the page did not respond');
    });
  };

  // 监听 content script 的录制状态通知（录制开始/取消/停止）
  useEffect(() => {
    const listener = (msg: RuntimeMessage) => {
      if (msg.type === 'recording-started') {
        setRecording(true);
        setRecordSeconds(0);
      } else if (msg.type === 'recording-canceled') {
        setRecording(false);
      } else if (msg.type === 'recording-stopped') {
        setRecording(false);
        const dump = msg.dump;
        captureThumbnail().then((thumbnail) => {
          setRecordInfo({
            seconds: dump.recordingSeconds ?? 0,
            eventCount: dump.rrwebEvents?.length ?? 0,
            audio: dump.audio ?? undefined,
            thumbnail,
          });
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 停止录制时的页面缩略图：保持宽高比压到最大宽 640（后续会嵌入文本框，仅本地预览）
  const captureThumbnail = async (): Promise<string | undefined> => {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({
        format: 'jpeg',
        quality: 70,
      });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = dataUrl;
      });
      const k = Math.min(1, 640 / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.7);
    } catch {
      return undefined;
    }
  };

  // 在主页面全屏回放 rrweb 录制
  const previewRecording = async () => {
    if (recordEvents) {
      sendToTab('open-replay', { events: recordEvents, audio: recordInfo?.audio });
      return;
    }
    setPreviewLoading(true);
    try {
      const resp = (await sendToTab('dump-evidence')) as
        | { ok: true; dump?: { rrwebEvents?: eventWithTime[] } }
        | { ok: false; error?: string }
        | undefined;
      if (!resp?.ok || !('dump' in resp)) {
        message.warning((resp as any)?.error || 'Preview failed');
        return;
      }
      const events = resp.dump?.rrwebEvents ?? [];
      if (events.length === 0) {
        message.warning('No recording events available');
        return;
      }
      setRecordEvents(events as eventWithTime[]);
      sendToTab('open-replay', { events: events as eventWithTime[], audio: recordInfo?.audio });
    } catch (e) {
      message.warning(`Preview error: ${(e as Error).message}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const submit = async () => {
    if (!title.trim()) {
      message.warning('Please enter an issue title');
      return;
    }
    if (!text.trim() && shots.length === 0 && !recordInfo) {
      message.warning('Add a description, a screenshot or a recording first');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await sendRuntime<{ ok: boolean; error?: string; caseKey?: string }>({
        type: 'submit-issue',
        form: { title: title.trim(), description: text.trim() },
        screenshots: shots.map((s) => ({
          dataUrl: s.dataUrl,
          annotated: s.annotated,
          note: s.note,
        })),
        audio: recordInfo?.audio,
      });
      if (resp?.ok) {
        if (draftTimerRef.current) {
          clearTimeout(draftTimerRef.current);
          draftTimerRef.current = null;
        }
        setTitle('');
        setText('');
        setShots([]);
        setRecordInfo(null);
        if (editorRef.current) editorRef.current.innerHTML = '';
        await clearDraft();
        setSuccessInfo({ caseKey: resp.caseKey });
      } else {
        message.error(`Submit failed: ${resp?.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="editor-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* 品牌头 + Tab：Logo 与 Tab 垂直居中；Tab 轨道贴右、底部与内容区相连 */}
      <header className="editor-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0px 16px 0px 0px' }}>
        <div className="sh-brand">
          <img className="sh-brand-logo" src={BRAND_LOGO_URL} alt="AI Sherlock" />
          <span className="sh-brand-name">AI Sherlock</span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 3,
            alignSelf: 'flex-end',
            padding: 3,
            marginRight: -16,
            border: '1px solid var(--sh-line)',
            borderBottom: 'none',
            borderRadius: '10px 10px 0 0',
            background: 'var(--sh-sunken)',
          }}
        >
          <button
            onClick={() => openTab('submit')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 22px',
              border: 'none',
              borderRadius: 8,
              background: activeTab === 'submit' ? '#fff' : 'transparent',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: activeTab === 'submit' ? 600 : 400,
              color: activeTab === 'submit' ? 'var(--sh-accent)' : 'var(--sh-muted)',
              boxShadow: activeTab === 'submit' ? '0 1px 3px rgba(23, 36, 12, 0.12)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Issue
          </button>
          <button
            onClick={() => openTab('cases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 22px',
              border: 'none',
              borderRadius: 8,
              background: activeTab === 'cases' ? '#fff' : 'transparent',
              cursor: 'pointer',
              fontSize: 16,
              fontWeight: activeTab === 'cases' ? 600 : 400,
              color: activeTab === 'cases' ? 'var(--sh-accent)' : 'var(--sh-muted)',
              boxShadow: activeTab === 'cases' ? '0 1px 3px rgba(23, 36, 12, 0.12)' : 'none',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            Cases
            {pendingVerifyCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -6,
                right: -8,
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 10,
                borderRadius: 10,
                padding: '1px 5px',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {pendingVerifyCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 内容区：Spin 改为绝对定位遮罩，避免包裹层打断 flex 布局 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', minHeight: 0 }}>
          {activeTab === 'submit' && (
            <>
              {/* 工具栏 */}
              <div style={{ padding: '12px 16px 8px', flexShrink: 0 }}>
                <Space size={8}>
                  <Button
                    icon={<CameraOutlined />}
                    loading={capturing}
                    onClick={capture}
                  >
                    Capture
                    <span style={SHORTCUT_HINT_STYLE}>{CAPTURE_HINT}</span>
                  </Button>
                  <Button
                    icon={<VideoCameraOutlined />}
                    onClick={startRecordingOverlay}
                    disabled={recording}
                  >
                    Video
                    <span style={SHORTCUT_HINT_STYLE}>{RECORD_HINT}</span>
                  </Button>
                </Space>
                {recording && <span style={{ marginLeft: 12, color: '#ff4d4f', fontSize: 12 }}>● REC {recordSeconds}s</span>}
              </div>

              {/* 编辑区：标题 + 录制缩略图 + 文本框占满剩余空间 */}
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                margin: '0 16px 12px',
                background: '#fff',
                borderRadius: 12,
                padding: 16,
                minHeight: 0,
              }}>
                <input
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1px solid #e8e8e8',
                    padding: '8px 0',
                    fontSize: 16,
                    fontWeight: 500,
                    outline: 'none',
                    background: 'transparent',
                    marginBottom: 12,
                    flexShrink: 0,
                  }}
                  placeholder="Issue title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                {/* 录制缩略图：内嵌在编辑区内，点击展开/收起侧边栏内嵌回放（第一帧） */}
                {recordInfo?.thumbnail && (
                  <div style={{ marginBottom: 12, flexShrink: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <img
                        src={recordInfo.thumbnail}
                        onClick={previewRecording}
                        style={{
                          width: '100%',
                          borderRadius: 6,
                          display: 'block',
                          cursor: 'pointer',
                          opacity: previewLoading ? 0.6 : 1,
                        }}
                      />
                      <div
                        onClick={previewRecording}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: 'rgba(0,0,0,0.15)',
                          borderRadius: 6,
                        }}
                      >
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: 'rgba(0,0,0,0.55)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          {previewLoading ? (
                            <Spin size="small" />
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setRecordInfo(null); }}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: 'none',
                          background: '#ff4d4f',
                          color: '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          zIndex: 10,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ff7875'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ff4d4f'; }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                )}
                {/* 无缩略图时的录制信息条 */}
                {recordInfo && !recordInfo.thumbnail && (
                  <div style={{
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: '#f6f6f6',
                    borderRadius: 6,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                  }}>
                    <span
                      onClick={previewRecording}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <VideoCameraOutlined style={{ marginRight: 8 }} />
                      Recording: {recordInfo.seconds}s · {recordInfo.eventCount} events
                      {recordInfo.audio && ' · Audio'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecordInfo(null)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: 'none',
                        background: '#ff4d4f',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        flexShrink: 0,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ff7875'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#ff4d4f'; }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                )}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncTextFromEditor}
                  onBlur={saveSelection}
                  style={{
                    width: '100%',
                    flex: 1,
                    border: 'none',
                    padding: 0,
                    fontSize: 14,
                    outline: 'none',
                    background: 'transparent',
                    minHeight: 0,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                    overflowY: 'auto',
                    wordBreak: 'break-word',
                  }}
                  data-placeholder="What happened, what it breaks, what you expected…"
                />
              </div>

            </>
          )}

          {activeTab === 'cases' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <CaseListPanel list={cases} loading={casesLoading} emptyText="No cases yet" />
            </div>
          )}

          {/* 底部 Submit 按钮（仅在 Submit tab 显示） */}
          {activeTab === 'submit' && (
            <div style={{
              padding: '12px 16px',
              borderTop: '1px solid #e8e8e8',
              background: '#fff',
              flexShrink: 0,
            }}>
              <Button
                block
                type="primary"
                size="large"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={submit}
                style={{ height: 44, fontSize: 15, background: '#B4E968', borderColor: '#B4E968', color: 'var(--sh-brand-ink)' }}
              >
                Submit
              </Button>
            </div>
          )}
          {/* 提交中遮罩 */}
          {submitting && (
            <div style={{
              position: 'absolute',
              inset: 0,
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.65)',
            }}>
              <Spin size="large" description="Submitting...">{null}</Spin>
            </div>
          )}
      </div>

      {/* 提交成功弹窗：图标与文字等高对齐，按钮居中 */}
      <Modal
        open={!!successInfo}
        centered
        width={380}
        onCancel={() => setSuccessInfo(null)}
        footer={
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              style={{ minWidth: 140, background: 'var(--sh-brand)', borderColor: 'var(--sh-brand)', color: 'var(--sh-brand-ink)' }}
              onClick={() => {
                setSuccessInfo(null);
                openTab('cases');
              }}
            >
              View Cases
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 4px' }}>
          <CheckCircleFilled style={{ color: '#52c41a', fontSize: 44, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>Submitted successfully</div>
            {successInfo?.caseKey && (
              <div style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>
                Case {successInfo.caseKey} created
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
