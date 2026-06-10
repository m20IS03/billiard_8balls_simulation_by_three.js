import * as THREE from "three";

// Core table and ball constants use SI-style units: meters, kilograms, seconds.
export const TABLE_WIDTH = 2.84;
export const TABLE_DEPTH = 1.42;
export const TABLE_HEIGHT = 0.025;

export const RAIL_TOP_Y = TABLE_HEIGHT / 2 + 0.075; // الارتفاع الأقصى للحافة الجانبية
export const BALL_RADIUS = 0.0286;
export const BALL_Y = TABLE_HEIGHT / 2 + BALL_RADIUS;
export const POCKET_RADIUS = 0.075;

// Friction, mass, and restitution constants.
// K = 1/2 m v^2, and I = 2/5 mR^2 for a solid sphere.
export const G = 9.81;
export const MU_R = 0.015;
export const MU_S = 0.2;
// Sidespin path curvature:
// A small educational side force is applied while the ball moves on the cloth.
// This matches the study statement that side friction can slightly change direction.
// This is not air resistance.
export const SIDE_SPIN_CURVE_COEFFICIENT = 0.015;
export const SIDE_SPIN_EPSILON = 0.05;
export const MAX_SIDE_SPIN_ACCELERATION = 0.35;
export const BALL_MASS = 0.17;
export const BALL_INERTIA = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;
export const BALL_RESTITUTION = 0.94;
// Tangential restitution for spin contact during ball-ball collision.
// 0 means tangential slip is reduced without bouncing tangentially.
export const BALL_TANGENTIAL_RESTITUTION = 0.0;
export const WALL_RESTITUTION = 0.78;
// Simple cushion friction used only to transfer sidespin during rail collision.
export const WALL_TANGENTIAL_FRICTION = 0.2;
export const TABLE_RESTITUTION = 0.5;

export const STOP_SPEED = 0.012;
export const SLIP_SPEED_EPSILON = 0.002;
export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 1 / 30;
export const MAX_SUBSTEPS = 6;
export const MIN_JUMP_ANGLE_DEG = 0;
export const MAX_JUMP_ANGLE_DEG = 45;

export const CUE_MIN_SPEED = 0.25;
export const CUE_MAX_SPEED = 2.9;
export const CUE_START = new THREE.Vector3(-0.88, BALL_Y, 0);
export const RACK_START_X = 0.43;

export const POCKETS = [
  new THREE.Vector3(-TABLE_WIDTH / 2, BALL_Y, -TABLE_DEPTH / 2),
  new THREE.Vector3(0, BALL_Y, -TABLE_DEPTH / 2),
  new THREE.Vector3(TABLE_WIDTH / 2, BALL_Y, -TABLE_DEPTH / 2),
  new THREE.Vector3(-TABLE_WIDTH / 2, BALL_Y, TABLE_DEPTH / 2),
  new THREE.Vector3(0, BALL_Y, TABLE_DEPTH / 2),
  new THREE.Vector3(TABLE_WIDTH / 2, BALL_Y, TABLE_DEPTH / 2),
];

const OBJECT_BALL_COLORS = [
  "#facc15",
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#16a34a",
  "#9333ea",
  "#111827",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#6366f1",
  "#14b8a6",
  "#a855f7",
  "#eab308",
];

const TABLE_PLANE_ACCELERATION = new THREE.Vector3(0, 0, 0);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBall({ id, label, color, x, z }) {
  return {
    id,
    label,
    color,
    mesh: null,
    // Ball physics state follows the study notation:
    // r = position, v = velocity, omega = angular velocity.
    position: new THREE.Vector3(x, BALL_Y, z),
    velocity: new THREE.Vector3(0, 0, 0),
    omega: new THREE.Vector3(0, 0, 0),
    radius: BALL_RADIUS,
    mass: BALL_MASS,
    active: true,
    isCue: id === 0,
    motionState: "stopped",
    isAirborne: false,
  };
}

