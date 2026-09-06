// Side Panel：编辑器式提报面板
// 流程：截图 -> 页面内微信式批注（不弹新窗口）-> 成图内嵌；Record -> 确认内嵌；提交打印 payload
// 未提交内容（标题/描述/截图/录制）自动存 IndexedDB，面板重开后可恢复
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Modal, Space, Spin, Tag, message } from 'antd';
import {
  CameraOutlined,
  CheckCircleFilled,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { BRAND_LOGO_URL } from '../../components/BrandLogo';
import { sendRuntime, uid, type CaptureResult } from '../../core/messages';
import { clearDraft, loadCases, loadDraft, saveDraft } from '../../core/db';
import type { AnnotatedShot, IssuePackage, SidebarDraft } from '../../core/types';

interface RecordInfo {
  seconds: number;
  eventCount: number;
}

type Stage = { kind: 'compose' } | { kind: 'record-confirm'; info: RecordInfo };

function isResolvedStatus(status?: string): boolean {
  const s = status?.toUpperCase() ?? '';
  return ['DIAGNOSED', 'VERIFIED', 'VERIFY_SUCCESS', 'COMPLETED'].includes(s);
}

function statusColor(status?: string): string {
  const s = status?.toUpperCase() ?? '';
  if (isResolvedStatus(s)) return 'green';
  if (s === 'FAILED') return 'red';
  if (s === 'DIAGNOSING') return 'orange';
  return 'blue';
}

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
  const [activeTab, setActiveTab] = useState('submit');
  const [cases, setCases] = useState<IssuePackage[]>([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ caseKey?: string } | null>(null);
  const unverifiedCount = useMemo(
    () => cases.filter((c) => !isResolvedStatus(c.status)).length,
    [cases]
  );
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

  // 加载 Case 列表（每次切到 Cases tab 都从后端同步最新状态）
  useEffect(() => {
    if (activeTab === 'cases') {
      setCasesLoading(true);
      sendRuntime<{ ok: boolean; cases?: IssuePackage[]; error?: string }>({
        type: 'fetch-cases',
      })
        .then((resp) => {
          if (resp?.ok && resp.cases) {
            setCases(resp.cases);
          } else {
            return loadCases().then(setCases);
          }
        })
        .catch(() => loadCases().then(setCases))
        .finally(() => setCasesLoading(false));
    }
  }, [activeTab]);

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

  const submit = async () => {
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
      {/* 品牌头 + Tab */}
      <header className="editor-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div className="sh-brand">
          <img className="sh-brand-logo" src={BRAND_LOGO_URL} alt="AI Sherlock" />
          <span className="sh-brand-name">AI Sherlock</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setActiveTab('submit')}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'submit' ? 600 : 400,
              background: activeTab === 'submit' ? '#B4E968' : 'var(--sh-sunken)',
              color: activeTab === 'submit' ? 'var(--sh-brand-ink)' : 'var(--sh-text)',
              transition: 'all 0.2s',
            }}
          >
            Issue
          </button>
          <button
            onClick={() => setActiveTab('cases')}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'cases' ? 600 : 400,
              background: activeTab === 'cases' ? '#B4E968' : 'var(--sh-sunken)',
              color: activeTab === 'cases' ? 'var(--sh-brand-ink)' : 'var(--sh-text)',
              transition: 'all 0.2s',
              position: 'relative',
            }}
          >
            Cases
            {unverifiedCount > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                background: '#ff4d4f',
                color: '#fff',
                fontSize: 10,
                borderRadius: 10,
                padding: '1px 5px',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {unverifiedCount}
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
                {recording && <span style={{ marginLeft: 12, color: '#ff4d4f', fontSize: 12 }}>● REC</span>}
              </div>

              {/* 编辑区：标题 + 文本框占满剩余空间 */}
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

              {/* 截图 & 录制信息（可滚动） */}
              {(shots.length > 0 || recordInfo) && (
                <div style={{ flexShrink: 0, maxHeight: '30%', overflow: 'auto', padding: '8px 16px' }}>
                  {shots.length > 0 && (
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
                  )}
                  {recordInfo && (
                    <div style={{
                      marginTop: 12,
                      padding: 12,
                      background: '#fff',
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 13,
                    }}>
                      <span>
                        <VideoCameraOutlined style={{ marginRight: 8 }} />
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
            </>
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
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Recording finished. Insert it?</div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>
                  {stage.info.seconds}s · {stage.info.eventCount} events
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
              {casesLoading ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>Loading...</div>
              ) : cases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: '#999' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                  <div>No cases yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {cases.map((c) => (
                    <div
                      key={c.issueId}
                      onClick={async () => {
                        if (c.caseKey) {
                          await sendRuntime({ type: 'fetch-case-detail', caseKey: c.caseKey });
                        }
                        chrome.tabs.create({
                          url: chrome.runtime.getURL(`/report.html?caseId=${c.issueId}`),
                        });
                      }}
                      style={{
                        padding: 16,
                        border: '1px solid #e8e8e8',
                        borderRadius: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: '#fff',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = '#B4E968';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(180,233,104,0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e8e8e8';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 15 }}>{c.title || 'Untitled'}</div>
                      <div style={{ fontSize: 12, color: '#666', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace' }}>{c.caseKey ?? c.issueId}</span>
                        <span>{new Date(c.meta.assembledAt).toLocaleString()}</span>
                        <Tag color={statusColor(c.status)}>{c.status ?? 'RECEIVED'}</Tag>
                        {c.severity && <Tag color={c.severity === 'high' ? 'red' : c.severity === 'medium' ? 'orange' : 'green'}>{c.severity}</Tag>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
              style={{ minWidth: 140, background: '#B4E968', borderColor: '#B4E968', color: 'var(--sh-brand-ink)' }}
              onClick={() => {
                setSuccessInfo(null);
                setActiveTab('cases');
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
