export interface Point { x: number; z: number }
export type Segment = readonly [Point, Point];
interface CourseBase {
  id: 'right-angle' | 's-curve' | 'parallel-parking' | 'reverse-garage';
  name: string; number: string; label: string; description: string; dimensions: string;
  width: number;
  start: Point; startYaw: number; startMark: Segment;
  polygon: Point[]; boundaries: Segment[]; center: Point[]; finish: Segment;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  passReason: string;
}
export interface DrivingCourse extends CourseBase {
  id: 'right-angle' | 's-curve';
  rules: { noReverse: boolean; noStopAfterGo: boolean };
}
export interface ParkingCourse extends CourseBase {
  id: 'parallel-parking' | 'reverse-garage';
  roads: Point[][];
  /** In reference element order. The dashed opening is intentionally not penalized. */
  penaltyLines: { segment: Segment; reason: string }[];
  guides: Segment[];
  parkZone: { minX: number; maxX: number; minZ: number; maxZ: number; heading: number; tolerance: number };
  requiredParks: number;
  notParkedReason: string;
  direction: 'parallel' | 'strict';
}
export type CourseDefinition = DrivingCourse | ParkingCourse;
export const isParkingCourse = (course: CourseDefinition): course is ParkingCourse =>
  course.id === 'parallel-parking' || course.id === 'reverse-garage';
export function boundsOf(points: Point[]): CourseDefinition['bounds'] {
  return { minX: Math.min(...points.map(p=>p.x)), maxX: Math.max(...points.map(p=>p.x)),
    minZ: Math.min(...points.map(p=>p.z)), maxZ: Math.max(...points.map(p=>p.z)) };
}
