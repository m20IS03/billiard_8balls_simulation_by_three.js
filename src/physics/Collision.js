//Collision.js
import * as THREE from "three";
import { updateMotionState } from "./Ball";
import { BALL_RADIUS, BALL_INERTIA, BALL_Y, BALL_RESTITUTION, WALL_RESTITUTION, WALL_TANGENTIAL_FRICTION, TABLE_WIDTH, TABLE_DEPTH, RAIL_TOP_Y } from "./Constants";
import { getSpeedXZ, getSlipSpeed } from "../utils/Helpers";
import { clamp } from "../utils/MathUtils";


export function getContactVelocity(ball, rx, rz) {
  return {
    x: ball.velocity.x + ball.omega.y * rz,
    y: ball.velocity.y + ball.omega.z * rx - ball.omega.x * rz,
    z: ball.velocity.z - ball.omega.y * rx,
  };
}

export function resolveRailCollision(world, ball, normalX, normalZ) {
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

  const slop = 0.0;
  const percent = 1.0;

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

      if (relNormal >= 0) {
        if (!use3D) {
          updateMotionState(a);
          updateMotionState(b);
        }
        continue;
      }

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

      // 💡  وحساب الاندفاع المماسي
      const rawTangentImpulse = -vRelT / tangentialDenominator;

      // تطبيق قانون كولوم الحقيقي للاحتكاك الديناميكي (حصر القوة المماسية بناءً على قوة الاندفاع العمودي)
      const MU_BALLS = 0.12; // معامل الاحتكاك الطبيعي لأسطح كرات البلياردو
      const maxFriction = MU_BALLS * impulseMagnitude;
      const tangentImpulse = Math.max(-maxFriction, Math.min(maxFriction, rawTangentImpulse));

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
