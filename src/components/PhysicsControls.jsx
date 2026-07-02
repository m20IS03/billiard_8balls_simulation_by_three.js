//PhysicsControls.jsx
import { PHYSICS_CONFIG_METADATA, setPhysicsParameter } from "../physics/index.js";
export default function PhysicsControls() {
  return (
    // {/* إعدادات الفيزياء الرقمية */}
    <section className="panel-section">
      <h2>إعدادات الفيزياء</h2>
      {Object.entries(PHYSICS_CONFIG_METADATA).map(([key, meta]) => (
        <div key={key} className="control-group" style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              marginBottom: "5px",
              color: "#cbd5e1",
            }}
          >
            {meta.label}
          </label>
          <input
            type="number"
            step="0.01"
            defaultValue={meta.default}
            onBlur={(e) => setPhysicsParameter(null, key, parseFloat(e.target.value))}
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
    </section>
  );
}
