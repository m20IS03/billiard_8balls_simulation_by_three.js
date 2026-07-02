//Constants.js
import * as THREE from "three";


// Core table and ball constants use SI-style units: meters, kilograms, seconds.
export const TABLE_WIDTH = 2.84;
export const TABLE_DEPTH = 1.42;
export const TABLE_HEIGHT = 0.025;

export const RAIL_TOP_Y = TABLE_HEIGHT / 2 + 0.075; // الحافة الجانبية
export const BALL_RADIUS = 0.0286;
export const BALL_Y = TABLE_HEIGHT / 2 + BALL_RADIUS;
export const POCKET_RADIUS = 0.075;
// 1.  المعطيات الفيزيائية: الحدود المسموحة (Min / Max)
export const PHYSICS_CONFIG_METADATA = {
  G: { label: "الجاذبية العمودية", default: 9.81, min: 0, max: 25 },
  MU_S: { label: "معامل احتكاك الانزلاق", default: 0.2, min: 0, max: 1.0 },
  MU_R: { label: "معامل احتكاك التدحرج", default: 0.015, min: 0, max: 0.1 },
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

export let G = PHYSICS_CONFIG_METADATA.G.default;
export let MU_R = PHYSICS_CONFIG_METADATA.MU_R.default;
export let MU_S = PHYSICS_CONFIG_METADATA.MU_S.default;
export let BALL_MASS = PHYSICS_CONFIG_METADATA.BALL_MASS.default;
export let BALL_RESTITUTION = PHYSICS_CONFIG_METADATA.BALL_RESTITUTION.default;
export let WALL_RESTITUTION = PHYSICS_CONFIG_METADATA.WALL_RESTITUTION.default;
export let TABLE_RESTITUTION = PHYSICS_CONFIG_METADATA.TABLE_RESTITUTION.default;

export let BALL_INERTIA = (2 / 5) * BALL_MASS * BALL_RADIUS * BALL_RADIUS;

export const SIDE_SPIN_CURVE_COEFFICIENT = 0.12;
export const SIDE_SPIN_EPSILON = 2.0;
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

export const OBJECT_BALL_COLORS = [
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

export const TABLE_PLANE_ACCELERATION = new THREE.Vector3(0, 0, 0);

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
