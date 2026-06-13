import React, { useEffect, useRef, useState } from "react";
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
  makeWorld,
  shootCueBall,
  stepWorld,
  PHYSICS_CONFIG_METADATA,
  setPhysicsParameter,
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

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <p>{title}</p>
      <strong>{value}</strong>
    </div>
  );
}

export default function App() {
  // مرجع لتتبع زاوية الكاميرا والمسافة دون إعادة رندرة المكون بكثرة
  const cameraParams = useRef({ angle: 0, distance: 3.5 });
  const containerRef = useRef(null);

  const [physicsValues, setPhysicsValues] = useState({
    G: PHYSICS_CONFIG_METADATA.G.default,
    MU_S: PHYSICS_CONFIG_METADATA.MU_S.default,
    MU_R: PHYSICS_CONFIG_METADATA.MU_R.default,
    BALL_MASS: PHYSICS_CONFIG_METADATA.BALL_MASS.default,
  });
  const [force, setForce] = useState(5.0);
  const [angleDeg, setAngleDeg] = useState(0);
  const [cueContactY, setCueContactY] = useState(0);
  const [cueContactX, setCueContactX] = useState(0);
  const [cueElevationDeg, setCueElevationDeg] = useState(0);
  const [hitSignal, setHitSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [stats, setStats] = useState(() => getStats(makeWorld()));

  const inputsRef = useRef({
    force,
    angleDeg,
    cueContactY,
    cueContactX,
    cueElevationDeg,
    hitSignal,
    resetSignal,
  });

  useEffect(() => {
    inputsRef.current = {
      force,
      angleDeg,
      cueContactY,
      cueContactX,
      cueElevationDeg,
      hitSignal,
      resetSignal,
    };
  }, [
    force,
    angleDeg,
    cueContactY,
    cueContactX,
    cueElevationDeg,
    hitSignal,
    resetSignal,
  ]);

  // مراقبة لوحة المفاتيح لتغيير زاوية الكاميرا وعمقها بسلاسة عالية جداً
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case "ArrowLeft":
          cameraParams.current.angle -= 0.08; // سرعة الدوران لليسار
          break;
        case "ArrowRight":
          cameraParams.current.angle += 0.08; // سرعة الدوران لليمين
          break;
        case "w":
        case "W":
          cameraParams.current.distance = Math.max(
            1.3,
            cameraParams.current.distance - 0.15,
          ); // الحد الأدنى للتقريب
          break;
        case "s":
        case "S":
          cameraParams.current.distance = Math.min(
            6.5,
            cameraParams.current.distance + 0.15,
          ); // الحد الأقصى للتبعيد
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07111f");

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 40);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    containerRef.current.appendChild(renderer.domElement);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.7);
    dirLight.position.set(0.4, 2.4, 1.1);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 10;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(-1.3, 1.1, -0.8);
    scene.add(pointLight);

    const tableGroup = new THREE.Group();
    const railThickness = 0.1;
    const railHeight = 0.075;
    const railY = TABLE_HEIGHT / 2 + railHeight / 2;
    const legX = TABLE_WIDTH / 2 - 0.15;
    const legZ = TABLE_DEPTH / 2 - 0.15;
    const legHeight = 0.75;
    const legY = -0.065 - legHeight / 2;

    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH + 0.32, 0.13, TABLE_DEPTH + 0.32),
      new THREE.MeshStandardMaterial({ color: "#5b341e", roughness: 0.72 }),
    );
    baseMesh.position.set(0, -0.065, 0);
    baseMesh.receiveShadow = true;
    tableGroup.add(baseMesh);

    const legGeometry = new THREE.CylinderGeometry(0.08, 0.05, legHeight, 16);
    const legMaterial = new THREE.MeshStandardMaterial({
      color: "#422312",
      roughness: 0.8,
    });
    const legPositions = [
      [-legX, legY, -legZ],
      [legX, legY, -legZ],
      [-legX, legY, legZ],
      [legX, legY, legZ],
    ];
    legPositions.forEach(([x, y, z]) => {
      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.position.set(x, y, z);
      legMesh.castShadow = true;
      legMesh.receiveShadow = true;
      tableGroup.add(legMesh);
    });

    const clothMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH),
      new THREE.MeshStandardMaterial({ color: "#0f7a43", roughness: 0.92 }),
    );
    clothMesh.receiveShadow = true;
    tableGroup.add(clothMesh);

    const railMaterial = new THREE.MeshStandardMaterial({
      color: "#6b3f24",
      roughness: 0.74,
    });
    const r1 = new THREE.Mesh(
      new THREE.BoxGeometry(
        TABLE_WIDTH + railThickness * 2,
        railHeight,
        railThickness,
      ),
      railMaterial,
    );
    r1.position.set(0, railY, -TABLE_DEPTH / 2 - railThickness / 2);
    r1.castShadow = true;
    tableGroup.add(r1);

    const r2 = new THREE.Mesh(
      new THREE.BoxGeometry(
        TABLE_WIDTH + railThickness * 2,
        railHeight,
        railThickness,
      ),
      railMaterial,
    );
    r2.position.set(0, railY, TABLE_DEPTH / 2 + railThickness / 2);
    r2.castShadow = true;
    tableGroup.add(r2);

    const r3 = new THREE.Mesh(
      new THREE.BoxGeometry(
        railThickness,
        railHeight,
        TABLE_DEPTH + railThickness * 2,
      ),
      railMaterial,
    );
    r3.position.set(-TABLE_WIDTH / 2 - railThickness / 2, railY, 0);
    r3.castShadow = true;
    tableGroup.add(r3);

    const r4 = new THREE.Mesh(
      new THREE.BoxGeometry(
        railThickness,
        railHeight,
        TABLE_DEPTH + railThickness * 2,
      ),
      railMaterial,
    );
    r4.position.set(TABLE_WIDTH / 2 + railThickness / 2, railY, 0);
    r4.castShadow = true;
    tableGroup.add(r4);

    const pocketDepth = 0.06;
    const pocketGeometry = new THREE.CylinderGeometry(
      POCKET_RADIUS,
      POCKET_RADIUS * 0.85,
      pocketDepth,
      32,
    );
    const pocketMaterial = new THREE.MeshStandardMaterial({
      color: "#05070f",
      roughness: 0.9,
      metalness: 0.1,
    });

    const rimGeometry = new THREE.RingGeometry(
      POCKET_RADIUS,
      POCKET_RADIUS + 0.018,
      32,
    );
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: "#1e293b",
      roughness: 0.4,
      metalness: 0.2,
      side: THREE.DoubleSide,
    });

    POCKETS.forEach((pocket) => {
      const pMesh = new THREE.Mesh(pocketGeometry, pocketMaterial);
      pMesh.position.set(
        pocket.x,
        TABLE_HEIGHT / 2 - pocketDepth / 2,
        pocket.z,
      );
      pMesh.receiveShadow = true;
scene.add(pMesh);
      const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);
      rimMesh.position.set(pocket.x, TABLE_HEIGHT / 2 + 0.001, pocket.z);
      rimMesh.rotation.x = -Math.PI / 2;
      rimMesh.castShadow = true;
      scene.add(rimMesh);
    });
    scene.add(tableGroup);

    const aimGuideGroup = new THREE.Group();
    const guideCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 1, 18),
      new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        emissive: "#334155",
        emissiveIntensity: 0.3,
      }),
    );
    guideCylinder.rotation.z = -Math.PI / 2;
    aimGuideGroup.add(guideCylinder);

    const guideCone = new THREE.Mesh(
      new THREE.ConeGeometry(0.022, 0.06, 28),
      new THREE.MeshStandardMaterial({
        color: "#f8fafc",
        emissive: "#334155",
        emissiveIntensity: 0.3,
      }),
    );
    guideCone.rotation.z = -Math.PI / 2;
    aimGuideGroup.add(guideCone);
    scene.add(aimGuideGroup);

    const cueStickGroup = new THREE.Group();
    const cueLength = 0.72;
    const stickMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.016, cueLength, 24),
      new THREE.MeshStandardMaterial({ color: "#d6a15d", roughness: 0.62 }),
    );
    stickMesh.rotation.z = Math.PI / 2;
    cueStickGroup.add(stickMesh);

    const tipMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.05, 18),
      new THREE.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.5 }),
    );
    tipMesh.rotation.z = Math.PI / 2;
    cueStickGroup.add(tipMesh);
    scene.add(cueStickGroup);

    let world = makeWorld();
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const ballVisuals = [];

    const initializeBallMeshes = () => {
      ballVisuals.forEach((v) => {
        scene.remove(v.mesh);
        if (v.mesh.material) {
          if (v.mesh.material.map) v.mesh.material.map.dispose();
          v.mesh.material.dispose();
        }
      });
      ballVisuals.length = 0;

      const createStripedTexture = (colorHex) => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 256, 128);

        ctx.fillStyle = colorHex;
        ctx.fillRect(0, 32, 256, 64);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        return texture;
      };

      world.balls.forEach((ball) => {
        const isStripe =
          ball.isStripe ||
          ball.type === "stripes" ||
          (ball.id >= 9 && ball.id <= 15);

        let ballMat;

        if (isStripe) {
          ballMat = new THREE.MeshStandardMaterial({
            map: createStripedTexture(ball.color || "#ff0000"),
            roughness: 0.15,
            metalness: 0.05,
          });
        } else {
          ballMat = new THREE.MeshStandardMaterial({
            color: ball.color || "#ffffff",
            roughness: 0.15,
            metalness: 0.05,
          });
        }

        const mesh = new THREE.Mesh(ballGeometry, ballMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        ballVisuals.push({ id: ball.id, ballData: ball, mesh: mesh });
      });
    };

    initializeBallMeshes();

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerAim = (event) => {
      if (areAnyBallsMoving(world.balls)) return;
      const cueBall = world.balls[0];
      if (!cueBall || !cueBall.active) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(clothMesh);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const dx = point.x - cueBall.position.x;
        const dz = point.z - cueBall.position.z;

        if (dx * dx + dz * dz < BALL_RADIUS * BALL_RADIUS * 4) return;

        const nextAngle = THREE.MathUtils.radToDeg(Math.atan2(dz, dx));
        setAngleDeg(Number(nextAngle.toFixed(1)));
      }
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerAim);
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (e.buttons === 1) handlePointerAim(e);
    });

    let lastHitSignal = inputsRef.current.hitSignal;
    let lastResetSignal = inputsRef.current.resetSignal;
    let physicsAccumulator = 0;
    let uiStatsTimer = 0;
    let lastTime = performance.now();
    let animationFrameId;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      const currentInputs = inputsRef.current;

      if (currentInputs.resetSignal !== lastResetSignal) {
        lastResetSignal = currentInputs.resetSignal;
        world = makeWorld();
        initializeBallMeshes();
        physicsAccumulator = 0;
        uiStatsTimer = 0;
        setStats(getStats(world));
      }

      if (currentInputs.hitSignal !== lastHitSignal) {
        lastHitSignal = currentInputs.hitSignal;
        shootCueBall(
          world,
          currentInputs.force,
          currentInputs.angleDeg,
          currentInputs.cueContactY,
          currentInputs.cueContactX,
          currentInputs.cueElevationDeg,
        );
        setStats(getStats(world));
      }

      const frameDt = Math.min(delta, MAX_FRAME_DT);
      physicsAccumulator += frameDt;

      let substeps = 0;
      while (physicsAccumulator >= FIXED_DT && substeps < MAX_SUBSTEPS) {
        stepWorld(world, FIXED_DT);
        physicsAccumulator -= FIXED_DT;
        substeps += 1;
      }
      if (substeps === MAX_SUBSTEPS) physicsAccumulator = 0;

      ballVisuals.forEach(({ ballData, mesh }) => {
        mesh.visible = ballData.active;
        if (ballData.active) {
          mesh.position.set(
            ballData.position.x,
            ballData.position.y,
            ballData.position.z,
          );

          if (
            frameDt > 0 &&
            (ballData.velocity.x !== 0 || ballData.velocity.z !== 0)
          ) {
            mesh.rotation.x += ballData.omega.x * frameDt;
            mesh.rotation.y += ballData.omega.y * frameDt;
            mesh.rotation.z += ballData.omega.z * frameDt;
          }
        }
      });

      const currentStats = getStats(world);
      const cueBall = world.balls[0];
      const isMoving = ballVisuals.some(
        (v) =>
          v.ballData.active &&
          (v.ballData.velocity.x !== 0 || v.ballData.velocity.z !== 0),
      );

      if (cueBall && cueBall.active && currentStats.canShoot && !isMoving) {
        aimGuideGroup.visible = true;
        cueStickGroup.visible = true;

        const angle = THREE.MathUtils.degToRad(currentInputs.angleDeg);
        const length = 0.22 + (currentInputs.force / 50) * 0.48;
        const startOffset = BALL_RADIUS + 0.04;
        const guideY = BALL_Y + 0.005;

        aimGuideGroup.position.set(
          cueBall.position.x,
          guideY,
          cueBall.position.z,
        );
        aimGuideGroup.rotation.set(0, -angle, 0);
        guideCylinder.scale.set(1, length, 1);
        guideCylinder.position.set(startOffset + length / 2, 0, 0);
        guideCone.position.set(startOffset + length + 0.035, 0, 0);

        const pullBack = 0.12 + (currentInputs.force / 50) * 0.26;
        cueStickGroup.position.set(
          cueBall.position.x,
          guideY,
          cueBall.position.z,
        );
        cueStickGroup.rotation.set(0, -angle, 0);
        stickMesh.position.set(-pullBack - cueLength / 2, 0, 0);
        tipMesh.position.set(-pullBack - 0.025, 0, 0);
      } else {
        aimGuideGroup.visible = false;
        cueStickGroup.visible = false;
      }

      uiStatsTimer += frameDt;
      if (uiStatsTimer >= 0.12) {
        uiStatsTimer = 0;
        setStats(currentStats);
      }

      // --- تطبيق نظام الإحداثيات القطبية لتحديث موقع الكاميرا لحظياً حول المركز (0,0,0) ---
      const { angle: camAngle, distance: camDist } = cameraParams.current;
      const camX = Math.sin(camAngle) * camDist;
      const camZ = Math.cos(camAngle) * camDist;

      camera.position.set(camX, 2.3, camZ); // ارتفاع 2.3 متر ممتاز لرؤية كامل الطاولة والكرات
      camera.lookAt(0, 0, 0); // تركيز عدسة النظر بشكل دائم نحو المركز الأساسي للطاولة
      // ----------------------------------------------------------------------------------

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      ballGeometry.dispose();
      legGeometry.dispose();
      legMaterial.dispose();
      railMaterial.dispose();
      pocketGeometry.dispose();
      pocketMaterial.dispose();
      baseMesh.geometry.dispose();
      baseMesh.material.dispose();
      clothMesh.geometry.dispose();
      clothMesh.material.dispose();
      guideCylinder.geometry.dispose();
      guideCylinder.material.dispose();
      guideCone.geometry.dispose();
      stickMesh.geometry.dispose();
      stickMesh.material.dispose();
      tipMesh.geometry.dispose();
      renderer.dispose();
    };
  }, []);

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
      <Scoreboard stats={stats} />
      <div className="layout">
        <section
          className="canvas-card"
          aria-label="مشهد البلياردو ثلاثي الأبعاد"
          ref={containerRef}
        ></section>

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
              <div
                key={idx}
                className="control-group"
                style={{ marginBottom: "15px" }}
              >
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
              <button
                type="button"
                disabled={!stats.canShoot}
                onClick={() => setHitSignal((v) => v + 1)}
              >
                اضرب الكرة
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setResetSignal((v) => v + 1)}
              >
                إعادة ضبط
              </button>
            </div>
          </section>

          {/* إعدادات الفيزياء الرقمية */}
          <section className="panel-section">
            <h2>إعدادات الفيزياء</h2>
            {Object.entries(PHYSICS_CONFIG_METADATA).map(([key, meta]) => (
              <div
                key={key}
                className="control-group"
                style={{ marginBottom: "15px" }}
              >
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
                  onBlur={(e) =>
                    setPhysicsParameter(null, key, parseFloat(e.target.value))
                  }
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
      </div>
    </main>
  );
}
