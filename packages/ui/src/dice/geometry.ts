import type { DieFace } from '@casinogames/engine';

/**
 * The geometry of a die, independent of any renderer. The die is a cube of
 * half-size 1 in its own frame; the camera looks down the −z axis, so the
 * face whose normal points to +z is the one facing the player.
 */
export type Vec3 = readonly [number, number, number];
/** Unit quaternion [w, x, y, z]. */
export type Quat = readonly [number, number, number, number];

export interface FaceGeometry {
  readonly value: DieFace;
  /** Outward normal, and the two in-plane axes with u × v = n. */
  readonly normal: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
}

/**
 * Opposite faces sum to 7 and 1-2-3 run counter-clockwise around their
 * shared corner, as on Western (and casino) dice. Every basis is
 * right-handed, so pips are never mirrored.
 */
export const FACES: readonly FaceGeometry[] = [
  { value: 1, normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { value: 6, normal: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { value: 2, normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { value: 5, normal: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] },
  { value: 3, normal: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { value: 4, normal: [0, -1, 0], u: [0, 0, -1], v: [1, 0, 0] },
];

const P = 0.52;

/** Pip centres in face coordinates (−1…1 along u and v). */
export const PIPS: Readonly<Record<DieFace, readonly (readonly [number, number])[]>> = {
  1: [[0, 0]],
  2: [
    [-P, -P],
    [P, P],
  ],
  3: [
    [-P, -P],
    [0, 0],
    [P, P],
  ],
  4: [
    [-P, -P],
    [P, -P],
    [-P, P],
    [P, P],
  ],
  5: [
    [-P, -P],
    [P, -P],
    [0, 0],
    [-P, P],
    [P, P],
  ],
  6: [
    [-P, -P],
    [-P, 0],
    [-P, P],
    [P, -P],
    [P, 0],
    [P, P],
  ],
};

export const IDENTITY: Quat = [1, 0, 0, 0];

export function multiply(a: Quat, b: Quat): Quat {
  const [aw, ax, ay, az] = a;
  const [bw, bx, by, bz] = b;
  return [
    aw * bw - ax * bx - ay * by - az * bz,
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
  ];
}

export function fromAxisAngle(axis: Vec3, angle: number): Quat {
  const [x, y, z] = normalize(axis);
  const s = Math.sin(angle / 2);
  return [Math.cos(angle / 2), x * s, y * s, z * s];
}

/** Rotates `v` by the unit quaternion `q`. */
export function rotate(q: Quat, v: Vec3): Vec3 {
  const [w, x, y, z] = q;
  const [vx, vy, vz] = v;
  // t = 2 (q.xyz × v); v' = v + w t + q.xyz × t
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [
    vx + w * tx + (y * tz - z * ty),
    vy + w * ty + (z * tx - x * tz),
    vz + w * tz + (x * ty - y * tx),
  ];
}

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  if (length === 0) throw new RangeError('Cannot normalise a zero vector');
  return [v[0] / length, v[1] / length, v[2] / length];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** The shortest rotation taking unit vector `from` onto unit vector `to`. */
export function fromTo(from: Vec3, to: Vec3): Quat {
  const cosine = dot(from, to);
  if (cosine > 1 - 1e-9) return IDENTITY;
  if (cosine < -1 + 1e-9) {
    // Opposite: turn half a revolution about any perpendicular axis.
    const axis = Math.abs(from[0]) < 0.9 ? cross(from, [1, 0, 0]) : cross(from, [0, 1, 0]);
    return fromAxisAngle(axis, Math.PI);
  }
  return fromAxisAngle(cross(from, to), Math.acos(cosine));
}

export function faceOf(value: DieFace): FaceGeometry {
  return FACES.find((face) => face.value === value)!;
}

/** An orientation showing `value` to the camera, turned by `yaw` about the view axis. */
export function orientationFor(value: DieFace, yaw = 0): Quat {
  const align = fromTo(faceOf(value).normal, [0, 0, 1]);
  return multiply(fromAxisAngle([0, 0, 1], yaw), align);
}

/** The value facing the camera for an orientation (the most +z normal). */
export function topFace(q: Quat): DieFace {
  let best = FACES[0]!;
  let bestZ = -Infinity;
  for (const face of FACES) {
    const z = rotate(q, face.normal)[2];
    if (z > bestZ) {
      bestZ = z;
      best = face;
    }
  }
  return best.value;
}

/** Spherical interpolation between unit quaternions (shortest arc). */
export function slerp(a: Quat, b: Quat, t: number): Quat {
  let [bw, bx, by, bz] = b;
  let cosine = a[0] * bw + a[1] * bx + a[2] * by + a[3] * bz;
  if (cosine < 0) {
    cosine = -cosine;
    [bw, bx, by, bz] = [-bw, -bx, -by, -bz];
  }
  let wa = 1 - t;
  let wb = t;
  if (cosine < 0.9995) {
    const angle = Math.acos(cosine);
    const sine = Math.sin(angle);
    wa = Math.sin((1 - t) * angle) / sine;
    wb = Math.sin(t * angle) / sine;
  }
  const q: Quat = [
    wa * a[0] + wb * bw,
    wa * a[1] + wb * bx,
    wa * a[2] + wb * by,
    wa * a[3] + wb * bz,
  ];
  const length = Math.hypot(...q);
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

/**
 * A tumble that ends exactly at `target`: the die spins `angle` radians about
 * `axis` (in its own frame) and the spin decays to zero as progress reaches 1.
 */
export function tumble(target: Quat, axis: Vec3, angle: number, progress: number): Quat {
  const remaining = angle * (1 - progress) ** 2.2;
  return multiply(target, fromAxisAngle(axis, remaining));
}
