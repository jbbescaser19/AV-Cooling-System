import "../../styles/ecommerce/pages.css";

export default function AboutPage() {
  return (
    <section className="page-shell">
      <div className="container">
        <div className="page-intro">
          <div>
            <div className="eyebrow">About</div>
            <h1 className="page-title">AV Cooling System</h1>
            <p className="section-copy">Air-conditioning sales, service, scheduling, and customer support designed around one clear workflow.</p>
          </div>
        </div>
        <div className="surface about-card">
          <p>AV Cooling combines air-conditioning sales, installation, cleaning, repair, scheduling, and after-sales support in one customer-friendly workflow.</p>
          <p className="muted">This current build is a frontend-only prototype prepared for a future MERN backend.</p>
        </div>
      </div>
    </section>
  );
}