export function makeInitialBalls() {
  const balls = [
    makeBall({
      id: 0,
      label: "cue",
      color: "#f8fafc",
      x: CUE_START.x,
      z: CUE_START.z,
    }),
  ];

  const rowGap = BALL_RADIUS * 2.04;
  const colGap = BALL_RADIUS * 2.13;
  let id = 1;

  for (let row = 0; row < 5; row += 1) {
    for (let col = 0; col <= row; col += 1) {
      balls.push(
        makeBall({
          id,
          label: `ball-${id}`,
          color: OBJECT_BALL_COLORS[(id - 1) % OBJECT_BALL_COLORS.length],
          x: RACK_START_X + row * rowGap,
          z: (col - row / 2) * colGap,
        }),
      );
      id += 1;
    }
  }

  return balls;
}
export function makeWorld() {
  return {
    balls: makeInitialBalls(), // الدالة الأصلية التي تنشئ المصفوفة
    collisions: 0,
    pocketed: 0,
    scratches: 0,
    // --- البيانات الجديدة للعبة الثمان كرات ---
    currentPlayer: 1,
    playerGroups: { 1: null, 2: null }, // 'solids' (سادة) أو 'stripes' (مخطط)
    solidsRemaining: 7,
    stripesRemaining: 7,
    winner: null,
    statusMessage: "طاولة مفتوحة - اضرب أي كرة لتحديد مجموعتك",
  };
}

export function isBallMoving(ball) {
  if (!ball.active) return false;

  const speedXZ = getSpeedXZ(ball);
  const verticalSpeed = Math.abs(ball.velocity.y);

  return (
    speedXZ > STOP_SPEED ||
    verticalSpeed > STOP_SPEED ||
    ball.isAirborne === true ||
    ball.position.y > BALL_Y + 0.0005
  );
}

export function areAnyBallsMoving(balls) {
  return balls.some(isBallMoving);
}
export function getStats(world) {
  const cue = world.balls[0];
  const moving = world.balls.filter(isBallMoving).length;

  return {
    cueSpeed: cue && cue.active ? getSpeedXZ(cue).toFixed(2) : "0.00",
    moving,
    collisions: world.collisions,
    pocketed: world.pocketed,
    scratches: world.scratches,
    canShoot: Boolean(cue && cue.active && moving === 0 && !world.winner), // تعطيل اللعب عند وجود فائز
    // --- تمرير البيانات الجديدة إلى المكونات المرئية ---
    currentPlayer: world.currentPlayer,
    playerGroups: world.playerGroups,
    solidsRemaining: world.solidsRemaining,
    stripesRemaining: world.stripesRemaining,
    statusMessage: world.statusMessage,
    winner: world.winner,
  };
}
function getSpeedXZ(ball) {
  return Math.hypot(ball.velocity.x, ball.velocity.z);
}

function isBallAirborne(ball) {
  return ball.isAirborne || ball.position.y > BALL_Y + 0.0005;
}

function getSlipVelocityXZ(ball) {
  return {
    x: ball.velocity.x + BALL_RADIUS * ball.omega.z,
    z: ball.velocity.z - BALL_RADIUS * ball.omega.x,
  };
}

function getSlipSpeed(ball) {
  const slip = getSlipVelocityXZ(ball);
  return Math.hypot(slip.x, slip.z);
}

function getContactVelocity(ball, rx, rz) {
  // Contact point velocity: v_contact = v + omega x r.
  // Here r = (rx, 0, rz), so side spin omega.y changes x/z contact speed.
  return {
    x: ball.velocity.x + ball.omega.y * rz,
    y: ball.velocity.y + ball.omega.z * rx - ball.omega.x * rz,
    z: ball.velocity.z - ball.omega.y * rx,
  };
}

function setPureRollingOmega(ball) {
  const existingSideSpin = ball.omega.y;
  ball.omega.x = ball.velocity.z / BALL_RADIUS;
  ball.omega.z = -ball.velocity.x / BALL_RADIUS;
  ball.omega.y = existingSideSpin;
}

function stopBall(ball) {
  ball.velocity.set(0, 0, 0);
  ball.omega.set(0, 0, 0);
  ball.position.y = BALL_Y;
  ball.motionState = "stopped";
  ball.isAirborne = false;
}

function updateMotionState(ball) {
  const speed = getSpeedXZ(ball);
  const slipSpeed = getSlipSpeed(ball);

  if (speed <= STOP_SPEED && slipSpeed <= STOP_SPEED) {
    stopBall(ball);
    return;
  }

  if (slipSpeed > SLIP_SPEED_EPSILON) {
    ball.motionState = "sliding";
  } else {
    ball.motionState = "rolling";
    setPureRollingOmega(ball);
  }
}

