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
} from "./physics.js";

// مكون لوحة النتائج (Scoreboard) الأصلي متطابق تماماً
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
  // المرجع الخاص بحاوية الرسم ثلاثي الأبعاد
  const containerRef = useRef(null);

  // حالات التحكم بالواجهة الرسومية عبر React
  const [power, setPower] = useState(55);
  const [angleDeg, setAngleDeg] = useState(0);
  const [cueContactY, setCueContactY] = useState(0);
  const [cueContactX, setCueContactX] = useState(0);
  const [cueElevationDeg, setCueElevationDeg] = useState(0);
  const [hitSignal, setHitSignal] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [stats, setStats] = useState(() => getStats(makeWorld()));

  // مرجع لحفظ أحدث قيم المدخلات لتجنب الاستدعاءات المغلقة القديمة (Stale Closures) داخل حلقة الـ Animation
  const inputsRef = useRef({
    power,
    angleDeg,
    cueContactY,
    cueContactX,
    cueElevationDeg,
    hitSignal,
    resetSignal,
  });

  useEffect(() => {
    inputsRef.current = {
      power,
      angleDeg,
      cueContactY,
      cueContactX,
      cueElevationDeg,
      hitSignal,
      resetSignal,
    };
  }, [
    power,
    angleDeg,
    cueContactY,
    cueContactX,
    cueElevationDeg,
    hitSignal,
    resetSignal,
  ]);

  useEffect(() => {
    if (!containerRef.current) return;

    // أبعاد لوحة الرسم الافتراضية
    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 550;

    // 1. إعداد المشهد والكاميرا والمصيّر (Scene, Camera, Renderer)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#07111f");

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 40);
    camera.position.set(0, 2.5, 2.05);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // 👇 السطر السحري المضاف هنا لحل مشكلة تجمّد الرسوم تماماً 👇
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    containerRef.current.appendChild(renderer.domElement);
    // 2. منظومة الإضاءة والظلال الكاملة المطابقة للأصل
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

    // 3. بناء مجسمات طاولة البلياردو (Table Geometry & Materials)
    const tableGroup = new THREE.Group();
    const railThickness = 0.1;
    const railHeight = 0.075;
    const railY = TABLE_HEIGHT / 2 + railHeight / 2;
    const legX = TABLE_WIDTH / 2 - 0.15;
    const legZ = TABLE_DEPTH / 2 - 0.15;
    const legHeight = 0.75;
    const legY = -0.065 - legHeight / 2;

    // قاعدة الطاولة الخشبية
    const baseMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH + 0.32, 0.13, TABLE_DEPTH + 0.32),
      new THREE.MeshStandardMaterial({ color: "#5b341e", roughness: 0.72 }),
    );
    baseMesh.position.set(0, -0.065, 0);
    baseMesh.receiveShadow = true;
    tableGroup.add(baseMesh);

    // الأرجل الأربعة
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

    // سطح اللباد الأخضر المقاوم للأشعة وعنصر التوجيه بالماوس
    const clothMesh = new THREE.Mesh(
      new THREE.BoxGeometry(TABLE_WIDTH, TABLE_HEIGHT, TABLE_DEPTH),
      new THREE.MeshStandardMaterial({ color: "#0f7a43", roughness: 0.92 }),
    );
    clothMesh.receiveShadow = true;
    tableGroup.add(clothMesh);

    // الباندات / الحواف الجانبية للطاولة
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

    // ==========================================
    // تعديل الجيوب الستة لتبدو ثلاثية الأبعاد وواقعية
    // ==========================================

    const pocketDepth = 0.06; // عمق الجيب لأسفل (6 سنتيمترات)

    // 1. مجسم فجوة الجيب (جعل الجزء السفلي أضيق قليلاً ليعطي إيحاء بالعمق المخروطي)
    const pocketGeometry = new THREE.CylinderGeometry(
      POCKET_RADIUS, // نصف القطر العلوي
      POCKET_RADIUS * 0.85, // نصف القطر السفلي (أصغر قليلاً للواقعية)
      pocketDepth, // الارتفاع (العمق الفعلي)
      32, // النعومة دائرية
    );

    // مادة الجيب: أسود داكن جداً يمتص الضوء
    const pocketMaterial = new THREE.MeshStandardMaterial({
      color: "#05070f", // أسود قريب من الفراغ
      roughness: 0.9, // خشن جداً لامتصاص الضوء والظلال
      metalness: 0.1,
    });

    // 2. مجسم إطار الجيب الواقي (The Rim) - حلقة جلدية تحيط بكل جيب
    const rimGeometry = new THREE.RingGeometry(
      POCKET_RADIUS, // نصف القطر الداخلي (يبدأ من حافة الجيب)
      POCKET_RADIUS + 0.018, // نصف القطر الخارجي (يمتد فوق اللباد)
      32, // النعومة
    );

    // مادة الإطار: مادة تشبه الجلد أو البلاستيك المقوى اللامع قليلاً
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: "#1e293b", // لون رمادي داكن/جلد أسود
      roughness: 0.4, // بريق خفيف يعكس الإضاءة العلوية بشكل واقعي
      metalness: 0.2,
      side: THREE.DoubleSide, // الرسم من الجهتين لمنع اختفائه عند زوايا الكاميرا
    });

    // رسم ووضع الجيوب والإطارات في المشهد
    POCKETS.forEach((pocket) => {
      // --- أ: إنشاء فجوة الجيب العمودية ---
      const pMesh = new THREE.Mesh(pocketGeometry, pocketMaterial);

      // إنزال الجيب لأسفل: (TABLE_HEIGHT / 2) هو السطح، نطرح منه نصف العمق لتسقط الأسطوانة لأسفل
      pMesh.position.set(
        pocket.x,
        TABLE_HEIGHT / 2 - pocketDepth / 2,
        pocket.z,
      );

      // تفعيل استقبال الظلال لكي تظهر ظلال حواف الطاولة والكرات بداخل الجيب
      pMesh.receiveShadow = true;
      tableGroup.add(pMesh);

      // --- ب: إنشاء إطار الجيب (الحافة الجلدية) ---
      const rimMesh = new THREE.Mesh(rimGeometry, rimMaterial);

      // نضع الحلقة فوق سطح الطاولة بـ 1 مليمتر فقط لتجنب تداخل الأسطح بصرياً (Z-fighting)
      rimMesh.position.set(pocket.x, TABLE_HEIGHT / 2 + 0.001, pocket.z);

      // تدوير الحلقة لتصبح أفقية موازية لسطح الطاولة
      rimMesh.rotation.x = -Math.PI / 2;

      // تجعل الحافة تسقط ظلالاً خفيفة على اللباد لمزيد من الواقعية
      rimMesh.castShadow = true;
      tableGroup.add(rimMesh);
    });
    scene.add(tableGroup);

    // 4. بناء خط التصويب المساعد (AimGuide) والعصا (CueStick) كمجسمات منفصلة ديناميكية
    const aimGuideGroup = new THREE.Group();
    const guideCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0055, 0.0055, 1, 18), // طول افتراضي 1 يتم عمل scale له لاحقاً لحفظ الأداء
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

    // 5. إدارة وتهيئة الكرات ثلاثية الأبعاد وربطها بالمحرك الفيزيائي المستورد
    let world = makeWorld();
    const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
    const ballVisuals = [];

    const initializeBallMeshes = () => {
      ballVisuals.forEach((v) => scene.remove(v.mesh));
      ballVisuals.length = 0;

      world.balls.forEach((ball) => {
        const ballMat = new THREE.MeshStandardMaterial({
          color: ball.color || "#ffffff",
          roughness: 0.15,
          metalness: 0.05,
        });
        const mesh = new THREE.Mesh(ballGeometry, ballMat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        ballVisuals.push({ id: ball.id, ballData: ball, mesh: mesh });
      });
    };

    initializeBallMeshes();

    // 6. تتبع حركة الماوس واللمس لتغيير الزاوية ديناميكياً (Raycasting)
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
      if (e.buttons === 1) handlePointerAim(e); // التوجيه بالسحب المباشر
    });

    // 7. الحلقة الأساسية للمحاكاة والرسم (Animation & Physics Step Loop)
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

      // أ) معالجة إشارة إعادة الضبط
      if (currentInputs.resetSignal !== lastResetSignal) {
        lastResetSignal = currentInputs.resetSignal;
        world = makeWorld();
        initializeBallMeshes();
        physicsAccumulator = 0;
        uiStatsTimer = 0;
        setStats(getStats(world));
      }

      // ب) معالجة إشارة ضربة الكرة البيضاء
      if (currentInputs.hitSignal !== lastHitSignal) {
        lastHitSignal = currentInputs.hitSignal;
        shootCueBall(
          world,
          currentInputs.power,
          currentInputs.angleDeg,
          currentInputs.cueContactY,
          currentInputs.cueContactX,
          currentInputs.cueElevationDeg,
        );
        setStats(getStats(world));
      }

      // ج) الحسابات الفيزيائية الدقيقة بخطوات ثابتة (Substepping) المطابقة تماماً للمحرك الأصلي
      const frameDt = Math.min(delta, MAX_FRAME_DT);
      physicsAccumulator += frameDt;

      let substeps = 0;
      while (physicsAccumulator >= FIXED_DT && substeps < MAX_SUBSTEPS) {
        stepWorld(world, FIXED_DT);
        physicsAccumulator -= FIXED_DT;
        substeps += 1;
      }
      if (substeps === MAX_SUBSTEPS) physicsAccumulator = 0;

      // د) تحديث مواقع ومصفوفات دوران الكرات هندسياً على الشاشة
      ballVisuals.forEach(({ ballData, mesh }) => {
        mesh.visible = ballData.active;
        if (ballData.active) {
          mesh.position.set(
            ballData.position.x,
            ballData.position.y,
            ballData.position.z,
          );

          // حساب زاوية الدحرجة والالتفاف البصري للكرة بناءً على متجه السرعة الزاوية (omega) من الفيزياء
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

      // هـ) تحديث مؤشرات خط التوجيه وعصا البلياردو بصرياً
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
        const length = 0.22 + (currentInputs.power / 100) * 0.48;
        const startOffset = BALL_RADIUS + 0.04;
        const guideY = BALL_Y + 0.005;

        // مطابقة موضع خط الهدف وزاويته وحجمه
        aimGuideGroup.position.set(
          cueBall.position.x,
          guideY,
          cueBall.position.z,
        );
        aimGuideGroup.rotation.set(0, -angle, 0);
        guideCylinder.scale.set(1, length, 1);
        guideCylinder.position.set(startOffset + length / 2, 0, 0);
        guideCone.position.set(startOffset + length + 0.035, 0, 0);

        // محاكاة عملية سحب العصا للخلف بحسب قوة الضربة
        const pullBack = 0.12 + (currentInputs.power / 100) * 0.26;
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

      // و) إرسال الإحصائيات الدورية لتحديث واجهة مستخدم React
      uiStatsTimer += frameDt;
      if (uiStatsTimer >= 0.12) {
        uiStatsTimer = 0;
        setStats(currentStats);
      }

      // تحديث الكاميرا والرسم الفعلي
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    animate();

    // دالة مرنة لمعالجة التغير التلقائي في حجم نافذة المتصفح لعدم تشويه الأبعاد الرسومية
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 8. تنظيف الذاكرة وإلغاء المراجع (Cleanup Strategy) عند تدمير المكون لمنع تضخم الـ VRAM
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }

      // التخلص التلقائي من الـ Geometries والـ Materials لحماية كارت الشاشة
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
        {/* حاوية الرسم ثلاثي الأبعاد البديلة لـ Canvas الخاص بـ Fiber */}
        <section
          className="canvas-card"
          aria-label="مشهد البلياردو ثلاثي الأبعاد"
          ref={containerRef}
        ></section>

        <aside className="side-panel">
          <section className="panel-section">
            <p className="eyebrow">Pure Three.js + فيزياء يدوية</p>
            <h1>محاكاة بلياردو 3D</h1>
            <p className="description">
              العرض ثلاثي الأبعاد يتم عبر مكتبة Three.js الصرفة مباشرةً وبشكل
              متزامن، أما الحركة والتصادمات والاحتكاك فهي محسوبة برمجياً ومكتوبة
              يدويًا لضمان أعلى أداء ممكن.
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
                onChange={(e) => setPower(Number(e.target.value))}
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
                onChange={(e) => setAngleDeg(Number(e.target.value))}
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
                onChange={(e) => setCueContactY(Number(e.target.value))}
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
                onChange={(e) => setCueContactX(Number(e.target.value))}
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
                onChange={(e) => setCueElevationDeg(Number(e.target.value))}
              />
            </label>

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

            <p className="hint">
              يمكن تغيير الزاوية من الشريط أو بتحريك المؤشر والنقر المباشر فوق
              سطح الطاولة عندما تكون الكرات متوقفة.
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
        </aside>
      </div>
    </main>
  );
}
