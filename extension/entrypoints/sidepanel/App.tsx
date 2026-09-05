// Side Panel：编辑器式提报面板
// 流程：截图 -> 页面内微信式批注（不弹新窗口）-> 成图内嵌；Record -> 确认内嵌；提交打印 payload
// 未提交内容（标题/描述/截图/录制）自动存 IndexedDB，面板重开后可恢复
import React, { useEffect, useRef, useState } from 'react';
import { Button, Space, message } from 'antd';
import {
  CameraOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { BRAND_LOGO_URL } from '../../components/BrandLogo';
import { sendRuntime, uid, type CaptureResult } from '../../core/messages';
import { clearDraft, loadDraft, saveDraft } from '../../core/db';
import type { AnnotatedShot, SidebarDraft } from '../../core/types';

interface RecordInfo {
  seconds: number;
  eventCount: number;
}

type Stage = { kind: 'compose' } | { kind: 'record-confirm'; info: RecordInfo };

export default function App() {
  const [stage, setStage] = useState<Stage>({ kind: 'compose' });
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [shots, setShots] = useState<AnnotatedShot[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordInfo, setRecordInfo] = useState<RecordInfo | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const recordTimerRef = useRef<number | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

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

  // 草稿恢复：面板重开后接回上次未提交的内容
  useEffect(() => {
    loadDraft()
      .then((draft) => {
        if (draft) {
          setTitle(draft.title);
          setText(draft.description);
          setShots(draft.shots ?? []);
          setRecordInfo(draft.record ?? null);
          if (
            draft.title ||
            draft.description ||
            draft.shots?.length ||
            draft.record
          ) {
            message.info('Restored your unsent draft');
            requestAnimationFrame(() => {
              if (textRef.current) autoGrow(textRef.current);
            });
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

  const sendToTab = async (
    type:
      | 'start-recording'
      | 'stop-recording'
      | 'start-region-select'
      | 'reannotate-image',
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

  // 录制开始/停止 -> 停止后进入确认视图
  const toggleRecording = async () => {
    if (!recording) {
      const resp = await sendToTab('start-recording');
      if ((resp as any)?.ok) {
        setRecording(true);
        setRecordSeconds(0);
        message.success('Recording — go reproduce the issue');
      } else {
        message.error(`Failed to start recording: ${(resp as any)?.error ?? ''}`);
      }
    } else {
      const resp = (await sendToTab('stop-recording')) as any;
      setRecording(false);
      if (resp?.ok && resp.dump) {
        setStage({
          kind: 'record-confirm',
          info: {
            seconds: resp.dump.recordingSeconds ?? recordSeconds,
            eventCount: resp.dump.rrwebEvents?.length ?? 0,
          },
        });
      } else {
        message.warning(`Recording stopped: ${resp?.error ?? ''}`);
      }
    }
  };

  const autoGrow = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const submit = async () => {
    if (!text.trim() && shots.length === 0 && !recordInfo) {
      message.warning('Add a description, a screenshot or a recording first');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await sendRuntime<{ ok: boolean; error?: string }>({
        type: 'submit-issue',
        form: { title: title.trim(), description: text.trim() },
        screenshots: shots.map((s) => ({
          dataUrl: s.dataUrl,
          annotated: s.annotated,
          note: s.note,
        })),
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
        message.success('Submitted — payload printed in the console');
      } else {
        message.error(`Submit failed: ${resp?.error}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="editor-layout">
      {/* 品牌头：LOGO 与名称同一行垂直居中 */}
      <header className="editor-head">
        <div className="sh-brand">
          <img className="sh-brand-logo" src={BRAND_LOGO_URL} alt="AI Sherlock" />
          <span className="sh-brand-name">AI Sherlock</span>
        </div>
        <span className="sh-pill sh-pill--brand">Auto-capture on</span>
      </header>

      {/* 顶部工具栏 */}
      <div className="editor-toolbar">
        {stage.kind === 'compose' ? (
          <>
            <Space size={6}>
              <Button
                icon={<CameraOutlined />}
                loading={capturing}
                onClick={capture}
              >
                Capture
              </Button>
              <Button
                icon={<VideoCameraOutlined />}
                danger={recording}
                type={recording ? 'primary' : 'default'}
                onClick={toggleRecording}
              >
                {recording ? `Stop ${recordSeconds}s` : 'Record'}
              </Button>
            </Space>
            {recording && <span className="sh-pill sh-pill--danger">● REC</span>}
          </>
        ) : (
          <Button
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setStage({ kind: 'compose' })}
          >
            Back to editor
          </Button>
        )}
      </div>

      {/* 内容区：编辑 / 录制确认 两态 */}
      <div className="editor-content">
        {stage.kind === 'compose' && (
          <div className="editor-sheet">
            <input
              className="editor-title"
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="editor-text"
              ref={textRef}
              placeholder="What happened, what it breaks, what you expected…"
              value={text}
              rows={6}
              onChange={(e) => {
                setText(e.target.value);
                autoGrow(e.target);
              }}
            />

            {shots.length > 0 && (
              <div className="editor-shots">
                {shots.map((s, idx) => (
                  <div key={s.id} className="editor-shot">
                    <img src={s.dataUrl} alt={`Shot ${idx + 1}`} />
                    <div className="editor-shot-bar">
                      <span className="editor-shot-label">
                        Shot {idx + 1}
                        {s.annotated && (
                          <span className="sh-pill sh-pill--brand">Annotated</span>
                        )}
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
                          onClick={() =>
                            setShots((prev) => prev.filter((x) => x.id !== s.id))
                          }
                        />
                      </Space>
                    </div>
                    {s.note && (
                      <div className="editor-shot-note">{s.note}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {recordInfo && (
              <div className="editor-record">
                <VideoCameraOutlined />
                <span>
                  Recording: {recordInfo.seconds}s · {recordInfo.eventCount} events
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
          </div>
        )}

        {stage.kind === 'record-confirm' && (
          <div className="record-confirm">
            <div className="record-confirm-icon">
              <VideoCameraOutlined />
            </div>
            <div className="record-confirm-title">Recording finished. Insert it?</div>
            <div className="record-confirm-meta">
              {stage.info.seconds}s · {stage.info.eventCount} events (DOM actions /
              Network / Console timeline)
            </div>
            <Space className="record-confirm-actions">
              <Button
                icon={<CloseOutlined />}
                onClick={() => setStage({ kind: 'compose' })}
              >
                Discard
              </Button>
              <Button
                type="primary"
                icon={<CheckOutlined />}
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
        )}
      </div>

      {/* 底部提交 */}
      <div className="editor-footer">
        <Button
          block
          type="primary"
          size="large"
          icon={<SendOutlined />}
          loading={submitting}
          onClick={submit}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
