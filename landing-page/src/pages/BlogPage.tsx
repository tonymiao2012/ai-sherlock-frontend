export function BlogPage() {
  return (
    <section className="lp-section" style={{ paddingTop: 120, paddingBottom: 80 }}>
      <div className="lp-container" style={{ textAlign: 'center' }}>
        <h1 className="lp-h1">博客</h1>
        <p className="lp-lead" style={{ maxWidth: 640, margin: '24px auto 0' }}>
          产品动态、技术分享与问题诊断案例。
        </p>
        <p style={{ marginTop: 32, color: 'var(--sh-muted)', fontSize: 14 }}>
          博客即将上线，敬请期待。
        </p>
      </div>
    </section>
  );
}
