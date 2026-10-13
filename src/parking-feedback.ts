import type { ParkingCourse, Segment } from './courses/course-definition';

/** Only solid edges on the bay rectangle; never recolour the opening or road. */
export function isParkingBaySegment([a, b]: Segment, zone: ParkingCourse['parkZone']): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-7;
  const inside = (p: typeof a) => p.x >= zone.minX - 1e-7 && p.x <= zone.maxX + 1e-7
    && p.z >= zone.minZ - 1e-7 && p.z <= zone.maxZ + 1e-7;
  return inside(a) && inside(b) && ((near(a.x, b.x) && (near(a.x, zone.minX) || near(a.x, zone.maxX)))
    || (near(a.z, b.z) && (near(a.z, zone.minZ) || near(a.z, zone.maxZ))));
}
