/**
 * Screen-space (pixel) geometry of the optical map.
 *
 * Nodes that share a location are fanned out around it by a fixed number of
 * pixels, and parallel lines between the same two nodes are bent apart, so the
 * picture stays readable at every zoom level. Everything here is pure: the map
 * component projects coordinates to pixels, calls these helpers and projects
 * the result back.
 */

export type Point = { x: number; y: number };

export const NODE_SPACING_PX = 56;

/** Offsets (relative to the location) of `count` nodes sharing one location. */
export const colocatedOffsets = (count: number, spacing: number = NODE_SPACING_PX): Point[] => {
  if (count <= 1) return [{ x: 0, y: 0 }];
  if (count === 2) {
    return [
      { x: -spacing / 2, y: 0 },
      { x: spacing / 2, y: 0 },
    ];
  }
  const radius = colocatedRadius(count, spacing);
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
};

/** Radius of the circle the nodes of one location are placed on. */
export const colocatedRadius = (count: number, spacing: number = NODE_SPACING_PX): number => {
  if (count <= 1) return 0;
  if (count === 2) return spacing / 2;
  return spacing / (2 * Math.sin(Math.PI / count));
};

/**
 * Signed distances from the straight line for `count` parallel lines,
 * centred on it: 1 -> [0], 2 -> [-gap/2, gap/2], 3 -> [-gap, 0, gap].
 */
export const parallelOffsets = (count: number, gap: number): number[] =>
  Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * gap);

/**
 * Points of a quadratic curve from `a` to `b` whose apex lies `offset` pixels
 * off the straight line. The side is defined relative to the a -> b direction,
 * so callers must pass the two ends in a canonical order.
 */
export const curvePoints = (a: Point, b: Point, offset: number, samples = 20): Point[] => {
  if (offset === 0) return [a, b];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // The control point sits at twice the apex distance.
  const control = {
    x: (a.x + b.x) / 2 + (-dy / length) * offset * 2,
    y: (a.y + b.y) / 2 + (dx / length) * offset * 2,
  };
  return Array.from({ length: samples + 1 }, (_, index) => {
    const t = index / samples;
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
    };
  });
};

/** A closed loop touching `at`, extending in `direction` (for a line from a node to itself). */
export const loopPoints = (at: Point, direction: Point, radius: number, samples = 24): Point[] => {
  const length = Math.hypot(direction.x, direction.y);
  const unit =
    length === 0 ? { x: 0, y: -1 } : { x: direction.x / length, y: direction.y / length };
  const centre = { x: at.x + unit.x * radius, y: at.y + unit.y * radius };
  const start = Math.atan2(at.y - centre.y, at.x - centre.x);
  return Array.from({ length: samples + 1 }, (_, index) => {
    const angle = start + (2 * Math.PI * index) / samples;
    return { x: centre.x + radius * Math.cos(angle), y: centre.y + radius * Math.sin(angle) };
  });
};

export type RouteSegment = {
  /** Identifies the map item the segment belongs to. */
  itemId: string;
  /** Node ids in canonical (sorted) order. */
  from: string;
  to: string;
  /** Signed distance from the straight line, see `curvePoints`. */
  offset: number;
  /** Position among the loops of one node, for segments with from === to. */
  loopIndex: number;
};

/**
 * Splits the routes of the given items into node-to-node segments and spreads
 * the segments that share the same pair of nodes.
 */
export const layoutSegments = (
  items: { id: string; routes: string[][] }[],
  isPlaced: (nodeId: string) => boolean,
  gap = 9,
): RouteSegment[] => {
  const groups = new Map<string, { itemId: string; from: string; to: string }[]>();
  for (const item of items) {
    for (const route of item.routes) {
      for (let index = 0; index < route.length - 1; index += 1) {
        const [from, to] = [route[index], route[index + 1]].sort();
        if (!isPlaced(from) || !isPlaced(to)) continue;
        const key = `${from}|${to}`;
        groups.set(key, [...(groups.get(key) ?? []), { itemId: item.id, from, to }]);
      }
    }
  }
  return [...groups.values()].flatMap((group) => {
    const offsets = parallelOffsets(group.length, gap);
    return group.map((segment, index) => ({
      ...segment,
      offset: offsets[index],
      loopIndex: index,
    }));
  });
};