// Shot Jump landing is centralized so airborne state stays consistent.
// A ball cannot go below the table, and cloth friction resumes after landing.
function landBallOnTable(ball) {
  ball.position.y = BALL_Y;

  if (Math.abs(ball.velocity.y) > STOP_SPEED) {
    ball.velocity.y = -TABLE_RESTITUTION * ball.velocity.y;
  } else {
    ball.velocity.y = 0;
  }

  if (Math.abs(ball.velocity.y) <= STOP_SPEED) {
    ball.velocity.y = 0;
    ball.isAirborne = false;
    updateMotionState(ball);
  } else {
    ball.isAirborne = true;
  }
}

// Cue shot impulse and angular impulse.
// Off-center contact creates omega0 = (r x J) / I.
// Shot Jump uses projectile launch components:
// vx = v0 cos(alpha) cos(theta)
// vz = v0 cos(alpha) sin(theta)
// vy = v0 sin(alpha)
export function shootCueBall(
  world,
  power,
  angleDeg,
  cueContactY = 0,
  cueContactX = 0,
  cueElevationDeg = 0,
) {
  const cue = world.balls[0];

  if (!cue || !cue.active || areAnyBallsMoving(world.balls)) {
    return false;
  }

  const normalizedPower = THREE.MathUtils.clamp(power, 0, 100) / 100;
  const clampedContactY = THREE.MathUtils.clamp(cueContactY, -0.7, 0.7);
  const clampedContactX = THREE.MathUtils.clamp(cueContactX, -0.7, 0.7);

  // التأكد من عمل السقف الحسابي لزاوية القفز بشكل مرن (من 0 إلى 85 درجة مثلاً)
  // لتجنب أي تصفير ناتج عن قيم MIN_JUMP_ANGLE_DEG القديمة
  const minAngle =
    typeof MIN_JUMP_ANGLE_DEG !== "undefined" ? MIN_JUMP_ANGLE_DEG : 0;
  const maxAngle =
    typeof MAX_JUMP_ANGLE_DEG !== "undefined" ? MAX_JUMP_ANGLE_DEG : 85;
  const clampedElevationDeg = THREE.MathUtils.clamp(
    cueElevationDeg,
    minAngle,
    maxAngle,
  );

  const shotSpeed =
    CUE_MIN_SPEED + normalizedPower * (CUE_MAX_SPEED - CUE_MIN_SPEED);
  const angle = THREE.MathUtils.degToRad(angleDeg);
  const alpha = THREE.MathUtils.degToRad(clampedElevationDeg);

  // الحسابات المثلثية للمقذوفات ثلاثية الأبعاد
  const horizontalSpeed = shotSpeed * Math.cos(alpha);
  const vy = shotSpeed * Math.sin(alpha);
  const vx = Math.cos(angle) * horizontalSpeed;
  const vz = Math.sin(angle) * horizontalSpeed;

  cue.velocity.set(vx, vy, vz);

  const hitOffsetY = clampedContactY * BALL_RADIUS;
  const hitOffsetX = clampedContactX * BALL_RADIUS;
  const impulseX = cue.mass * vx;
  const impulseZ = cue.mass * vz;

  // الحسابات الدورانية لعزم ضربة العصا
  cue.omega.x = (hitOffsetY * impulseZ) / BALL_INERTIA;
  cue.omega.y = (hitOffsetX * cue.mass * shotSpeed) / BALL_INERTIA;
  cue.omega.z = (-hitOffsetY * impulseX) / BALL_INERTIA;

  // تفعيل حالة الطيران إذا كانت زاوية الرفع الفعلية أكبر من الصفر وبسرعة رأسية حقيقية
  if (clampedElevationDeg > 0.1 && vy > 0.05) {
    cue.isAirborne = true;
    cue.motionState = "sliding";
  } else {
    cue.isAirborne = false;
    cue.velocity.y = 0;
    cue.position.y = BALL_Y;
    updateMotionState(cue);
  }

  return true;
}

