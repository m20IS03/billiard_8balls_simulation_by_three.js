import {
  BALL_RADIUS,
  BALL_Y,
  FIXED_DT,
  G,
  MU_R,
  TABLE_WIDTH,
  WALL_RESTITUTION,
  makeWorld,
  isBallMoving,
  stepWorld,
} from "../src/physics.js";

let passed = 0;
let failed = 0;

function approxEqual(actual, expected, tolerance, label) {
  const difference = Math.abs(actual - expected);
  const ok = difference <= tolerance;

  if (!ok) {
    console.log(
      `  ${label}: expected ${expected.toFixed(4)}, got ${actual.toFixed(4)}, diff ${difference.toFixed(4)}`
    );
  }

  return ok;
}

function assertTrue(condition, label) {
  if (!condition) {
    console.log(`  ${label}`);
  }

  return condition;
}

function stepMany(world, seconds) {
  const steps = Math.ceil(seconds / FIXED_DT);

  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, FIXED_DT);
  }

  return steps * FIXED_DT;
}

function report(label, ok) {
  if (ok) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.log(`FAIL ${label}`);
  }
}

function resetBall(ball, x = 0, z = 0) {
  ball.active = true;
  ball.position.set(x, BALL_Y, z);
  ball.velocity.set(0, 0, 0);
  ball.omega.set(0, 0, 0);
  ball.motionState = "stopped";
  ball.isAirborne = false;
}

function useOnlyBalls(world, activeIndexes) {
  world.balls.forEach((ball, index) => {
    ball.active = activeIndexes.includes(index);
    if (!ball.active) {
      ball.velocity.set(0, 0, 0);
      ball.omega.set(0, 0, 0);
      ball.isAirborne = false;
      ball.motionState = "stopped";
    }
  });
}

function checkRollingFrictionStopTime() {
  const world = makeWorld();
  const cue = world.balls[0];
  const initialSpeed = 2;
  const expectedStopTime = initialSpeed / (MU_R * G);

  useOnlyBalls(world, [0]);
  resetBall(cue);
  cue.velocity.set(initialSpeed, 0, 0);
  cue.omega.set(0, 0, -initialSpeed / BALL_RADIUS);
  cue.motionState = "rolling";

  let elapsed = 0;
  const maxTime = expectedStopTime + 2;

  while (isBallMoving(cue) && elapsed < maxTime) {
    stepWorld(world, FIXED_DT);

    // Keep this check focused on cloth rolling friction, away from rails and pockets.
    cue.position.set(0, BALL_Y, 0);
    elapsed += FIXED_DT;
  }

  const ok =
    assertTrue(!isBallMoving(cue), "ball should stop under rolling friction") &&
    approxEqual(elapsed, expectedStopTime, 0.35, "rolling friction stop time");

  report("rolling friction stop time", ok);
}

function checkRailRebound() {
  const world = makeWorld();
  const cue = world.balls[0];
  const speedBefore = 1;

  useOnlyBalls(world, [0]);
  resetBall(cue, -TABLE_WIDTH / 2 + BALL_RADIUS - 0.001, 0);
  cue.velocity.set(-speedBefore, 0, 0);
  cue.motionState = "sliding";

  stepWorld(world, 0);

  const expectedSpeed = WALL_RESTITUTION * speedBefore;
  const ok =
    assertTrue(cue.velocity.x > 0, "ball should rebound away from the rail") &&
    approxEqual(Math.abs(cue.velocity.x), expectedSpeed, 0.03, "rail rebound speed");

  report("rail rebound", ok);
}

function checkBallBallNormalImpulse() {
  const world = makeWorld();
  const ballA = world.balls[0];
  const ballB = world.balls[1];

  useOnlyBalls(world, [0, 1]);
  resetBall(ballA, 0, 0);
  resetBall(ballB, BALL_RADIUS * 2 * 0.98, 0);
  ballA.velocity.set(1, 0, 0);
  ballB.velocity.set(0, 0, 0);
  ballA.motionState = "sliding";
  ballB.motionState = "stopped";

  const momentumBefore =
    ballA.mass * ballA.velocity.x + ballB.mass * ballB.velocity.x;

  stepWorld(world, 0);

  const momentumAfter =
    ballA.mass * ballA.velocity.x + ballB.mass * ballB.velocity.x;

  const ok =
    assertTrue(ballB.velocity.x > 0.5, "second ball should gain forward velocity") &&
    assertTrue(ballA.velocity.x < 0.2, "first ball should slow strongly") &&
    approxEqual(momentumAfter, momentumBefore, 0.02, "x momentum during normal impulse");

  report("ball-ball normal impulse", ok);
}

function checkJumpProjectileMotion() {
  const world = makeWorld();
  const cue = world.balls[0];
  const initialVerticalSpeed = 1.5;
  const expectedMaxY = BALL_Y + (initialVerticalSpeed * initialVerticalSpeed) / (2 * G);

  useOnlyBalls(world, [0]);
  resetBall(cue);
  cue.velocity.set(0, initialVerticalSpeed, 0);
  cue.isAirborne = true;
  cue.motionState = "sliding";

  let maxY = cue.position.y;
  let previousY = cue.position.y;
  let rose = false;
  let fell = false;
  let touchedTableAfterFlight = false;
  let elapsed = 0;

  while (!touchedTableAfterFlight && elapsed < 5) {
    stepWorld(world, FIXED_DT);

    if (cue.position.y > previousY + 0.00001) {
      rose = true;
    }

    if (rose && cue.position.y < previousY - 0.00001) {
      fell = true;
    }

    if (fell && cue.position.y === BALL_Y) {
      touchedTableAfterFlight = true;
    }

    maxY = Math.max(maxY, cue.position.y);
    previousY = cue.position.y;
    elapsed += FIXED_DT;
  }

  const ok =
    assertTrue(rose, "jumping ball should rise first") &&
    assertTrue(fell, "jumping ball should fall after rising") &&
    assertTrue(touchedTableAfterFlight, "jumping ball should return to BALL_Y") &&
    approxEqual(maxY, expectedMaxY, 0.03, "projectile maximum height");

  report("jump projectile motion", ok);
}

function simulateSideSpinDisplacement(omegaY) {
  const world = makeWorld();
  const cue = world.balls[0];
  const initialSpeed = 1.2;

  useOnlyBalls(world, [0]);
  resetBall(cue);
  cue.velocity.set(initialSpeed, 0, 0);
  cue.omega.set(0, omegaY, -initialSpeed / BALL_RADIUS);
  cue.motionState = "rolling";

  stepMany(world, 1.0);

  return cue.position.z;
}

function checkSideSpinPathCurvature() {
  const noSpinZ = simulateSideSpinDisplacement(0);
  const positiveSpinZ = simulateSideSpinDisplacement(120);
  const negativeSpinZ = simulateSideSpinDisplacement(-120);

  const ok =
    assertTrue(
      Math.abs(positiveSpinZ) > Math.abs(noSpinZ) + 0.01,
      "positive sidespin should create more lateral displacement than no sidespin"
    ) &&
    assertTrue(
      Math.abs(negativeSpinZ) > Math.abs(noSpinZ) + 0.01,
      "negative sidespin should create more lateral displacement than no sidespin"
    ) &&
    assertTrue(
      positiveSpinZ * negativeSpinZ < 0,
      "positive and negative sidespin should curve in opposite directions"
    );

  report("sidespin path curvature", ok);
}

checkRollingFrictionStopTime();
checkRailRebound();
checkBallBallNormalImpulse();
checkJumpProjectileMotion();
checkSideSpinPathCurvature();

console.log(`Physics checks: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}
