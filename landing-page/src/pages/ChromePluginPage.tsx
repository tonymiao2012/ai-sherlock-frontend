import { CHROME_STORE_URL } from '../assets';
import { IconChrome } from '../components/icons';

export function ChromePluginPage() {
  return (
    <section className="lp-section" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div className="lp-container" style={{ textAlign: 'center' }}>
        <h1 className="lp-h1">Chrome 插件</h1>
        <p className="lp-lead" style={{ maxWidth: 640, margin: '24px auto 0' }}>
          一键采集完整现场：截图批注、Network、Console、用户事件与设备信息随单提交，工程师和 AI Agent 拿到即可开工。
        </p>
        <div style={{ marginTop: 40 }}>
          <a
            className="lp-btn lp-btn--primary lp-btn--lg"
            href={CHROME_STORE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <IconChrome size={18} />
            添加到 Chrome
          </a>
        </div>
      </div>
    </section>
  );
}