// Sliding friction opposes contact slip u = v + omega x r.
// The same friction changes linear velocity and creates torque on the ball.
function applySlidingFriction(ball, dt) {
  const slipBefore = getSlipVelocityXZ(ball);
  const slipSpeedBefore = Math.hypot(slipBefore.x, slipBefore.z);

  if (slipSpeedBefore <= SLIP_SPEED_EPSILON) {
    ball.motionState = "rolling";
    setPureRollingOmega(ball);
    return;
  }

  const ux = slipBefore.x / slipSpeedBefore;
  const uz = slipBefore.z / slipSpeedBefore;

  // Friction force is opposite to the slip velocity: F = -mu_s * m * g * u_hat.
  const forceX = -MU_S * ball.mass * G * ux;
  const forceZ = -MU_S * ball.mass * G * uz;

  // Linear acceleration follows Newton's second law: a = F / m.
  const ax = forceX / ball.mass;
  const az = forceZ / ball.mass;

  ball.velocity.x += ax * dt;
  ball.velocity.z += az * dt;
  ball.velocity.y = 0;

  // Torque from friction: tau = r x F, where the contact radius is r = (0, -R, 0).
  const torqueX = -BALL_RADIUS * forceZ;
  const torqueZ = BALL_RADIUS * forceX;

  // Angular acceleration is alpha = tau / I for the solid sphere.
  ball.omega.x += (torqueX / BALL_INERTIA) * dt;
  ball.omega.z += (torqueZ / BALL_INERTIA) * dt;

  const slipAfter = getSlipVelocityXZ(ball);
  const slipSpeedAfter = Math.hypot(slipAfter.x, slipAfter.z);
  const dotSlip = slipBefore.x * slipAfter.x + slipBefore.z * slipAfter.z;

  if (slipSpeedAfter <= SLIP_SPEED_EPSILON || dotSlip <= 0) {
    ball.motionState = "rolling";
    setPureRollingOmega(ball);
  }
}

// Rolling friction reduces speed while preserving the pure rolling relation.
// omega.x = vz / R, omega.z = -vx / R.
function applyRollingFriction(ball, dt) {
  const speed = getSpeedXZ(ball);

  if (speed <= STOP_SPEED) {
    stopBall(ball);
    return;
  }

  const speedAfterFriction = Math.max(0, speed - MU_R * G * dt);

  if (speedAfterFriction <= STOP_SPEED) {
    stopBall(ball);
    return;
  }

  const scale = speedAfterFriction / speed;
  ball.velocity.x *= scale;
  ball.velocity.z *= scale;
  ball.velocity.y = 0;
  ball.motionState = "rolling";
  setPureRollingOmega(ball);
}

function applySideSpinCurve(ball, dt) {
  const speed = getSpeedXZ(ball);

  if (speed <= STOP_SPEED) return;
  if (Math.abs(ball.omega.y) <= SIDE_SPIN_EPSILON) return;
  if (isBallAirborne(ball)) return;

  // Unit velocity direction on the x/z plane.
  const dirX = ball.velocity.x / speed;
  const dirZ = ball.velocity.z / speed;

  // Perpendicular direction in the table plane.
  // The sign of omega.y decides left/right curvature.
  const sideX = -dirZ;
  const sideZ = dirX;

  // Small side acceleration from sidespin interacting with cloth:
  // a_side ~= C * R * omega_y * speed
  let sideAcceleration =
    SIDE_SPIN_CURVE_COEFFICIENT * BALL_RADIUS * ball.omega.y * speed;

  sideAcceleration = clamp(
    sideAcceleration,
    -MAX_SIDE_SPIN_ACCELERATION,
    MAX_SIDE_SPIN_ACCELERATION,
  );

  ball.velocity.x += sideX * sideAcceleration * dt;
  ball.velocity.z += sideZ * sideAcceleration * dt;
}

