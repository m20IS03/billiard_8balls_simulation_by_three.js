//Scoreboard.jsx
export default function Scoreboard({ stats }) {
  const p1Group = stats.playerGroups?.[1];
  const p2Group = stats.playerGroups?.[2];

  return (
    <div className="scoreboard-container">
      {/* كارت اللاعب الأول */}
      <div className={`player-card ${stats.currentPlayer === 1 ? "active-player" : ""}`}>
        <h3>اللاعب 1</h3>
        <div className="group-badge">{p1Group ? (p1Group === "solids" ? "🔴 كرات سادة" : "🎫 كرات مخطط") : "🔄 طاولة مفتوحة"}</div>
        <div className="score-view">
          الكرات المتبقية: <strong>{p1Group === "solids" ? stats.solidsRemaining : p1Group === "stripes" ? stats.stripesRemaining : 7}</strong>
        </div>
      </div>

      {/* مركز التحكم بالرسائل والحالات العامة */}
      <div className="match-status-center">
        <div className="vs-title">قوانين الـ 8-Ball العالمية</div>
        <p className="status-text">{stats.statusMessage}</p>
        {stats.winner && <div className="winner-announcement">👑 الفائز هو اللاعب {stats.winner}!</div>}
      </div>

      {/* كارت اللاعب الثاني */}
      <div className={`player-card ${stats.currentPlayer === 2 ? "active-player" : ""}`}>
        <h3>اللاعب 2</h3>
        <div className="group-badge">{p2Group ? (p2Group === "solids" ? "🔴 كرات سادة" : "🎫 كرات مخطط") : "🔄 طاولة مفتوحة"}</div>
        <div className="score-view">
          الكرات المتبقية: <strong>{p2Group === "solids" ? stats.solidsRemaining : p2Group === "stripes" ? stats.stripesRemaining : 7}</strong>
        </div>
      </div>
    </div>
  );
}