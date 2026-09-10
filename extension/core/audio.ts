// 麦克风采集：原生 getUserMedia + MediaRecorder（webm/opus），零依赖。
// 与 rrweb 录制对齐：startedAt 用 Date.now() 绝对毫秒，两条流可在同一条时间轴上回放。
import type { AudioTrack } from './types';

/** 单段录音上限：base64 进 JSON payload，防止忘停导致请求体失控 */
export const MAX_AUDIO_MS = 10 * 60 * 1000;

export interface MicRecording {
  stop: () => Promise<AudioTrack | null>;
}

export async function startMicRecording(): Promise<MicRecording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = ['audio/webm;codecs=opus', 'audio/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m)
  );
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  let result: AudioTrack | null = null;
  let onFinished: ((track: AudioTrack | null) => void) | null = null;

  const timer = window.setTimeout(() => {
    if (recorder.state !== 'inactive') recorder.stop();
  }, MAX_AUDIO_MS);

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = async () => {
    window.clearTimeout(timer);
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: recorder.mimeType || mime || 'audio/webm' });
    result = {
      startedAt,
      duration: Math.round((Date.now() - startedAt) / 1000),
      mimeType: blob.type,
      dataUrl: await blobToDataUrl(blob),
    };
    onFinished?.(result);
  };
  recorder.start(1000);

  return {
    stop: () =>
      new Promise((resolve) => {
        if (result) return resolve(result);
        onFinished = resolve;
        if (recorder.state !== 'inactive') recorder.stop();
      }),
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
