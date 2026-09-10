import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineConfig } from 'wxt';
import type { Plugin } from 'vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [escapeUnicodeNonCharacters()],
  }),
  manifest: {
    name: 'AI Sherlock',
    description:
      'Report issues with annotated screenshots, recording and automatic Network / Console / error-stack evidence',
    permissions: ['sidePanel', 'activeTab', 'tabs', 'storage', 'alarms', 'audioCapture'],
    // <all_urls>：captureVisibleTab 截取任意页面必须；activeTab 授权只在点击图标那一刻
    // 对当前标签页生效，切 tab / 页面跳转后即失效。后端 API 访问也在此声明。
    host_permissions: ['https://www.aisherlock.vip/*', '<all_urls>'],
    // 预览页以 iframe 内嵌在普通网页里，需对页面可见
    web_accessible_resources: [
      { resources: ['preview.html'], matches: ['<all_urls>'] },
    ],
    // public/icon/* 由 assets/logo.png 生成：
    //   sips -c 526 526 assets/logo.png --out /tmp/tile.png
    //   for s in 16 32 48 128; do sips -z $s $s /tmp/tile.png --out public/icon/$s.png; done
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'AI Sherlock',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
        48: 'icon/48.png',
        128: 'icon/128.png',
      },
    },
  },
});

/**
 * rrweb 依赖链里 postcss 源码写的 '\uFFFE' 转义会被 rolldown 还原成裸的 Unicode 非字符，
 * Chrome 以“内容脚本文件采用的不是 UTF-8 编码”为由拒绝注入该文件（只在 service worker
 * 留一行 warn），MAIN world 的采集脚本因此静默失效、证据链全空。
 * rolldown 的压缩发生在所有 JS renderChunk 之后，所以只能在文件落盘后再改一遍。
 */
function escapeUnicodeNonCharacters(): Plugin {
  let outDir = '';
  return {
    name: 'escape-unicode-non-characters',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    async writeBundle() {
      await escapeJsFiles(outDir);
    },
  };
}

const NON_CHARACTERS = /[\uFDD0-\uFDEF\uFEFF\uFFFE\uFFFF]/g;

async function escapeJsFiles(dir: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return escapeJsFiles(path);
      if (!entry.name.endsWith('.js')) return;
      const code = await readFile(path, 'utf8');
      const escaped = code.replace(
        NON_CHARACTERS,
        (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
      );
      if (escaped !== code) await writeFile(path, escaped, 'utf8');
    })
  );
}