// Pocketing deactivates the ball; cue-ball pocketing is recorded as a scratch.
function pocketBall(world, ball) {
  ball.active = false;
  world.pocketed += 1;

  // أ. إذا كانت الكرة الساقطة هي البيضاء (Scratch)
  if (ball.id === 0) {
    world.scratches += 1;
    world.statusMessage = `خطأ (Scratch)! سقطت الكرة البيضاء. نقل الدور للاعب ${world.currentPlayer === 1 ? 2 : 1}`;
    world.currentPlayer = world.currentPlayer === 1 ? 2 : 1;
    return;
  }

  // ب. إذا كانت الكرة الساقطة هي السوداء (رقم 8)
  if (ball.id === 8) {
    const pGroup = world.playerGroups[world.currentPlayer];
    if (!pGroup) {
      // خسارة فورية إذا أُدخلت الكرة 8 والطاولة ما زالت مفتوحة
      world.winner = world.currentPlayer === 1 ? 2 : 1;
      world.statusMessage = `خسارة! تم إسقاط الكرة 8 قبل تحديد المجموعات. الفائز هو اللاعب ${world.winner}`;
    } else {
      const rem =
        pGroup === "solids" ? world.solidsRemaining : world.stripesRemaining;
      if (rem === 0) {
        world.winner = world.currentPlayer;
        world.statusMessage = `🎉 فوز قانوني! اللاعب ${world.currentPlayer} أسقط الكرة 8 وفاز بالمباراة!`;
      } else {
        // خسارة إذا سقطت الـ 8 وكرات اللاعب لا تزال على الطاولة
        world.winner = world.currentPlayer === 1 ? 2 : 1;
        world.statusMessage = `خسارة خطأ! سقطت الكرة 8 قبل إنهاء بقية كرات مجموعتك. الفائز هو اللاعب ${world.winner}`;
      }
    }
    return;
  }

  // ج. تصنيف الكرات العادية (يرجى التأكد من أن دالة المكونات تضع ball.group بناءً على رقمها)
  // كرات السادة (1-7) والكرات المخططة (9-15)
  const group = ball.id < 8 ? "solids" : "stripes";

  if (group === "solids")
    world.solidsRemaining = Math.max(0, world.solidsRemaining - 1);
  if (group === "stripes")
    world.stripesRemaining = Math.max(0, world.stripesRemaining - 1);

  // د. تحديد المجموعات لأول مرة (Open Table Rule)
  if (!world.playerGroups[1] && !world.playerGroups[2]) {
    const active = world.currentPlayer;
    const opponent = active === 1 ? 2 : 1;

    world.playerGroups[active] = group;
    world.playerGroups[opponent] = group === "solids" ? "stripes" : "solids";

    world.statusMessage = `تم تحديد المجموعات! اللاعب 1: ${world.playerGroups[1] === "solids" ? "سادة" : "مخطط"} | اللاعب 2: ${world.playerGroups[2] === "solids" ? "سادة" : "مخطط"}`;
  } else {
    world.statusMessage = `تم إسقاط كرة ${group === "solids" ? "سادة" : "مخططة"} بنجاح!`;
  }
}

function tryPocketBall(world, ball) {
  if (!ball.active) return false;

  for (const pocket of POCKETS) {
    const dx = ball.position.x - pocket.x;
    const dz = ball.position.z - pocket.z;
    const distance = Math.hypot(dx, dz);

    if (distance <= POCKET_RADIUS) {
      pocketBall(world, ball);
      return true;
    }
  }

  return false;
}

