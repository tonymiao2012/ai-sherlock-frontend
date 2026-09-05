export function ChangelogPage() {
  return (
    <section className="lp-section" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div className="lp-container" style={{ textAlign: 'center' }}>
        <h1 className="lp-h1">更新日志</h1>
        <p className="lp-lead" style={{ maxWidth: 640, margin: '24px auto 0' }}>
          版本迭代记录与功能变更说明。
        </p>
        <p style={{ marginTop: 32, color: 'var(--sh-muted)', fontSize: 14 }}>
          更新日志即将上线，敬请期待。
        </p>
      </div>
    </section>
  );
}
