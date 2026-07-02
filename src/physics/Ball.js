//Ball.js
import * as THREE from "three";
import { STOP_SPEED, SLIP_SPEED_EPSILON, BALL_RADIUS, BALL_Y, BALL_MASS } from "./Constants";
import { getSpeedXZ, getSlipSpeed } from "../utils/Helpers.js";
export function makeBall({ id, label, color, x, z }) {
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
export function stopBall(ball) {
  ball.velocity.set(0, 0, 0);
  ball.omega.set(0, 0, 0);
  ball.position.y = BALL_Y;
  ball.motionState = "stopped";
  ball.isAirborne = false;
}
export function setPureRollingOmega(ball) {
  const existingSideSpin = ball.omega.y;
  ball.omega.x = ball.velocity.z / BALL_RADIUS;
  ball.omega.z = -ball.velocity.x / BALL_RADIUS;
  ball.omega.y = existingSideSpin;
}
export function getSlipVelocityXZ(ball) {
  return {
    x: ball.velocity.x + BALL_RADIUS * ball.omega.z,
    z: ball.velocity.z - BALL_RADIUS * ball.omega.x,
  };
}
export function isBallMoving(ball) {
  if (!ball.active) return false;

  const speedXZ = getSpeedXZ(ball);
  const verticalSpeed = Math.abs(ball.velocity.y);

  return speedXZ > STOP_SPEED || verticalSpeed > STOP_SPEED || ball.isAirborne === true || ball.position.y > BALL_Y + 0.0005;
}
export function updateMotionState(ball) {
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
