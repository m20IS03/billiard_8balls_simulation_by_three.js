//Pocket.js
import * as THREE from "three";
import { POCKETS, POCKET_RADIUS } from "./Constants";

export function tryPocketBall(world, ball) {
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
export function pocketBall(world, ball) {
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
export function handleBallJumpedOffTable(world, ball) {
  ball.active = false;

  // أ. إذا كانت الكرة الخارجة هي البيضاء (Scratch)
  if (ball.id === 0) {
    world.scratches += 1;
    world.statusMessage = `خطأ! طارت الكرة البيضاء خارج حدود الطاولة. نقل الدور للاعب ${world.currentPlayer === 1 ? 2 : 1}`;
    world.currentPlayer = world.currentPlayer === 1 ? 2 : 1;
    return;
  }

  // ب. إذا كانت الكرة الخارجة هي السوداء)
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

  //. تصنيف الكرات العادية
  const group = ball.id < 8 ? "solids" : "stripes";

  if (group === "solids") world.solidsRemaining = Math.max(0, world.solidsRemaining - 1);
  if (group === "stripes") world.stripesRemaining = Math.max(0, world.stripesRemaining - 1);
  world.pocketed += 1;

  //  تحديد المجموعات لأول مرة إذا كانت الطاولة مفتوحة
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
