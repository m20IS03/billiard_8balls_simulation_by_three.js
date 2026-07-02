//Helpers.js
import * as THREE from "three";
import { getSlipVelocityXZ } from "../physics/Ball.js";
import { BALL_Y, STOP_SPEED } from "../physics/Constants";
export function getSpeedXZ(ball) {
  return Math.hypot(ball.velocity.x, ball.velocity.z);
}

export function getSlipSpeed(ball) {
  const slip = getSlipVelocityXZ(ball);
  return Math.hypot(slip.x, slip.z);
}
export function isBallAirborne(ball) {
  return ball.isAirborne || ball.position.y > BALL_Y + 0.0005;
}
export function areAnyBallsMoving(balls) {
  return balls.some((ball) => {
    if (!ball.active) return false;

    const speed = getSpeedXZ(ball);
    const vertical = Math.abs(ball.velocity.y);

    return speed > STOP_SPEED || vertical > STOP_SPEED || ball.isAirborne || ball.position.y > BALL_Y + 0.0005;
  });
}
