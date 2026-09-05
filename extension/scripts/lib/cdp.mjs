// 最小 CDP over pipe 客户端。
// Chrome 137+ 起 --load-extension 被忽略，未打包扩展只能通过 CDP 的 Extensions 域安装，
// 而该域只在 --remote-debugging-pipe 传输下开放（HTTP /json 通道不暴露它），故自己实现收发。
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const CHROME_BIN =
  process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export class PipeCdp {
  constructor(proc, sinks, sources) {
    this.proc = proc;
    this.id = 0;
    this.pending = new Map();
    this.events = [];
    for (const stream of sources) {
      let buf = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buf += chunk;
        let i;
        // pipe 传输以 NUL 分隔消息
        while ((i = buf.indexOf('\0')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line) continue;
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            continue;
          }
          if (msg.id && this.pending.has(msg.id)) {
            const { res, rej } = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
          } else if (msg.method) {
            this.events.push(msg);
          }
        }
      });
    }
    // fd3/fd4 哪个是收哪个是发不稳定，两个方向都写、都读
    this.sinks = sinks;
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = JSON.stringify({
      id,
      method,
      params,
      ...(sessionId && { sessionId }),
    });
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      for (const w of this.sinks) {
        try {
          w.write(payload + '\0');
        } catch {
          // 另一个方向通常可用
        }
      }
      delay(20000).then(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rej(new Error('timeout: ' + method));
        }
      });
    });
  }

  async eval(sessionId, expression) {
    const r = await this.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      sessionId
    );
    if (r.exceptionDetails)
      return {
        error:
          r.exceptionDetails.exception?.description ?? r.exceptionDetails.text,
      };
    return { value: r.result.value };
  }

  async listTargets() {
    return (await this.send('Target.getTargets')).targetInfos;
  }

  async attach(targetId) {
    const { sessionId } = await this.send('Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    await this.send('Runtime.enable', {}, sessionId);
    return sessionId;
  }

  async newTab(url) {
    const { targetId } = await this.send('Target.createTarget', { url });
    return { targetId, sessionId: await this.attach(targetId) };
  }

  async close() {
    try {
      await this.send('Browser.close');
    } catch {
      // Browser.close 会直接断管，超时属正常
    }
    this.proc.kill('SIGKILL');
  }
}

export async function startChrome({ profileDir, args = [], startUrl = 'about:blank' }) {
  const proc = spawn(
    CHROME_BIN,
    [
      `--user-data-dir=${profileDir}`,
      '--remote-debugging-pipe',
      '--enable-unsafe-extension-debugging',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-background-networking',
      '--disable-features=Translate',
      ...args,
      startUrl,
    ],
    { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] }
  );
  const client = new PipeCdp(proc, [proc.stdio[3], proc.stdio[4]], [
    proc.stdio[3],
    proc.stdio[4],
  ]);
  for (let i = 0; i < 25; i++) {
    try {
      const v = await Promise.race([
        client.send('Browser.getVersion'),
        delay(1200).then(() => null),
      ]);
      if (v) return client;
    } catch (e) {
      console.log('  handshake error:', e.message);
    }
  }
  proc.kill('SIGKILL');
  throw new Error('CDP pipe handshake failed');
}
