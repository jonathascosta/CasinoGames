import { DIE_FACES, createSeededRng } from '@casinogames/engine';
import { describe, expect, it } from 'vitest';
import {
  FACES,
  PIPS,
  dot,
  fromAxisAngle,
  fromTo,
  multiply,
  normalize,
  orientationFor,
  slerp,
  rotate,
  topFace,
  tumble,
  type Vec3,
} from './geometry.ts';

function expectVec(actual: Vec3, expected: Vec3): void {
  actual.forEach((value, i) => {
    expect(value).toBeCloseTo(expected[i]!, 9);
  });
}

describe('die faces', () => {
  it('pairs opposite faces to sum to seven', () => {
    for (const face of FACES) {
      const opposite = FACES.find((other) => dot(other.normal, face.normal) < -0.99)!;
      expect(face.value + opposite.value).toBe(7);
    }
  });

  it('uses right-handed face bases (u × v = n), so pips are never mirrored', () => {
    for (const { u, v, normal } of FACES) {
      expectVec(
        [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]],
        normal,
      );
    }
  });

  it('places 1, 2 and 3 counter-clockwise around their shared corner', () => {
    // Looking at the corner (1,1,1) from outside, a +120° turn about it maps
    // the 2 face (+x) to 3 (+y) and 3 to 1 (+z).
    const turn = fromAxisAngle([1, 1, 1], (2 * Math.PI) / 3);
    expectVec(rotate(turn, [1, 0, 0]), [0, 1, 0]);
    expectVec(rotate(turn, [0, 1, 0]), [0, 0, 1]);
    expect(FACES.find((f) => f.normal[0] === 1)!.value).toBe(2);
    expect(FACES.find((f) => f.normal[1] === 1)!.value).toBe(3);
  });

  it('has the right number of pips per face', () => {
    for (const value of DIE_FACES) expect(PIPS[value]).toHaveLength(value);
  });
});

describe('quaternions', () => {
  it('rotate vectors about an axis', () => {
    expectVec(rotate(fromAxisAngle([0, 0, 1], Math.PI / 2), [1, 0, 0]), [0, 1, 0]);
    expectVec(rotate(fromAxisAngle([1, 0, 0], Math.PI), [0, 1, 0]), [0, -1, 0]);
  });

  it('compose right to left', () => {
    const quarterZ = fromAxisAngle([0, 0, 1], Math.PI / 2);
    const quarterX = fromAxisAngle([1, 0, 0], Math.PI / 2);
    // Apply quarterX first, then quarterZ.
    expectVec(rotate(multiply(quarterZ, quarterX), [0, 1, 0]), rotate(quarterZ, [0, 0, 1]));
  });

  it('find the shortest rotation between vectors, including opposite ones', () => {
    for (const [from, to] of [
      [
        [1, 0, 0],
        [0, 0, 1],
      ],
      [
        [0, 0, -1],
        [0, 0, 1],
      ],
      [
        [0, 1, 0],
        [0, 1, 0],
      ],
    ] as [Vec3, Vec3][]) {
      expectVec(rotate(fromTo(from, to), from), to);
    }
  });

  it('interpolate along the shortest arc', () => {
    const a = fromAxisAngle([0, 0, 1], 0);
    const b = fromAxisAngle([0, 0, 1], Math.PI / 2);
    expect(slerp(a, b, 0)).toEqual(a);
    expectVec(rotate(slerp(a, b, 0.5), [1, 0, 0]), [Math.SQRT1_2, Math.SQRT1_2, 0]);
    const negated = [-b[0], -b[1], -b[2], -b[3]] as const;
    expectVec(rotate(slerp(a, negated, 0.5), [1, 0, 0]), [Math.SQRT1_2, Math.SQRT1_2, 0]);
  });

  it('refuse to normalise a zero vector', () => {
    expect(() => normalize([0, 0, 0])).toThrow(RangeError);
  });
});

describe('orientations', () => {
  it.each(DIE_FACES)('shows %i to the camera at any yaw', (value) => {
    for (const yaw of [0, 0.4, -1.3, Math.PI]) {
      expect(topFace(orientationFor(value, yaw))).toBe(value);
      expect(
        rotate(orientationFor(value, yaw), FACES.find((f) => f.value === value)!.normal)[2],
      ).toBeCloseTo(1, 9);
    }
  });

  it('tumbles from anywhere and lands exactly on the target', () => {
    const rng = createSeededRng('tumble');
    for (const value of DIE_FACES) {
      const target = orientationFor(value, rng.next() * 6);
      const axis: Vec3 = [rng.next() - 0.5, rng.next() - 0.5, 0.2];
      expect(tumble(target, axis, 17.3, 1)).toEqual(target);
      expect(topFace(tumble(target, axis, 17.3, 1))).toBe(value);
      // Mid-tumble the die is somewhere else entirely.
      expect(tumble(target, axis, 17.3, 0.3)).not.toEqual(target);
    }
  });
});
