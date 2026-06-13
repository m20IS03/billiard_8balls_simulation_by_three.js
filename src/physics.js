import * as THREE from "three";

// Core table and ball constants use SI-style units: meters, kilograms, seconds.
export const TABLE_WIDTH = 2.84;
export const TABLE_DEPTH = 1.42;
export const TABLE_HEIGHT = 0.025;

export const RAIL_TOP_Y = TABLE_HEIGHT / 2 + 0.075; // الارتفاع الأقصى للحافة الجانبية
export const BALL_RADIUS = 0.0286;
export const BALL_Y = TABLE_HEIGHT / 2 + BALL_RADIUS;
export const POCKET_RADIUS = 0.075;
// 1. توصيف المعطيات الفيزيائية: القيم الافتراضية والحدود المسموحة (Min / Max)
export const PHYSICS_CONFIG_METADATA = {
  G: { label: "الجاذبية العمودية", default: 9.81, min: 0, max: 25 }, // 0 تعني انعدام الجاذبية تماماً
  MU_S: { label: "معامل احتكاك الانزلاق", default: 0.2, min: 0, max: 1.0 }, // 0 تعني إهمال احتكاك الانزلاق
  MU_R: { label: "معامل احتكاك التدحرج", default: 0.015, min: 0, max: 0.1 }, // 0 تعني إهمال احتكاك التدحرج
  BALL_MASS: {
    label: "كتلة الكرة (كيلوجرام)",
    default: 0.17,
    min: 0.05,
    max: 0.6,
  },
  BALL_RESTITUTION: {
    label: "مرونة ارتداد الكرات البينية",
    default: 0.94,
    min: 0,
    max: 1.0,
  },
  WALL_RESTITUTION: {
    label: "مرونة ارتداد الحواف الجانبية",
    default: 0.78,
    min: 0,
    max: 1.0,
  },
  TABLE_RESTITUTION: {
    label: "مرونة ارتداد سطح الطاولة",
    default: 0.5,
    min: 0,
    max: 1.0,
  },
};

// 2. تعيين المتغيرات الحية القابلة للتحديث الحركي (باستخدام let بدلاً من const)
export let G = PHYSICS_CONFIG_METADATA.G.default;
export let MU_R = PHYSICS_CONFIG_METADATA.MU_R.default;
export let MU_S = PHYSICS_CONFIG_METADATA.MU_S.default;
export let BALL_MASS = PHYSICS_CONFIG_METADATA.BALL_MASS.default;
export let BALL_RESTITUTION = PHYSICS_CONFIG_METADATA.BALL_RESTITUTION.default;
export let WALL_RESTITUTION = PHYSICS_CONFIG_METADATA.WALL_RESTITUTION.default;
export let TABLE_RESTITUTION =
  PHYSICS_CONFIG_METADATA.TABLE_RESTITUTION.default;

// عزم القصور الذاتي للكرة (سيتحدث تلقائياً عند تغيير الكتلة)
export let BALL_INERTIA = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;

// Sidespin path curvature
export const SIDE_SPIN_CURVE_COEFFICIENT = 0.015;
export const SIDE_SPIN_EPSILON = 0.05;
export const MAX_SIDE_SPIN_ACCELERATION = 0.35;

export const BALL_TANGENTIAL_RESTITUTION = 0.0;
export const WALL_TANGENTIAL_FRICTION = 0.2;

export const STOP_SPEED = 0.012;
export const SLIP_SPEED_EPSILON = 0.002;
export const FIXED_DT = 1 / 120;
export const MAX_FRAME_DT = 1 / 30;
export const MAX_SUBSTEPS = 6;
export const MIN_JUMP_ANGLE_DEG = 0;
export const MAX_JUMP_ANGLE_DEG = 45;

export const CUE_MIN_SPEED = 0.25;
export const CUE_MAX_SPEED = 4.5;
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