// Rail collision reflects normal velocity: vn' = -ew * vn.
// A limited tangential impulse gives a simple sidespin/cushion effect.
function resolveRailCollision(world, ball, normalX, normalZ) {
  const vn = ball.velocity.x * normalX + ball.velocity.z * normalZ;

  // شرط حازم: لا يحسب تصادم إذا كانت الكرة تبتعد (vn >= 0)
  // أو إذا كانت السرعة العمودية ضئيلة جداً (أقل من 0.05 م/ث) وهي حالة الاحتكاك والالتصاق بالحافة
  if (vn >= -0.05) return;

  // زيادة العداد فقط عند الارتداد الفعلي الواضح
  world.collisions += 1;

  const invMass = 1 / ball.mass;
  const normalImpulse = -(1 + WALL_RESTITUTION) * vn * ball.mass;

  ball.velocity.x += normalImpulse * invMass * normalX;
  ball.velocity.z += normalImpulse * invMass * normalZ;

  const tangentX = -normalZ;
  const tangentZ = normalX;

  const contactX = -BALL_RADIUS * normalX;
  const contactZ = -BALL_RADIUS * normalZ;
  const contactVelocity = getContactVelocity(ball, contactX, contactZ);
  const vContactT = contactVelocity.x * tangentX + contactVelocity.z * tangentZ;

  const tangentDenominator =
    invMass + (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA;
  let tangentImpulse = -vContactT / tangentDenominator;
  const maxTangentImpulse = WALL_TANGENTIAL_FRICTION * Math.abs(normalImpulse);

  tangentImpulse = clamp(tangentImpulse, -maxTangentImpulse, maxTangentImpulse);

  ball.velocity.x += tangentImpulse * invMass * tangentX;
  ball.velocity.z += tangentImpulse * invMass * tangentZ;

  const impulseX = tangentImpulse * tangentX;
  const impulseZ = tangentImpulse * tangentZ;
  const deltaOmegaY =
    (contactZ * impulseX - contactX * impulseZ) / BALL_INERTIA;

  ball.omega.y += deltaOmegaY;
  updateMotionState(ball);
}
export function handleTableWalls(world, ball) {
  const limitX = TABLE_WIDTH / 2 - BALL_RADIUS;
  const limitZ = TABLE_DEPTH / 2 - BALL_RADIUS;

  // جدار اليسار
  if (ball.position.x < -limitX) {
    ball.position.x = -limitX;
    resolveRailCollision(world, ball, 1, 0);
  }
  // جدار اليمين
  if (ball.position.x > limitX) {
    ball.position.x = limitX;
    resolveRailCollision(world, ball, -1, 0);
  }
  // جدار الأعلى
  if (ball.position.z < -limitZ) {
    ball.position.z = -limitZ;
    resolveRailCollision(world, ball, 0, 1);
  }
  // جدار الأسفل
  if (ball.position.z > limitZ) {
    ball.position.z = limitZ;
    resolveRailCollision(world, ball, 0, -1);
  }
}
// Ball-ball collision uses the normal impulse:
// Jn = -(1 + e)(vrel . n) / (1/ma + 1/mb)
// Tangential contact adds:
// Jt = -(1 + et)(vrel,t) / (1/ma + 1/mb + R^2/Ia + R^2/Ib)
// Airborne collisions use the same normal impulse in 3D.
export function resolveBallCollisions(world) {
  const balls = world.balls;
  const minDistance = BALL_RADIUS * 2;
  const minDistanceSq = minDistance * minDistance;
  const slop = 0.0002;
  const percent = 0.8;

  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];

      if (!a.active || !b.active) continue;

      let dx = b.position.x - a.position.x;
      let dy = b.position.y - a.position.y;
      let dz = b.position.z - a.position.z;

      const use3D = (a.isAirborne ?? false) || (b.isAirborne ?? false);
      let distance = use3D ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dz);
      let distanceSq = distance * distance;

      if (distanceSq > minDistanceSq) continue;

      if (distanceSq < 1e-12) {
        const rvx = b.velocity.x - a.velocity.x;
        const rvy = b.velocity.y - a.velocity.y;
        const rvz = b.velocity.z - a.velocity.z;
        const relativeSpeedSq = use3D
          ? rvx * rvx + rvy * rvy + rvz * rvz
          : rvx * rvx + rvz * rvz;

        if (relativeSpeedSq > 1e-12) {
          const relativeSpeed = Math.sqrt(relativeSpeedSq);
          dx = rvx / relativeSpeed;
          dy = use3D ? rvy / relativeSpeed : 0;
          dz = rvz / relativeSpeed;
        } else {
          dx = 1;
          dy = 0;
          dz = 0;
        }
        distance = 1;
        distanceSq = distance * distance;
      }

      const nx = dx / distance;
      const ny = use3D ? dy / distance : 0;
      const nz = dz / distance;
      const invMassA = 1 / a.mass;
      const invMassB = 1 / b.mass;
      const invMassSum = invMassA + invMassB;
      if (invMassSum <= 0) continue;

      // 1. تصحيح التداخل الهندسي (Position Resolution)
      const penetration = minDistance - distance;
      if (penetration > 0) {
        const correctionMagnitude =
          (Math.max(penetration - slop, 0) / invMassSum) * percent;
        a.position.x -= nx * correctionMagnitude * invMassA;
        b.position.x += nx * correctionMagnitude * invMassB;
        a.position.z -= nz * correctionMagnitude * invMassA;
        b.position.z += nz * correctionMagnitude * invMassB;

        if (use3D) {
          a.position.y -= ny * correctionMagnitude * invMassA;
          b.position.y += ny * correctionMagnitude * invMassB;
          a.position.y = Math.max(a.position.y, BALL_Y);
          b.position.y = Math.max(b.position.y, BALL_Y);
        }
      }

      const rvx = b.velocity.x - a.velocity.x;
      const rvy = b.velocity.y - a.velocity.y;
      const rvz = b.velocity.z - a.velocity.z;
      const relNormal = rvx * nx + rvy * ny + rvz * nz;

      // إذا كانت الكرات تبتعد بالفعل، تخطى الحسابات تجنباً للاهتزازات
      if (relNormal >= 0) continue;

      // [تعديل ذكي للعداد]: زيادة العداد فقط إذا كان التصادم قوياً (سرعة واضحة قبل التصادم)
      // أما إذا كان التلامس خفيفاً جداً (أكبر من -0.05) فلا نزيد العداد ولكن نترك الفيزياء تعالج الحركة لمنع التلاصق
      if (relNormal < -0.05) {
        world.collisions += 1;
      }

      // 2. حساب وتطبيق دافع الارتداد العمودي (Normal Impulse)
      const impulseMagnitude =
        (-(1 + BALL_RESTITUTION) * relNormal) / invMassSum;

      a.velocity.x -= nx * impulseMagnitude * invMassA;
      a.velocity.y -= ny * impulseMagnitude * invMassA;
      a.velocity.z -= nz * impulseMagnitude * invMassA;
      b.velocity.x += nx * impulseMagnitude * invMassB;
      b.velocity.y += ny * impulseMagnitude * invMassB;
      b.velocity.z += nz * impulseMagnitude * invMassB;

      if (use3D) {
        for (const ball of [a, b]) {
          if (
            ball.position.y > BALL_Y + 0.0005 ||
            Math.abs(ball.velocity.y) >
              (typeof STOP_SPEED !== "undefined" ? STOP_SPEED : 0.01)
          ) {
            ball.isAirborne = true;
            ball.motionState = "sliding";
          } else {
            ball.position.y = BALL_Y;
            ball.velocity.y = 0;
            ball.isAirborne = false;
            if (typeof updateMotionState === "function")
              updateMotionState(ball);
          }
        }
        continue;
      }

      a.velocity.y = 0;
      b.velocity.y = 0;

      // 3. معالجة الاحتكاك المماسي وعزم الدوران المغزلي (منع الدوران اللانهائي حول نقطة التماس)
      const tx = -nz;
      const tz = nx;
      const rxA = BALL_RADIUS * nx;
      const rzA = BALL_RADIUS * nz;
      const rxB = -BALL_RADIUS * nx;
      const rzB = -BALL_RADIUS * nz;

      if (typeof getContactVelocity === "function") {
        const contactA = getContactVelocity(a, rxA, rzA);
        const contactB = getContactVelocity(b, rxB, rzB);
        const vRelT =
          (contactB.x - contactA.x) * tx + (contactB.z - contactA.z) * tz;

        const tangentialDenominator =
          invMassA +
          invMassB +
          (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA +
          (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA;

        // تم رفع الارتداد المماسي هنا إلى 0.15 لمنع الكرات من التصرف كالتروس الميكانيكية وتفريق الأسطح
        const TANGENTIAL_RESTITUTION = 0.15;
        const tangentImpulse =
          (-(1 + TANGENTIAL_RESTITUTION) * vRelT) / tangentialDenominator;

        a.velocity.x -= tx * tangentImpulse * invMassA;
        a.velocity.z -= tz * tangentImpulse * invMassA;
        b.velocity.x += tx * tangentImpulse * invMassB;
        b.velocity.z += tz * tangentImpulse * invMassB;

        if (a.omega && b.omega) {
          const deltaOmegaY = (BALL_RADIUS * tangentImpulse) / BALL_INERTIA;
          a.omega.y += deltaOmegaY;
          b.omega.y += deltaOmegaY;
        }
      }

      if (typeof updateMotionState === "function") {
        updateMotionState(a);
        updateMotionState(b);
      }
    }
  }
}

