// 麦克风授权页：Chrome 的授权框无法挂在 sidepanel/popup 上，会被直接拒绝（NotAllowedError）。
// 在普通标签页里打开本页请求一次授权，权限按扩展源（chrome-extension://<id>）记录，
// 授权后 sidepanel 的 getUserMedia 即可用。
// 无论允许还是拒绝都广播结果并自动关页；用户直接关页由 sidepanel 的 tabs.onRemoved 兜底。
const title = document.getElementById('title')!;
const status = document.getElementById('status')!;

main().catch((e) => {
  title.textContent = '授权失败';
  status.textContent = String(e);
});

async function main() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    chrome.runtime.sendMessage({ type: 'mic-grant-result', ok: true }, () => void chrome.runtime.lastError);
    title.textContent = '麦克风已授权';
    status.textContent = '本页将自动关闭，录制会带上声音。';
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    const err = e as DOMException;
    chrome.runtime.sendMessage({ type: 'mic-grant-result', ok: false }, () => void chrome.runtime.lastError);
    title.textContent = '麦克风未授权';
    status.textContent = '本次录制将没有声音。之后想补授权，可重新点 Video。';
    setTimeout(() => window.close(), 2500);
    void err;
  }
}