export function setPhysicsParameter(world, key, value) {
  if (!PHYSICS_CONFIG_METADATA[key]) return null;

  const meta = PHYSICS_CONFIG_METADATA[key];
  const clampedValue = Math.max(meta.min, Math.min(meta.max, value));

  switch (key) {
    case "G":
      G = clampedValue;
      break;
    case "MU_R":
      MU_R = clampedValue;
      break;
    case "MU_S":
      MU_S = clampedValue;
      break;
    case "BALL_RESTITUTION":
      BALL_RESTITUTION = clampedValue;
      break;
    case "WALL_RESTITUTION":
      WALL_RESTITUTION = clampedValue;
      break;
    case "TABLE_RESTITUTION":
      TABLE_RESTITUTION = clampedValue;
      break;
    case "BALL_MASS":
      BALL_MASS = clampedValue;
      BALL_INERTIA = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;

      if (world && world.balls) {
        world.balls.forEach((ball) => {
          ball.mass = BALL_MASS;
        });
      }
      break;
  }

  return clampedValue;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBall({ id, label, color, x, z }) {
  return {
    id,
    label,
    color,
    mesh: null,
    position: new THREE.Vector3(x, BALL_Y, z),
    velocity: new THREE.Vector3(0, 0, 0),
    omega: new THREE.Vector3(0, 0, 0),
    radius: BALL_RADIUS,
    mass: BALL_MASS,
    active: true,
    isCue: id === 0,
    motionState: "stopped",
    isAirborne: false,
    isFalling: false,
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
    balls: makeInitialBalls(),
    collisions: 0,
    pocketed: 0,
    scratches: 0,
    currentPlayer: 1,
    playerGroups: { 1: null, 2: null },
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
    canShoot: Boolean(cue && cue.active && moving === 0 && !world.winner),
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

export function shootCueBall(
  world,
  forceInNewtons,
  angleDeg,
  cueContactY = 0,
  cueContactX = 0,
  cueElevationDeg = 0,
) {
  const cue = world.balls[0];

  if (!cue || !cue.active || areAnyBallsMoving(world.balls)) {
    return false;
  }

  const impulseTime = 0.05;
  const acceleration = forceInNewtons / cue.mass;
  const shotSpeed = acceleration * impulseTime;

  const clampedContactY = THREE.MathUtils.clamp(cueContactY, -0.7, 0.7);
  const clampedContactX = THREE.MathUtils.clamp(cueContactX, -0.7, 0.7);

  const alpha = THREE.MathUtils.degToRad(
    THREE.MathUtils.clamp(cueElevationDeg, 0, 85),
  );
  const angle = THREE.MathUtils.degToRad(angleDeg);

  const horizontalSpeed = shotSpeed * Math.cos(alpha);
  const vy = shotSpeed * Math.sin(alpha);
  const vx = Math.cos(angle) * horizontalSpeed;
  const vz = Math.sin(angle) * horizontalSpeed;

  cue.velocity.set(vx, vy, vz);

  const hitOffsetY = clampedContactY * BALL_RADIUS;
  const hitOffsetX = clampedContactX * BALL_RADIUS;
  const impulseX = cue.mass * vx;
  const impulseZ = cue.mass * vz;

  cue.omega.x = (hitOffsetY * impulseZ) / BALL_INERTIA;
  cue.omega.y = (hitOffsetX * cue.mass * shotSpeed) / BALL_INERTIA;
  cue.omega.z = (-hitOffsetY * impulseX) / BALL_INERTIA;

  if (cueElevationDeg > 0.1 && vy > 0.05) {
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

  const forceX = -MU_S * ball.mass * G * ux;
  const forceZ = -MU_S * ball.mass * G * uz;

  const ax = forceX / ball.mass;
  const az = forceZ / ball.mass;

  ball.velocity.x += ax * dt;
  ball.velocity.z += az * dt;

  const torqueX = -BALL_RADIUS * forceZ;
  const torqueZ = BALL_RADIUS * forceX;

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
  ball.motionState = "rolling";
  setPureRollingOmega(ball);
}

function applySideSpinCurve(ball, dt) {
  const speed = getSpeedXZ(ball);

  if (speed <= STOP_SPEED) return;
  if (Math.abs(ball.omega.y) <= SIDE_SPIN_EPSILON) return;
  if (isBallAirborne(ball)) return;

  const dirX = ball.velocity.x / speed;
  const dirZ = ball.velocity.z / speed;

  const sideX = -dirZ;
  const sideZ = dirX;

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

// دالة لمعالجة خروج الكرات خارج حدود الطاولة بالكامل وتطبيق القوانين العالمية
function handleBallJumpedOffTable(world, ball) {
  ball.active = false;

  // أ. إذا كانت الكرة الخارجة هي البيضاء (Scratch)
  if (ball.id === 0) {
    world.scratches += 1;
    world.statusMessage = `خطأ! طارت الكرة البيضاء خارج حدود الطاولة. نقل الدور للاعب ${world.currentPlayer === 1 ? 2 : 1}`;
    world.currentPlayer = world.currentPlayer === 1 ? 2 : 1;
    return;
  }

  // ب. إذا كانت الكرة الخارجة هي السوداء (رقم 8)
  if (ball.id === 8) {
    const pGroup = world.playerGroups[world.currentPlayer];
    if (!pGroup) {
      world.winner = world.currentPlayer === 1 ? 2 : 1;
      world.statusMessage = `خسارة! طارت الكرة 8 خارج الطاولة والطاولة مفتوحة. الفائز هو اللاعب ${world.winner}`;
    } else {
      const rem = pGroup === "solids" ? world.solidsRemaining : world.stripesRemaining;
      if (rem === 0) {
        world.winner = world.currentPlayer;
        world.statusMessage = `🎉 فوز قانوني! اللاعب ${world.currentPlayer} أخرج الكرة 8 بعد إنهاء مجموعته وفاز باللقاء!`;
      } else {
        world.winner = world.currentPlayer === 1 ? 2 : 1;
        world.statusMessage = `خسارة خطأ! طارت الكرة 8 خارج الطاولة قبل إنهاء بقية كرات مجموعتك. الفائز هو اللاعب ${world.winner}`;
      }
    }
    return;
  }

  // ج. تصنيف الكرات العادية
  const group = ball.id < 8 ? "solids" : "stripes";

  if (group === "solids") world.solidsRemaining = Math.max(0, world.solidsRemaining - 1);
  if (group === "stripes") world.stripesRemaining = Math.max(0, world.stripesRemaining - 1);
  world.pocketed += 1;

  // د. تحديد المجموعات لأول مرة إذا كانت الطاولة مفتوحة
  if (!world.playerGroups[1] && !world.playerGroups[2]) {
    const active = world.currentPlayer;
    const opponent = active === 1 ? 2 : 1;

    world.playerGroups[active] = group;
    world.playerGroups[opponent] = group === "solids" ? "stripes" : "solids";

    world.statusMessage = `طارت كرة ${group === "solids" ? "سادة" : "مخططة"} خارج الطاولة! تم تحديد المجموعات بقوة الأمر الواقع.`;
  } else {
    world.statusMessage = `طارت كرة ${group === "solids" ? "سادة" : "مخططة"} خارج الطاولة وتم استبعادها!`;
  }
}

function pocketBall(world, ball) {
  ball.active = false;
  world.pocketed += 1;

  if (ball.id === 0) {
    world.scratches += 1;
    world.statusMessage = `خطأ (Scratch)! سقطت الكرة البيضاء. نقل الدور للاعب ${world.currentPlayer === 1 ? 2 : 1}`;
    world.currentPlayer = world.currentPlayer === 1 ? 2 : 1;
    return;
  }

  if (ball.id === 8) {
    const pGroup = world.playerGroups[world.currentPlayer];
    if (!pGroup) {
      world.winner = world.currentPlayer === 1 ? 2 : 1;
      world.statusMessage = `خسارة! تم إسقاط الكرة 8 قبل تحديد المجموعات. الفائز هو اللاعب ${world.winner}`;
    } else {
      const rem = pGroup === "solids" ? world.solidsRemaining : world.stripesRemaining;
      if (rem === 0) {
        world.winner = world.currentPlayer;
        world.statusMessage = `🎉 فوز قانوني! اللاعب ${world.currentPlayer} أسقط الكرة 8 وفاز بالمباراة!`;
      } else {
        world.winner = world.currentPlayer === 1 ? 2 : 1;
        world.statusMessage = `خسارة خطأ! سقطت الكرة 8 قبل إنهاء بقية كرات مجموعتك. الفائز هو اللاعب ${world.winner}`;
      }
    }
    return;
  }

  const group = ball.id < 8 ? "solids" : "stripes";

  if (group === "solids") world.solidsRemaining = Math.max(0, world.solidsRemaining - 1);
  if (group === "stripes") world.stripesRemaining = Math.max(0, world.stripesRemaining - 1);

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
  if (!ball.active || ball.isFalling) return false;

  for (const pocket of POCKETS) {
    const dx = ball.position.x - pocket.x;
    const dz = ball.position.z - pocket.z;
    const distance = Math.hypot(dx, dz);

    if (distance <= POCKET_RADIUS * 0.85) {
      ball.isFalling = true;
      ball.motionState = "sliding";
      ball.velocity.x = (pocket.x - ball.position.x) * 2;
      ball.velocity.z = (pocket.z - ball.position.z) * 2;
      return true;
    }
  }

  return false;
}

function resolveRailCollision(world, ball, normalX, normalZ) {
  const vn = ball.velocity.x * normalX + ball.velocity.z * normalZ;

  if (vn >= -0.05) return;

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

  const tangentDenominator = invMass + (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA;
  let tangentImpulse = -vContactT / tangentDenominator;
  const maxTangentImpulse = WALL_TANGENTIAL_FRICTION * Math.abs(normalImpulse);

  tangentImpulse = clamp(tangentImpulse, -maxTangentImpulse, maxTangentImpulse);

  ball.velocity.x += tangentImpulse * invMass * tangentX;
  ball.velocity.z += tangentImpulse * invMass * tangentZ;

  const impulseX = tangentImpulse * tangentX;
  const impulseZ = tangentImpulse * tangentZ;
  const deltaOmegaY = (contactZ * impulseX - contactX * impulseZ) / BALL_INERTIA;

  ball.omega.y += deltaOmegaY;
  updateMotionState(ball);
}

export function handleTableWalls(world, ball) {
  const limitX = TABLE_WIDTH / 2 - BALL_RADIUS;
  const limitZ = TABLE_DEPTH / 2 - BALL_RADIUS;

  // جدار اليسار
  if (ball.position.x < -limitX) {
    if (ball.position.y > RAIL_TOP_Y && ball.velocity.x < 0) {
      // الكرة أعلى من الحافة وتتجه للخارج -> تعبر الحافة وتخرج خارج الطاولة
    } else {
      ball.position.x = -limitX;
      resolveRailCollision(world, ball, 1, 0);
    }
  }
  // جدار اليمين
  if (ball.position.x > limitX) {
    if (ball.position.y > RAIL_TOP_Y && ball.velocity.x > 0) {
      // تعبر الحافة وتخرج خارج الطاولة
    } else {
      ball.position.x = limitX;
      resolveRailCollision(world, ball, -1, 0);
    }
  }
  // جدار الأعلى
  if (ball.position.z < -limitZ) {
    if (ball.position.y > RAIL_TOP_Y && ball.velocity.z < 0) {
      // تعبر الحافة وتخرج خارج الطاولة
    } else {
      ball.position.z = -limitZ;
      resolveRailCollision(world, ball, 0, 1);
    }
  }
  // جدار الأسفل
  if (ball.position.z > limitZ) {
    if (ball.position.y > RAIL_TOP_Y && ball.velocity.z > 0) {
      // تعبر الحافة وتخرج خارج الطاولة
    } else {
      ball.position.z = limitZ;
      resolveRailCollision(world, ball, 0, -1);
    }
  }
}

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
        const relativeSpeedSq = use3D ? rvx * rvx + rvy * rvy + rvz * rvz : rvx * rvx + rvz * rvz;

        if (relativeSpeedSq > 1e-12) {
          const relativeSpeed = Math.sqrt(relativeSpeedSq);
          dx = rvx / relativeSpeed;
          dy = use3D ? rvy / relativeSpeed : 0;
          dz = rvz / relativeSpeed;
        } else {
          dx = 1; dy = 0; dz = 0;
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

      const penetration = minDistance - distance;
      if (penetration > 0) {
        const correctionMagnitude = (Math.max(penetration - slop, 0) / invMassSum) * percent;
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

      if (relNormal >= 0) continue;

      if (relNormal < -0.05) {
        world.collisions += 1;
      }

      const impulseMagnitude = (-(1 + BALL_RESTITUTION) * relNormal) / invMassSum;

      a.velocity.x -= nx * impulseMagnitude * invMassA;
      a.velocity.y -= ny * impulseMagnitude * invMassA;
      a.velocity.z -= nz * impulseMagnitude * invMassA;
      b.velocity.x += nx * impulseMagnitude * invMassB;
      b.velocity.y += ny * impulseMagnitude * invMassB;
      b.velocity.z += nz * impulseMagnitude * invMassB;

      if (use3D) {
        for (const ball of [a, b]) {
          if (ball.position.y > BALL_Y + 0.0005 || Math.abs(ball.velocity.y) > 0.01) {
            ball.isAirborne = true;
            ball.motionState = "sliding";
          } else {
            ball.position.y = BALL_Y;
            ball.velocity.y = 0;
            ball.isAirborne = false;
            updateMotionState(ball);
          }
        }
        continue;
      }

      a.velocity.y = 0;
      b.velocity.y = 0;

      const tx = -nz;
      const tz = nx;
      const rxA = BALL_RADIUS * nx;
      const rzA = BALL_RADIUS * nz;
      const rxB = -BALL_RADIUS * nx;
      const rzB = -BALL_RADIUS * nz;

      const contactA = getContactVelocity(a, rxA, rzA);
      const contactB = getContactVelocity(b, rxB, rzB);
      const vRelT = (contactB.x - contactA.x) * tx + (contactB.z - contactA.z) * tz;

      const tangentialDenominator = invMassA + invMassB + (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA + (BALL_RADIUS * BALL_RADIUS) / BALL_INERTIA;
      const TANGENTIAL_RESTITUTION = 0.15;
      const tangentImpulse = (-(1 + TANGENTIAL_RESTITUTION) * vRelT) / tangentialDenominator;

      a.velocity.x -= tx * tangentImpulse * invMassA;
      a.velocity.z -= tz * tangentImpulse * invMassA;
      b.velocity.x += tx * tangentImpulse * invMassB;
      b.velocity.z += tz * tangentImpulse * invMassB;

      if (a.omega && b.omega) {
        const deltaOmegaY = (BALL_RADIUS * tangentImpulse) / BALL_INERTIA;
        a.omega.y += deltaOmegaY;
        b.omega.y += deltaOmegaY;
      }

      updateMotionState(a);
      updateMotionState(b);
    }
  }
}

function isSpotAvailable(balls, candidate) {
  const limitX = TABLE_WIDTH / 2 - BALL_RADIUS;
  const limitZ = TABLE_DEPTH / 2 - BALL_RADIUS;

  if (candidate.x < -limitX || candidate.x > limitX || candidate.z < -limitZ || candidate.z > limitZ) {
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

  const safeSpot = candidates.find((candidate) => isSpotAvailable(world.balls, candidate)) || CUE_START.clone();

  cue.position.copy(safeSpot);
  cue.position.y = BALL_Y;
  cue.velocity.set(0, 0, 0);
  cue.omega.set(0, 0, 0);
  cue.isAirborne = false;
  cue.motionState = "stopped";
  cue.active = true;
}

export function stepWorld(world, dt) {
  for (const ball of world.balls) {
    if (!ball.active) continue;

    // 1. معالجة حركة السقوط التدريجي داخل الجيب
    if (ball.isFalling) {
      ball.velocity.y -= G * dt;
      ball.position.y += ball.velocity.y * dt;
      ball.velocity.x *= 0.9;
      ball.velocity.z *= 0.9;
      ball.position.x += ball.velocity.x * dt;
      ball.position.z += ball.velocity.z * dt;

      if (ball.position.y < TABLE_HEIGHT / 2 - ball.radius) {
        pocketBall(world, ball);
        ball.isFalling = false;
      }
      continue;
    }

    // 2. حسابات حركة القفز الرأسية (Y) والجاذبية الأصلية
    if (ball.isAirborne) {
      ball.velocity.y -= G * dt;
      ball.position.y += ball.velocity.y * dt;

      // رصد هل الكرة فوق الطاولة أم خارج الطاولة تماماً
      const isOverTable =
        Math.abs(ball.position.x) <= TABLE_WIDTH / 2 &&
        Math.abs(ball.position.z) <= TABLE_DEPTH / 2;

      if (isOverTable) {
        if (ball.position.y <= BALL_Y) {
          ball.position.y = BALL_Y;

          if (ball.velocity.y < -0.5) {
            ball.velocity.y = -ball.velocity.y * BALL_RESTITUTION;
          } else {
            ball.velocity.y = 0;
            ball.isAirborne = false;
          }
        }
      } else {
        // الكرة خارج حدود الطاولة! تستمر في السقوط الحر لأسفل نحو الأرضية
        if (ball.position.y < -0.4) {
          handleBallJumpedOffTable(world, ball);
          continue;
        }
      }
    } else {
      // حماية إضافية في حال تخطت الكرة الحدود دون تفعيل airborne
      const isOverTable =
        Math.abs(ball.position.x) <= TABLE_WIDTH / 2 &&
        Math.abs(ball.position.z) <= TABLE_DEPTH / 2;

      if (!isOverTable) {
        handleBallJumpedOffTable(world, ball);
        continue;
      }

      ball.velocity.y = 0;
      ball.position.y = BALL_Y;
    }

    // 3. تحديث حالات الاحتكاك والدوران (عند التلامس مع السطح فقط)
    if (!ball.isAirborne) {
      updateMotionState(ball);

      if (ball.motionState === "sliding") {
        applySlidingFriction(ball, dt);
      } else if (ball.motionState === "rolling") {
        applyRollingFriction(ball, dt);
      }
    }

    applySideSpinCurve(ball, dt);

    if (typeof TABLE_PLANE_ACCELERATION !== "undefined") {
      ball.velocity.x += TABLE_PLANE_ACCELERATION.x * dt;
      ball.velocity.z += TABLE_PLANE_ACCELERATION.z * dt;
    }

    // 4. تحديث الموقع الأفقي (X, Z)
    ball.position.x += ball.velocity.x * dt;
    ball.position.z += ball.velocity.z * dt;

    // 5. فحص الجدران والحواف
    handleTableWalls(world, ball);

    // فحص الجيوب
    if (ball.position.y <= BALL_Y + 0.01) {
      if (tryPocketBall(world, ball)) continue;
    }
  }

  resolveBallCollisions(world);

  // حلقة تأكيد نهائية لمنع الاختراقات المفاجئة
  for (const ball of world.balls) {
    if (!ball.active) continue;
    handleTableWalls(world, ball);
  }

  respotCueBallIfNeeded(world);

  // طبقة أمان نهائية احتياطية للكرة البيضاء
  const cueBall = world.balls.find((b) => b.isCue);
  if (cueBall && cueBall.active) {
    const safetyMargin = 0.4;
    const limitX = TABLE_WIDTH / 2 + safetyMargin;
    const limitZ = TABLE_DEPTH / 2 + safetyMargin;

    if (Math.abs(cueBall.position.x) > limitX || Math.abs(cueBall.position.z) > limitZ) {
      cueBall.position.set(0, BALL_Y, 0);
      cueBall.velocity.set(0, 0, 0);
      if (cueBall.omega) cueBall.omega.set(0, 0, 0);
      cueBall.isAirborne = false;
    }
  }
}
