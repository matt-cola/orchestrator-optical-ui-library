import { describe, expect, it } from 'vitest';

import {
  colocatedOffsets,
  curvePoints,
  layoutSegments,
  loopPoints,
  parallelOffsets,
} from './layout';

describe('colocatedOffsets', () => {
  it('keeps a single node on its location', () => {
    expect(colocatedOffsets(1)).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps every pair of nodes at least the spacing apart', () => {
    for (const count of [2, 3, 5, 8]) {
      const offsets = colocatedOffsets(count, 40);
      for (let a = 0; a < count; a += 1) {
        for (let b = a + 1; b < count; b += 1) {
          expect(
            Math.hypot(offsets[a].x - offsets[b].x, offsets[a].y - offsets[b].y),
          ).toBeGreaterThanOrEqual(39.999);
        }
      }
    }
  });
});

describe('curvePoints', () => {
  it('is a straight line without offset', () => {
    expect(curvePoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it('reaches the offset at its apex and keeps its ends', () => {
    const points = curvePoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 12, 20);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[20]).toEqual({ x: 100, y: 0 });
    expect(points[10].x).toBeCloseTo(50);
    expect(points[10].y).toBeCloseTo(12);
  });
});

describe('loopPoints', () => {
  it('starts and ends on the node', () => {
    const points = loopPoints({ x: 5, y: 5 }, { x: 0, y: 0 }, 10);
    expect(points[0].x).toBeCloseTo(5);
    expect(points[0].y).toBeCloseTo(5);
    expect(points[points.length - 1].x).toBeCloseTo(5);
    expect(points[points.length - 1].y).toBeCloseTo(5);
  });
});

describe('layoutSegments', () => {
  it('centres parallel offsets on the straight line', () => {
    expect(parallelOffsets(1, 8)).toEqual([0]);
    expect(parallelOffsets(3, 8)).toEqual([-8, 0, 8]);
  });

  it('spreads the lines that share a pair of nodes, whatever their direction', () => {
    const segments = layoutSegments(
      [
        { id: 'one', routes: [['a', 'b', 'c']] },
        { id: 'two', routes: [['b', 'a']] },
      ],
      () => true,
      10,
    );
    expect(segments).toEqual([
      { itemId: 'one', from: 'a', to: 'b', offset: -5, loopIndex: 0 },
      { itemId: 'two', from: 'a', to: 'b', offset: 5, loopIndex: 1 },
      { itemId: 'one', from: 'b', to: 'c', offset: 0, loopIndex: 0 },
    ]);
  });

  it('skips segments with an end that is not on the map', () => {
    const segments = layoutSegments(
      [{ id: 'one', routes: [['a', 'b', 'c']] }],
      (nodeId) => nodeId !== 'c',
    );
    expect(segments.map((segment) => [segment.from, segment.to])).toEqual([['a', 'b']]);
  });
});