function isSpotAvailable(balls, candidate) {
  const limitX = TABLE_WIDTH / 2 - BALL_RADIUS;
  const limitZ = TABLE_DEPTH / 2 - BALL_RADIUS;

  if (
    candidate.x < -limitX ||
    candidate.x > limitX ||
    candidate.z < -limitZ ||
    candidate.z > limitZ
  ) {
    return false;
  }

  return balls.every((ball) => {
    if (ball.id === 0 || !ball.active) return true;
    const dx = ball.position.x - candidate.x;
    const dz = ball.position.z - candidate.z;
    return Math.hypot(dx, dz) >= BALL_RADIUS * 2.35;
  });
}

function respotCueBallIfNeeded(world) {
  const cue = world.balls[0];
  if (!cue || cue.active) return;

  const otherBallsMoving = world.balls.some((ball) => {
    return ball.id !== 0 && isBallMoving(ball);
  });

  if (otherBallsMoving) return;

  const candidates = [];
  const spacing = BALL_RADIUS * 2.6;

  for (let xIndex = 0; xIndex < 6; xIndex += 1) {
    for (let zIndex = -3; zIndex <= 3; zIndex += 1) {
      candidates.push(
        new THREE.Vector3(
          CUE_START.x - xIndex * spacing,
          BALL_Y,
          CUE_START.z + zIndex * spacing,
        ),
      );
    }
  }

  const safeSpot =
    candidates.find((candidate) => isSpotAvailable(world.balls, candidate)) ||
    CUE_START.clone();

  cue.position.copy(safeSpot);
  cue.position.y = BALL_Y;
  cue.velocity.set(0, 0, 0);
  cue.omega.set(0, 0, 0);
  cue.isAirborne = false;
  cue.motionState = "stopped";
  cue.active = true;
}

