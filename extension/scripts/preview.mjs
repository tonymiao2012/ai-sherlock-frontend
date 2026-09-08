#!/usr/bin/env node
// 一键起调试环境：生产构建 -> 测试页静态服务 -> 带插件的 Chrome -> 打开测试页并自检注入。
// 比 bunx wxt -b chrome 快：wxt build 约 2s，且不启 dev server / web-ext 安装流程。
// 用法：bun run preview        （改了源码后重新跑一次即可）
//       bun run preview:fast   （跳过构建，只用现有 .output/chrome-mv3）
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startChrome } from './lib/cdp.mjs';

const EXT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = join(EXT_DIR, '.output/chrome-mv3');
const PROFILE = join(EXT_DIR, '.output/preview-profile');
const TEST_PAGE_DIR = join(EXT_DIR, '..', 'test-page');
const PAGE_PORT = Number(process.env.PAGE_PORT ?? 8766);
const DEV_URL = process.env.DEV_URL ?? 'http://www.aisherlock.vip/';
const NO_BUILD = process.argv.includes('--no-build');

const portOpen = (port) =>
  new Promise((res) => {
    const s = connect({ port, host: '127.0.0.1' });
    s.once('connect', () => (s.destroy(), res(true)));
    s.once('error', () => res(false));
  });

async function ensureTestPageServer() {
  if (await portOpen(PAGE_PORT)) return `已复用 :${PAGE_PORT} 上的服务`;
  spawn(
    'python3',
    ['-m', 'http.server', String(PAGE_PORT), '-d', TEST_PAGE_DIR],
    { stdio: 'ignore', detached: true }
  ).unref();
  for (let i = 0; i < 20 && !(await portOpen(PAGE_PORT)); i++) await delay(200);
  if (!(await portOpen(PAGE_PORT))) throw new Error(`测试页服务起不来 :${PAGE_PORT}`);
  return `已启动 :${PAGE_PORT}`;
}

async function build() {
  console.log('ℹ wxt build …');
  const code = await new Promise((res) =>
    spawn('bunx', ['wxt', 'build'], { cwd: EXT_DIR, stdio: 'inherit' }).on('close', res)
  );
  if (code !== 0) process.exit(code);
}

// 常量与 core/messages.ts 保持一致
const CONTENT_SOURCE = 'ai-sherlock-content';
const PAGE_SOURCE = 'ai-sherlock-page';

// 直接向 MAIN world 脚本要一次 dump：能应答就说明采集脚本真的注入并在跑
const SELF_CHECK = `(async () => {
  const reqId = 'preview-' + Math.random();
  return await new Promise((res) => {
    const on = (e) => {
      const d = e.data;
      if (d?.source !== '${PAGE_SOURCE}' || d?.type !== 'cmd-response' || d.reqId !== reqId) return;
      removeEventListener('message', on);
      const p = d.payload ?? {};
      res({ ok: d.ok, network: p.network?.length, console: p.consoleEntries?.length, errors: p.errors?.length });
    };
    addEventListener('message', on);
    postMessage({ source: '${CONTENT_SOURCE}', type: 'dump-evidence', reqId }, '*');
    setTimeout(() => res('TIMEOUT: MAIN world 脚本未应答，注入失败'), 5000);
  });
})()`;

if (!NO_BUILD) await build();
if (!existsSync(OUTPUT)) {
  console.error(`✗ 找不到产物 ${OUTPUT}，去掉 --no-build 让它先构建`);
  process.exit(1);
}
console.log('✔', await ensureTestPageServer());

let client;
try {
  client = await startChrome({ profileDir: PROFILE });
} catch (e) {
  console.error('✗ Chrome 起不来：', e.message);
  console.error('  若已有 Chrome 占用该 profile，先关掉它（profile: .output/preview-profile）');
  process.exit(1);
}

let id;
try {
  ({ id } = await client.send('Extensions.loadUnpacked', { path: OUTPUT }));
} catch (e) {
  // 上一次运行若把扩展留在了 profile 里，这里会失败；先卸载再装，保证跑的是最新产物
  const sw = (await client.listTargets()).find(
    (t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://')
  );
  const stale = e.message.match(/[a-p]{32}/)?.[0] ?? sw?.url.match(/chrome-extension:\/\/([a-p]{32})/)?.[1];
  if (!stale) {
    await client.close();
    console.error('✗ 扩展安装失败：', e.message);
    console.error('  可删掉 .output/preview-profile 重来');
    process.exit(1);
  }
  console.log('ℹ profile 里已有旧副本，卸载后重载最新产物');
  try {
    await client.send('Extensions.uninstall', { id: stale });
  } catch {
    // 已经不在册就继续
  }
  try {
    ({ id } = await client.send('Extensions.loadUnpacked', { path: OUTPUT }));
  } catch (e2) {
    await client.close();
    console.error('✗ 扩展安装失败：', e2.message);
    process.exit(1);
  }
}
console.log(`✔ AI Sherlock 已加载  chrome-extension://${id}/`);

const tab = await client.newTab('about:blank');
await client.send('Page.enable', {}, tab.sessionId);
await client.send('Page.navigate', { url: DEV_URL }, tab.sessionId);
await delay(1500);
const check = await client.eval(tab.sessionId, SELF_CHECK);
if (check.error) console.log('⚠ 自检异常：', check.error);
else
  console.log(
    typeof check.value === 'string'
      ? `✗ ${check.value}`
      : `✔ 注入正常，证据采集在跑  ${JSON.stringify(check.value)}`
  );

console.log(`\n开发页 ${DEV_URL}`);
console.log('改完源码重新跑 bun run preview；已打开的页面需刷新才会重新注入内容脚本');
console.log('Ctrl-C 关闭这个 Chrome');

process.on('SIGINT', async () => {
  await client.close();
  process.exit(0);
});
client.proc.on('exit', () => process.exit(0));
setInterval(() => {}, 60_000);
