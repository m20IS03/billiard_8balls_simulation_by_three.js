//PhysicsEngine.js
import * as THREE from "three";
import { makeBall, updateMotionState, isBallMoving } from "./Ball";
import { areAnyBallsMoving, getSpeedXZ } from "../utils/Helpers";
import { applySideSpinCurve, applySlidingFriction, applyRollingFriction } from "./Friction.js";
import {
  G,
  BALL_Y,
  BALL_RADIUS,
  BALL_RESTITUTION,
  BALL_INERTIA,
  TABLE_HEIGHT,
  TABLE_WIDTH,
  TABLE_DEPTH,
  TABLE_PLANE_ACCELERATION,
  CUE_START,
  RACK_START_X,
  OBJECT_BALL_COLORS,
} from "./Constants.js";
import { tryPocketBall, pocketBall, handleBallJumpedOffTable } from "./Pocket.js";
import { handleTableWalls, resolveBallCollisions } from "./Collision.js";

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
      const isOverTable = Math.abs(ball.position.x) <= TABLE_WIDTH / 2 && Math.abs(ball.position.z) <= TABLE_DEPTH / 2;

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
      const isOverTable = Math.abs(ball.position.x) <= TABLE_WIDTH / 2 && Math.abs(ball.position.z) <= TABLE_DEPTH / 2;

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
export function shootCueBall(world, forceInNewtons, angleDeg, cueContactY = 0, cueContactX = 0, cueElevationDeg = 0) {
  const cue = world.balls[0];

  if (!cue || !cue.active || areAnyBallsMoving(world.balls)) {
    return false;
  }

  const impulseTime = 0.05;
  const acceleration = forceInNewtons / cue.mass;
  const shotSpeed = acceleration * impulseTime;

  const clampedContactY = THREE.MathUtils.clamp(cueContactY, -0.7, 0.7);
  const clampedContactX = THREE.MathUtils.clamp(cueContactX, -0.7, 0.7);

  const alpha = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(cueElevationDeg, 0, 85));
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
      candidates.push(new THREE.Vector3(CUE_START.x - xIndex * spacing, BALL_Y, CUE_START.z + zIndex * spacing));
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