// Fixed-step world update with semi-implicit Euler:
// v(t + dt) = v(t) + a dt
// r(t + dt) = r(t) + v(t + dt) dt
// Airborne balls use ay = -g and skip cloth, rails, and pocket checks.
export function stepWorld(world, dt) {
  for (const ball of world.balls) {
    if (!ball.active) continue;

    // 1. حسابات حركة القفز الرأسية (Y) والجاذبية
    if (ball.isAirborne) {
      // تطبيق الجاذبية لتقليل السرعة الرأسية تدريجياً
      ball.velocity.y -= G * dt;
      ball.position.y += ball.velocity.y * dt;

      // رصد لحظة الاصطدام بالأرض (الهبوط)
      if (ball.position.y <= BALL_Y) {
        ball.position.y = BALL_Y;

        // إذا كانت سرعة الهبوط قوية، ترتد الكرة لأعلى بنسبة معينة
        if (ball.velocity.y < -0.5) {
          ball.velocity.y = -ball.velocity.y * BALL_RESTITUTION;
        } else {
          ball.velocity.y = 0;
          ball.isAirborne = false; // استقرت تماماً على الأرض
        }
      }
    } else {
      // إذا كانت الكرة على الأرض أصلاً، نضمن تصفير السرعة والموقع الرأسي
      ball.velocity.y = 0;
      ball.position.y = BALL_Y;
    }

    // 2. تحديث حالات الاحتكاك والدوران المعتادة
    updateMotionState(ball);

    if (ball.motionState === "sliding") {
      applySlidingFriction(ball, dt);
    } else if (ball.motionState === "rolling") {
      applyRollingFriction(ball, dt);
    }

    applySideSpinCurve(ball, dt);

    // تطبيق عجلة الطاولة (إن وجدت)
    if (typeof TABLE_PLANE_ACCELERATION !== "undefined") {
      ball.velocity.x += TABLE_PLANE_ACCELERATION.x * dt;
      ball.velocity.z += TABLE_PLANE_ACCELERATION.z * dt;
    }

    // 3. تحديث الموقع الأفقي (X, Z) بناءً على السرعات الأفقية
    ball.position.x += ball.velocity.x * dt;
    ball.position.z += ball.velocity.z * dt;

    // 4. استدعاء فحص الجدران والحواف (يعمل دائماً لمنع الاختراق حتى في الهواء)
    handleTableWalls(world, ball);

    // فحص الجيوب (يحدث فقط إذا كانت الكرة قريبة من سطح الطاولة وليس طائرة عالياً في الهواء)
    if (ball.position.y <= BALL_Y + 0.01) {
      if (tryPocketBall(world, ball)) continue;
    }
  }

  // معالجة تصادم الكرات مع بعضها البعض
  resolveBallCollisions(world);

  // حلقة تأكيد نهائية لضمان عدم خروج أي كرة بعد حسابات التصادم
  for (const ball of world.balls) {
    if (!ball.active) continue;
    handleTableWalls(world, ball);
  }

  // إعادة ضبط الكرة البيضاء قانونياً إذا طارت خارج حدود الغرفة تماماً بالخطأ
  const cueBall = world.balls.find((b) => b.isCue);
  if (cueBall && cueBall.active) {
    const safetyMargin = 0.4;
    const limitX = TABLE_WIDTH / 2 + safetyMargin;
    const limitZ = TABLE_DEPTH / 2 + safetyMargin;

    if (
      Math.abs(cueBall.position.x) > limitX ||
      Math.abs(cueBall.position.z) > limitZ
    ) {
      cueBall.position.set(0, BALL_Y, 0);
      cueBall.velocity.set(0, 0, 0);
      if (cueBall.omega) cueBall.omega.set(0, 0, 0);
      cueBall.isAirborne = false;
    }
  }
}
