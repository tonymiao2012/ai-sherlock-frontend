// Side Panel：编辑器式提报面板
// 流程：截图 -> 页面内微信式批注（不弹新窗口）-> 成图内嵌；Record -> 确认内嵌；提交打印 payload
// 未提交内容（标题/描述/截图/录制）自动存 IndexedDB，面板重开后可恢复
import React, { useEffect, useRef, useState } from 'react';
import { App as AntApp, Button, Modal, Space, Spin, Tag } from 'antd';
import {
  CameraOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { BRAND_LOGO_URL } from '../../components/BrandLogo';
import { sendRuntime, uid, type CaptureResult } from '../../core/messages';
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

type Stage =
  | { kind: 'compose' }
  | { kind: 'record-start' }
  | { kind: 'record-confirm'; info: RecordInfo };

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
  const [stage, setStage] = useState<Stage>({ kind: 'compose' });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<AnnotatedShot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [startingRec, setStartingRec] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordInfo, setRecordInfo] = useState<RecordInfo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [activeTab, setActiveTab] = useState('submit');
  const [cases, setCases] = useState<IssuePackage[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [successInfo, setSuccessInfo] = useState<{ caseKey?: string } | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // 快捷键：⌥/Alt+C 截图、⌥/Alt+V 录制、Esc 退出全屏确认页（面板聚焦时生效；用 e.code 兼容 macOS Alt 特殊字符）
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e) => {
    if (e.key === 'Escape') {
      if (capturing) {
        // 焦点在面板时页面收不到 Esc，转发给 content script 取消截图/批注覆盖层
        sendToTab('cancel-capture').catch(() => {});
        return;
      }
      if (stage.kind === 'record-start' || stage.kind === 'record-confirm') {
        setStage({ kind: 'compose' });
      }
      return;
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.code === 'KeyC' && stage.kind === 'compose' && !capturing) {
      e.preventDefault();
      capture();
    } else if (e.code === 'KeyV' && stage.kind === 'compose') {
      e.preventDefault();
      if (recording) stopRecording();
      else setStage({ kind: 'record-start' });
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
    const draft: SidebarDraft = {
      title,
      description: text,
      shots,
      record: recordInfo ?? undefined,
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

  const sendToTab = async (
    type:
      | 'start-recording'
      | 'stop-recording'
      | 'start-region-select'
      | 'reannotate-image'
      | 'cancel-capture'
      | 'preview-recording',
    extra?: Record<string, unknown>
  ) => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id) return { ok: false, error: 'No active tab' };
    try {
      return (await chrome.tabs.sendMessage(tab.id, { type, ...extra })) as
        | CaptureResult
        | Record<string, unknown>
        | undefined;
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  };

  // 截图：抓底图 -> 页面框选 -> 页面内批注 -> 成图直接内嵌
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
        message.error(
          'Capture failed: the page did not respond (not supported on chrome:// pages)'
        );
        return;
      }
      if (!result.ok) {
        if (!result.canceled) message.error(`Capture failed: ${result.error}`);
        return;
      }
      setShots((prev) => [
        ...prev,
        { id: uid('shot-'), dataUrl: result.dataUrl, annotated: result.annotated },
      ]);
      message.success('Screenshot inserted');
    } catch (e) {
      console.error('[AI Sherlock] capture error:', e);
      message.error(`Capture error: ${(e as Error).message}`);
    } finally {
      setCapturing(false);
    }
  };

  // 重新批注已有截图：同样在页面上原地完成
  const reannotate = async (shot: AnnotatedShot) => {
    setEditingId(shot.id);
    try {
      const result = (await sendToTab('reannotate-image', {
        dataUrl: shot.dataUrl,
      })) as CaptureResult | undefined;
      if (!result) {
        message.error('Cannot annotate: the page did not respond');
        return;
      }
      if (!result.ok) {
        if (!result.canceled) message.error(`Cannot annotate: ${result.error}`);
        return;
      }
      setShots((prev) =>
        prev.map((x) =>
          x.id === shot.id
            ? { ...x, dataUrl: result.dataUrl, annotated: true }
            : x
        )
      );
      message.success('Annotation saved');
    } finally {
      setEditingId(null);
    }
  };

  // 开始录制：content script 在当前页面上完成麦克风授权（允许=带声音），有结果才启动 rrweb
  const startRecordingFlow = async () => {
    if (startingRec) return;
    setStartingRec(true);
    try {
      const resp = (await sendToTab('start-recording')) as any;
      if (resp?.ok) {
        setRecording(true);
        setRecordSeconds(0);
        setStage({ kind: 'compose' });
        message.success(
          resp.withAudio
            ? 'Recording with audio — go reproduce the issue'
            : 'Recording without audio — go reproduce the issue'
        );
      } else {
        message.error(`Failed to start recording: ${resp?.error ?? ''}`);
      }
    } finally {
      setStartingRec(false);
    }
  };

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

  // 停止录制 -> 停止后进入确认视图（音频由 content script 一并回传）
  const stopRecording = async () => {
    const resp = (await sendToTab('stop-recording')) as any;
    setRecording(false);
    if (resp?.ok && resp.dump) {
      const thumbnail = await captureThumbnail();
      setStage({
        kind: 'record-confirm',
        info: {
          seconds: resp.dump.recordingSeconds ?? recordSeconds,
          eventCount: resp.dump.rrwebEvents?.length ?? 0,
          audio: resp.dump.audio ?? undefined,
          thumbnail: thumbnail ?? undefined,
        },
      });
    } else {
      message.warning(`Recording stopped: ${resp?.error ?? ''}`);
    }
  };

  // 在当前页面遮罩预览录制回放（音频一并传入，随回放同步播放）
  const previewRecording = async () => {
    const resp = (await sendToTab('preview-recording', { audio: recordInfo?.audio })) as any;
    if (resp?.ok === false) {
      message.warning(resp.error || 'Preview failed');
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
          {activeTab === 'submit' && stage.kind === 'compose' && (
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
                    danger={recording}
                    type={recording ? 'primary' : 'default'}
                    onClick={() =>
                      recording ? stopRecording() : setStage({ kind: 'record-start' })
                    }
                  >
                    {recording ? (
                      `Stop ${recordSeconds}s`
                    ) : (
                      <>
                        Video
                        <span style={SHORTCUT_HINT_STYLE}>{RECORD_HINT}</span>
                      </>
                    )}
                  </Button>
                </Space>
                {recording && <span style={{ marginLeft: 12, color: '#ff4d4f', fontSize: 12 }}>● REC</span>}
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
                {/* 录制缩略图：内嵌在编辑区内，居中播放按钮提示可回放 */}
                {recordInfo?.thumbnail && (
                  <div style={{ position: 'relative', marginBottom: 12, flexShrink: 0 }}>
                    <img
                      src={recordInfo.thumbnail}
                      onClick={previewRecording}
                      style={{
                        width: '100%',
                        borderRadius: 6,
                        display: 'block',
                        cursor: 'pointer',
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setRecordInfo(null)}
                      style={{ position: 'absolute', top: 4, right: 4 }}
                    />
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
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setRecordInfo(null)}
                    />
                  </div>
                )}
                <textarea
                  ref={textRef}
                  style={{
                    width: '100%',
                    flex: 1,
                    border: 'none',
                    padding: 0,
                    fontSize: 14,
                    outline: 'none',
                    background: 'transparent',
                    resize: 'none',
                    minHeight: 0,
                    fontFamily: 'inherit',
                  }}
                  placeholder="What happened, what it breaks, what you expected…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              </div>

              {/* 截图（可滚动） */}
              {shots.length > 0 && (
                <div style={{ flexShrink: 0, maxHeight: '30%', overflow: 'auto', padding: '8px 16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {shots.map((s, idx) => (
                      <div key={s.id} style={{
                        border: '1px solid #e8e8e8',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: '#fff',
                      }}>
                        <img src={s.dataUrl} alt={`Shot ${idx + 1}`} style={{ width: '100%', display: 'block' }} />
                        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                          <span>
                            Shot {idx + 1}
                            {s.annotated && <span style={{ marginLeft: 8, color: 'var(--sh-accent)' }}>✓ Annotated</span>}
                          </span>
                          <Space size={4}>
                            <Button
                              size="small"
                              type="text"
                              icon={<EditOutlined />}
                              loading={editingId === s.id}
                              onClick={() => reannotate(s)}
                            >
                              Annotate
                            </Button>
                            <Button
                              size="small"
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => setShots((prev) => prev.filter((x) => x.id !== s.id))}
                            />
                          </Space>
                        </div>
                        {s.note && <div style={{ padding: '0 12px 8px', fontSize: 12, color: '#666' }}>{s.note}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'submit' && stage.kind === 'record-start' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <div style={{
                textAlign: 'center',
                padding: '32px 16px',
                background: '#fff',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Start recording?</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 24, lineHeight: 1.8 }}>
                  Your page actions and microphone audio will be recorded.
                  <br />
                  First time on this site? Chrome will ask for mic permission on the page.
                </div>
                <Space size={12}>
                  <Button icon={<CloseOutlined />} disabled={startingRec} onClick={() => setStage({ kind: 'compose' })}>
                    Cancel
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: 'var(--sh-accent)', borderColor: 'var(--sh-accent)' }}
                    loading={startingRec}
                    onClick={startRecordingFlow}
                  >
                    Start
                  </Button>
                </Space>
              </div>
            </div>
          )}

          {activeTab === 'submit' && stage.kind === 'record-confirm' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              <div style={{
                textAlign: 'center',
                padding: '32px 16px',
                background: '#fff',
                borderRadius: 12,
              }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}></div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Recording finished. Insert into issue?</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
                  {stage.info.seconds}s · {stage.info.eventCount} events
                  {stage.info.audio && ' · Audio'}
                </div>
                <Space size={12}>
                  <Button icon={<CloseOutlined />} onClick={() => setStage({ kind: 'compose' })}>
                    Discard
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    style={{ background: 'var(--sh-accent)', borderColor: 'var(--sh-accent)' }}
                    onClick={() => {
                      setRecordInfo(stage.info);
                      setStage({ kind: 'compose' });
                      message.success('Recording inserted');
                    }}
                  >
                    Insert
                  </Button>
                </Space>
              </div>
            </div>
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
