//Friction.js
import * as THREE from "three";
import { stopBall, setPureRollingOmega, getSlipVelocityXZ } from "./Ball";
import { STOP_SPEED, SLIP_SPEED_EPSILON, MU_R, MU_S, G, BALL_RADIUS, BALL_INERTIA, SIDE_SPIN_EPSILON, SIDE_SPIN_CURVE_COEFFICIENT, MAX_SIDE_SPIN_ACCELERATION } from "./Constants";
import { clamp } from "../utils/MathUtils";
import { getSpeedXZ, isBallAirborne } from "../utils/Helpers";

export function applyRollingFriction(ball, dt) {
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
export function applySlidingFriction(ball, dt) {
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
export function applySideSpinCurve(ball, dt) {
  const speed = getSpeedXZ(ball);

  if (speed <= STOP_SPEED) return;
  if (Math.abs(ball.omega.y) <= SIDE_SPIN_EPSILON) return;
  if (isBallAirborne(ball)) return;

  const dirX = ball.velocity.x / speed;
  const dirZ = ball.velocity.z / speed;

  const sideX = -dirZ;
  const sideZ = dirX;

  let sideAcceleration = SIDE_SPIN_CURVE_COEFFICIENT * BALL_RADIUS * ball.omega.y * speed;

  sideAcceleration = clamp(sideAcceleration, -MAX_SIDE_SPIN_ACCELERATION, MAX_SIDE_SPIN_ACCELERATION);

  ball.velocity.x += sideX * sideAcceleration * dt;
  ball.velocity.z += sideZ * sideAcceleration * dt;
}
