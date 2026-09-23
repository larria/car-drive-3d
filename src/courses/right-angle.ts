import { VEHICLE } from '../vehicle-config';
export interface Point { x: number; z: number }
export type Segment = readonly [Point, Point];
export function rightAngle(wheelbase = VEHICLE.wheelbase as number) {
  const width = wheelbase + 1, h = width / 2, end = 10 + h;
  const p = (x: number, z: number): Point => ({ x, z });
  return { width, entrance: 12, exit: 10, start: p(0, 9), startLine: 7.5,
    polygon: [p(-h,12),p(h,12),p(h,0),p(end,0),p(end,-width),p(-h,-width)],
    boundaries: [[p(-h,-width),p(-h,12)],[p(h,0),p(h,12)],[p(h,0),p(end,0)],[p(-h,-width),p(end,-width)]] as Segment[],
    finish: [p(end,-width),p(end,0)] as Segment };
}
export const RIGHT_ANGLE = rightAngle();
