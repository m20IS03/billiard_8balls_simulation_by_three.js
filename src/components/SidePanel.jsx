//SidePanel.jsx
import PhysicsControls from "./PhysicsControls";
import StatsPanel from "./StatsPanel";
// export default function SidePanel({
//   force,
//   setForce,
//   angleDeg,
//   setAngleDeg,
//   cueContactY,
//   setCueContactY,
//   cueContactX,
//   setCueContactX,
//   cueElevationDeg,
//   setCueElevationDeg,
//   setHitSignal,
//   setResetSignal,
//   stats,
//   cueContactMeaning,
//   cueSideMeaning,
// }) 
export default function SidePanel(props) {
  return (
    <aside className="side-panel">
      <section className="panel-section controls">
        <h2>إعدادات الضربة</h2>
        {[
          {
            label: "قوة الضربة (نيوتن)",
            val: force,
            setter: setForce,
            min: 0.5,
            max: 50,
            step: 0.5,
          },
          {
            label: "زاوية الضربة (°)",
            val: angleDeg,
            setter: setAngleDeg,
            min: -180,
            max: 180,
            step: 1,
          },
          {
            label: `موضع الضربة العمودي (${cueContactMeaning})`,
            val: cueContactY,
            setter: setCueContactY,
            min: -0.7,
            max: 0.7,
            step: 0.05,
          },
          {
            label: `موضع الضربة الأفقي (${cueSideMeaning})`,
            val: cueContactX,
            setter: setCueContactX,
            min: -0.7,
            max: 0.7,
            step: 0.05,
          },
          {
            label: "ميل العصا للقفز (°)",
            val: cueElevationDeg,
            setter: setCueElevationDeg,
            min: 0,
            max: 45,
            step: 1,
          },
        ].map((item, idx) => (
          <div key={idx} className="control-group" style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                marginBottom: "5px",
                color: "#cbd5e1",
              }}
            >
              {item.label}
            </label>
            <input
              type="number"
              value={item.val}
              min={item.min}
              max={item.max}
              step={item.step}
              onChange={(e) => item.setter(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "8px",
                borderRadius: "4px",
                border: "1px solid #334155",
                background: "#1e293b",
                color: "#f8fafc",
              }}
            />
          </div>
        ))}

        <div className="button-grid">
          <button type="button" disabled={!stats.canShoot} onClick={() => setHitSignal((v) => v + 1)}>
            اضرب الكرة
          </button>
          <button type="button" className="secondary" onClick={() => setResetSignal((v) => v + 1)}>
            إعادة ضبط
          </button>
        </div>
      </section>

      <PhysicsControls />

      {/* بيانات الحركة */}
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
    </aside>
  );
}
