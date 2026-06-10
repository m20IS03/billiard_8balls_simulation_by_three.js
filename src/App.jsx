import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  BALL_RADIUS,
  BALL_Y,
  CUE_START,
  FIXED_DT,
  MAX_FRAME_DT,
  MAX_SUBSTEPS,
  POCKET_RADIUS,
  POCKETS,
  TABLE_DEPTH,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  areAnyBallsMoving,
  getStats,
  isBallMoving,
  makeWorld,
  shootCueBall,
  stepWorld,
} from "./physics.js";
function Scoreboard({ stats }) {
  const p1Group = stats.playerGroups?.[1];
  const p2Group = stats.playerGroups?.[2];

  return (
    <div className="scoreboard-container">
      {/* كارت اللاعب الأول */}
      <div
        className={`player-card ${stats.currentPlayer === 1 ? "active-player" : ""}`}
      >
        <h3>اللاعب 1</h3>
        <div className="group-badge">
          {p1Group
            ? p1Group === "solids"
              ? "🔴 كرات سادة"
              : "🎫 كرات مخطط"
            : "🔄 طاولة مفتوحة"}
        </div>
        <div className="score-view">
          الكرات المتبقية:{" "}
          <strong>
            {p1Group === "solids"
              ? stats.solidsRemaining
              : p1Group === "stripes"
                ? stats.stripesRemaining
                : 7}
          </strong>
        </div>
      </div>

      {/* مركز التحكم بالرسائل والحالات العامة */}
      <div className="match-status-center">
        <div className="vs-title">قوانين الـ 8-Ball العالمية</div>
        <p className="status-text">{stats.statusMessage}</p>
        {stats.winner && (
          <div className="winner-announcement">
            👑 الفائز هو اللاعب {stats.winner}!
          </div>
        )}
      </div>

      {/* كارت اللاعب الثاني */}
      <div
        className={`player-card ${stats.currentPlayer === 2 ? "active-player" : ""}`}
      >
        <h3>اللاعب 2</h3>
        <div className="group-badge">
          {p2Group
            ? p2Group === "solids"
              ? "🔴 كرات سادة"
              : "🎫 كرات مخطط"
            : "🔄 طاولة مفتوحة"}
        </div>
        <div className="score-view">
          الكرات المتبقية:{" "}
          <strong>
            {p2Group === "solids"
              ? stats.solidsRemaining
              : p2Group === "stripes"
                ? stats.stripesRemaining
                : 7}
          </strong>
        </div>
      </div>
    </div>
  );
}
function Table({ onAimAtPoint }) {
  const railThickness = 0.1;
  const railHeight = 0.075;
  const railY = TABLE_HEIGHT / 2 + railHeight / 2;

  // إحداثيات أقدام الطاولة الأربعة بناءً على الطول والعرض
  const legX = TABLE_WIDTH / 2 - 0.15;
  const legZ = TABLE_DEPTH / 2 - 0.15;
  const legHeight = 0.75; // طول القدم المناسب للارتفاع
  const legY = -0.065 - legHeight / 2; // وضع القدم تحت قاعدة الطاولة مباشرة

  function handlePointer(event) {
    event.stopPropagation();
    if (onAimAtPoint) onAimAtPoint(event.point);
  }

  return (
    <group>
      {/* قاعدة الطاولة الخشبية */}
      <mesh position={[0, -0.065, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH + 0.32, 0.13, TABLE_DEPTH + 0.32]} />
        <meshStandardMaterial color="#5b341e" roughness={0.72} />
      </mesh>

      {/* أقدام الطاولة الأربعة */}
      <mesh position={[-legX, legY, -legZ]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.05, legHeight, 16]} />
        <meshStandardMaterial color="#422312" roughness={0.8} />
      </mesh>
      <mesh position={[legX, legY, -legZ]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.05, legHeight, 16]} />
        <meshStandardMaterial color="#422312" roughness={0.8} />
      </mesh>
      <mesh position={[-legX, legY, legZ]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.05, legHeight, 16]} />
        <meshStandardMaterial color="#422312" roughness={0.8} />
      </mesh>
      <mesh position={[legX, legY, legZ]} castShadow receiveShadow>
        <cylinderGeometry args={[0.08, 0.05, legHeight, 16]} />
        <meshStandardMaterial color="#422312" roughness={0.8} />
      </mesh>

      {/* سطح القماش الأخضر */}
      <mesh
        position={[0, 0, 0]}
        receiveShadow
        onPointerMove={handlePointer}
        onPointerDown={handlePointer}
      >
        <boxGeometry args={[TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH]} />
        <meshStandardMaterial color="#0f7a43" roughness={0.92} />
      </mesh>

      {/* الحواف الجانبية */}
      <mesh
        position={[0, railY, -TABLE_DEPTH / 2 - railThickness / 2]}
        castShadow
      >
        <boxGeometry
          args={[TABLE_WIDTH + railThickness * 2, railHeight, railThickness]}
        />
        <meshStandardMaterial color="#6b3f24" roughness={0.74} />
      </mesh>

      <mesh
        position={[0, railY, TABLE_DEPTH / 2 + railThickness / 2]}
        castShadow
      >
        <boxGeometry
          args={[TABLE_WIDTH + railThickness * 2, railHeight, railThickness]}
        />
        <meshStandardMaterial color="#6b3f24" roughness={0.74} />
      </mesh>

      <mesh
        position={[-TABLE_WIDTH / 2 - railThickness / 2, railY, 0]}
        castShadow
      >
        <boxGeometry
          args={[railThickness, railHeight, TABLE_DEPTH + railThickness * 2]}
        />
        <meshStandardMaterial color="#6b3f24" roughness={0.74} />
      </mesh>

      <mesh
        position={[TABLE_WIDTH / 2 + railThickness / 2, railY, 0]}
        castShadow
      >
        <boxGeometry
          args={[railThickness, railHeight, TABLE_DEPTH + railThickness * 2]}
        />
        <meshStandardMaterial color="#6b3f24" roughness={0.74} />
      </mesh>

      {/* الجيوب الستة */}
      {POCKETS.map((pocket, index) => (
        <mesh
          key={index}
          position={[pocket.x, TABLE_HEIGHT / 2 + 0.004, pocket.z]}
        >
          <cylinderGeometry args={[POCKET_RADIUS, POCKET_RADIUS, 0.012, 64]} />
          <meshStandardMaterial color="#020617" roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
function AimGuide({ cuePos, angleDeg, power, visible }) {
  if (!visible) return null;

  const angle = THREE.MathUtils.degToRad(angleDeg);
  const length = 0.22 + (power / 100) * 0.48;
  const startOffset = BALL_RADIUS + 0.04;
  const guideY = BALL_Y + 0.005;

  return (
    <group position={[cuePos.x, guideY, cuePos.z]} rotation={[0, -angle, 0]}>
      <mesh
        position={[startOffset + length / 2, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <cylinderGeometry args={[0.0055, 0.0055, length, 18]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive="#334155"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh
        position={[startOffset + length + 0.035, 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[0.022, 0.06, 28]} />
        <meshStandardMaterial
          color="#f8fafc"
          emissive="#334155"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function CueStick({ cuePos, angleDeg, power, visible }) {
  if (!visible) return null;

  const angle = THREE.MathUtils.degToRad(angleDeg);
  const pullBack = 0.12 + (power / 100) * 0.26;
  const cueLength = 0.72;
  const cueY = BALL_Y + 0.005;

  return (
    <group position={[cuePos.x, cueY, cuePos.z]} rotation={[0, -angle, 0]}>
      <mesh
        position={[-pullBack - cueLength / 2, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.01, 0.016, cueLength, 24]} />
        <meshStandardMaterial color="#d6a15d" roughness={0.62} />
      </mesh>
      <mesh position={[-pullBack - 0.025, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.006, 0.006, 0.05, 18]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </mesh>
    </group>
  );
}

function BallMesh({ ball, geometry, registerMesh }) {
  const meshRef = useRef();

  React.useEffect(() => {
    if (ball && registerMesh) {
      registerMesh(ball.id, meshRef.current);
    }
    return () => {
      if (ball && registerMesh) {
        registerMesh(ball.id, null);
      }
    };
  }, [ball, registerMesh]);

  if (!ball) return null;

  const color = ball.color || "#ffffff";

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.15} metalness={0.05} />
    </mesh>
  );
}

function BilliardsScene({
  power,
  angleDeg,
  cueContactY,
  cueContactX,
  cueElevationDeg,
  hitSignal,
  resetSignal,
  onStats,
  onAimAngleChange,
}) {
  const worldRef = useRef(makeWorld());
  const meshRefs = useRef(new Map());
  const lastHitSignal = useRef(hitSignal);
  const lastResetSignal = useRef(resetSignal);
  const accumulator = useRef(0);
  const statsTimer = useRef(0);

  const [viewState, setViewState] = useState({
    canShoot: true,
    cuePos: CUE_START.clone(),
  });

  const ballGeometry = useMemo(
    () => new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
    [],
  );

  function registerMesh(id, mesh) {
    const ball = worldRef.current.balls.find(
      (candidate) => candidate.id === id,
    );
    if (ball) {
      ball.mesh = mesh || null;
    }
    if (mesh) {
      meshRefs.current.set(id, mesh);
    } else {
      meshRefs.current.delete(id);
    }
  }

  function syncMeshes(dt) {
    for (const ball of worldRef.current.balls) {
      const mesh = meshRefs.current.get(ball.id);
      if (!mesh) continue;

      mesh.visible = ball.active;
      if (!ball.active) continue;

      mesh.position.set(ball.position.x, ball.position.y, ball.position.z);

      if (dt > 0 && (ball.velocity.x !== 0 || ball.velocity.z !== 0)) {
        mesh.rotation.x += ball.omega.x * dt;
        mesh.rotation.y += ball.omega.y * dt;
        mesh.rotation.z += ball.omega.z * dt;
      }
    }
  }

  function publishStats() {
    const stats = getStats(worldRef.current);
    const cue = worldRef.current.balls[0];
    const cuePos = cue && cue.active ? cue.position.clone() : CUE_START.clone();

    onStats(stats);
    setViewState({ canShoot: stats.canShoot, cuePos });
  }

  function resetSimulation() {
    worldRef.current = makeWorld();
    accumulator.current = 0;
    statsTimer.current = 0;
    syncMeshes(0);
    publishStats();
  }

  function aimFromPoint(point) {
    const world = worldRef.current;
    const cue = world.balls[0];

    if (!cue || !cue.active || areAnyBallsMoving(world.balls)) return;

    const dx = point.x - cue.position.x;
    const dz = point.z - cue.position.z;

    if (dx * dx + dz * dz < BALL_RADIUS * BALL_RADIUS * 4) return;

    const nextAngle = THREE.MathUtils.radToDeg(Math.atan2(dz, dx));
    onAimAngleChange(Number(nextAngle.toFixed(1)));
  }

  useFrame((state, delta) => {
    state.camera.lookAt(0, 0, 0);

    if (resetSignal !== lastResetSignal.current) {
      lastResetSignal.current = resetSignal;
      resetSimulation();
    }

    if (hitSignal !== lastHitSignal.current) {
      lastHitSignal.current = hitSignal;
      const didShoot = shootCueBall(
        worldRef.current,
        power,
        angleDeg,
        cueContactY,
        cueContactX,
        cueElevationDeg,
      );

      if (didShoot) {
        const cue = worldRef.current.balls[0];
        const cuePos =
          cue && cue.active ? cue.position.clone() : CUE_START.clone();

        setViewState({ canShoot: false, cuePos });
        onStats(getStats(worldRef.current));
      }
    }

    const frameDt = Math.min(delta, MAX_FRAME_DT);
    accumulator.current += frameDt;

    let substeps = 0;
    while (accumulator.current >= FIXED_DT && substeps < MAX_SUBSTEPS) {
      stepWorld(worldRef.current, FIXED_DT);
      accumulator.current -= FIXED_DT;
      substeps += 1;
    }

    if (substeps === MAX_SUBSTEPS) {
      accumulator.current = 0;
    }

    syncMeshes(frameDt);

    statsTimer.current += frameDt;
    if (statsTimer.current >= 0.12) {
      statsTimer.current = 0;
      publishStats();
    }
  });

  const balls = worldRef.current.balls;

  return (
    <>
      <color attach="background" args={["#07111f"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[0.4, 2.4, 1.1]} intensity={1.7} castShadow />
      <pointLight position={[-1.3, 1.1, -0.8]} intensity={0.6} />

      <Table onAimAtPoint={aimFromPoint} />

      <AimGuide
        cuePos={viewState.cuePos}
        angleDeg={angleDeg}
        power={power}
        visible={viewState.canShoot}
      />
      <CueStick
        cuePos={viewState.cuePos}
        angleDeg={angleDeg}
        power={power}
        visible={viewState.canShoot}
      />

      {balls.map((ball) => (
        <BallMesh
          key={ball.id}
          ball={ball}
          geometry={ballGeometry}
          registerMesh={registerMesh}
        />
      ))}
    </>
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

export default function App() {
  const [power, setPower] = useState(55);
  const [angleDeg, setAngleDeg] = useState(0);
  const [cueContactY, setCueContactY] = useState(0);
  const [cueContactX, setCueContactX] = useState(0);
  const [cueElevationDeg, setCueElevationDeg] = useState(0);
  const [hitSignal, setHitSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [stats, setStats] = useState(getStats(makeWorld()));

  const cueContactMeaning =
    cueContactY > 0.05
      ? "Topspin"
      : cueContactY < -0.05
        ? "Backspin"
        : "Center";
  const cueSideMeaning =
    cueContactX > 0.05
      ? "Sidespin Right"
      : cueContactX < -0.05
        ? "Sidespin Left"
        : "Center";

  return (
    <main className="app-shell">
      <div className="layout">
        <section
          className="canvas-card"
          aria-label="مشهد البلياردو ثلاثي الأبعاد"
        >
          <Canvas
            shadows
            dpr={[1, 2]}
            /* تحديث موضع الكاميرا (position):
               X = 0 للبقاء في منتصف الجانب الطويل للطاولة تماماً.
               Y = 2.5 الارتفاع العمودي المناسب.
               Z = 2.05 الإزاحة للخلف لتحقيق زاوية ميل دقيقة تقارب 60 درجة بالتعاون مع lookAt(0,0,0).
               تحديث مجال الرؤية (fov):
               تم رفعه إلى 50 لاستيعاب أطراف الطاولة الطويلة داخل الكادر بعد خفض الكاميرا.
            */
            camera={{ position: [0, 2.5, 2.05], fov: 50, near: 0.01, far: 40 }}
          >
            <BilliardsScene
              power={power}
              angleDeg={angleDeg}
              cueContactY={cueContactY}
              cueContactX={cueContactX}
              cueElevationDeg={cueElevationDeg}
              hitSignal={hitSignal}
              resetSignal={resetSignal}
              onStats={setStats}
              onAimAngleChange={setAngleDeg}
            />
          </Canvas>
        </section>

        <aside className="side-panel">
          <section className="panel-section">
            <p className="eyebrow">Three.js + فيزياء يدوية</p>
            <h1>محاكاة بلياردو 3D</h1>
            <p className="description">
              العرض ثلاثي الأبعاد يتم عبر Three.js، أما الحركة والتصادمات
              والاحتكاك فهي مكتوبة يدويًا بدون محرك فيزياء جاهز.
            </p>
          </section>

          <section className="panel-section controls">
            <label>
              <span>
                <b>قوة الضربة</b>
                <strong>{power}%</strong>
              </span>
              <input
                type="range"
                min="5"
                max="100"
                value={power}
                onChange={(event) => setPower(Number(event.target.value))}
              />
            </label>

            <label>
              <span>
                <b>زاوية الضربة</b>
                <strong>{angleDeg}°</strong>
              </span>
              <input
                type="range"
                min="-180"
                max="180"
                value={angleDeg}
                onChange={(event) => setAngleDeg(Number(event.target.value))}
              />
            </label>

            <label>
              <span>
                <b>موضع الضربة العمودي</b>
                <strong>
                  {cueContactY.toFixed(2)} - {cueContactMeaning}
                </strong>
              </span>
              <input
                type="range"
                min="-0.7"
                max="0.7"
                step="0.05"
                value={cueContactY}
                onChange={(event) => setCueContactY(Number(event.target.value))}
              />
            </label>

            <label>
              <span>
                <b>موضع الضربة الأفقي</b>
                <strong>
                  {cueContactX.toFixed(2)} - {cueSideMeaning}
                </strong>
              </span>
              <input
                type="range"
                min="-0.7"
                max="0.7"
                step="0.05"
                value={cueContactX}
                onChange={(event) => setCueContactX(Number(event.target.value))}
              />
            </label>

            <label>
              <span>
                <b>ميل العصا للقفز</b>
                <strong>{cueElevationDeg}°</strong>
              </span>
              <input
                type="range"
                min="0"
                max="45"
                step="1"
                value={cueElevationDeg}
                onChange={(event) =>
                  setCueElevationDeg(Number(event.target.value))
                }
              />
            </label>

            <div className="button-grid">
              <button
                type="button"
                disabled={!stats.canShoot}
                onClick={() => setHitSignal((value) => value + 1)}
              >
                اضرب الكرة
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setResetSignal((value) => value + 1)}
              >
                إعادة ضبط
              </button>
            </div>

            <p className="hint">
              يمكن تغيير الزاوية من الشريط أو بتحريك المؤشر فوق سطح الطاولة
              عندما تكون الكرات متوقفة.
            </p>
          </section>

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

          <section className="panel-section note">
            <h2>النموذج الفيزيائي</h2>
            <p>
              النموذج يعمل على مستوى أفقي ثنائي الأبعاد داخل مشهد ثلاثي الأبعاد،
              مع احتكاك دحرجة، معاملات ارتداد، تصحيح تداخل، وخطوة زمنية ثابتة
              لزيادة استقرار التصادمات.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
