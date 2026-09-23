export interface Point { x: number; z: number }
export type Segment = readonly [Point, Point];
export interface CourseDefinition {
  id: 'right-angle' | 's-curve';
  name: string; number: string; label: string; description: string; dimensions: string;
  width: number;
  start: Point; startYaw: number; startMark: Segment;
  polygon: Point[]; boundaries: Segment[]; center: Point[]; finish: Segment;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  rules: { noReverse: boolean; noStopAfterGo: boolean };
  passReason: string;
}
export function boundsOf(points: Point[]): CourseDefinition['bounds'] {
  return { minX: Math.min(...points.map(p=>p.x)), maxX: Math.max(...points.map(p=>p.x)),
    minZ: Math.min(...points.map(p=>p.z)), maxZ: Math.max(...points.map(p=>p.z)) };
}
