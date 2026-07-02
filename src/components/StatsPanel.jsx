//StatsPanel.jsx
function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}
function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default function StatsPanel({ stats }) {
  return (
    <section className="panel-section">
      <h2>بيانات الحركة</h2>

      <div className="stats-grid">
        <Stat title="سرعة البيضاء" value={stats.cueSpeed} />
        <Stat title="كرات تتحرك" value={stats.moving} />
        <Stat title="التصادمات" value={stats.collisions} />
        <Stat title="كرات دخلت" value={stats.pocketed} />
        <Stat title="Scratch" value={stats.scratches} />
        <Stat title="جاهز للضرب" value={stats.canShoot ? "نعم" : "لا"} />
      </div>
    </section>
  );
}