import { VEHICLE } from '../vehicle-config';
import { boundsOf, type CourseDefinition, type Point, type Segment } from './course-definition';
export type { Point, Segment } from './course-definition';
export function rightAngle(wheelbase = VEHICLE.wheelbase as number) {
  const width = wheelbase + 1, h = width / 2, end = 10 + h;
  const p = (x: number, z: number): Point => ({ x, z });
  return { width, entrance: 12, exit: 10, start: p(0, 9), startLine: 7.5,
    polygon: [p(-h,12),p(h,12),p(h,0),p(end,0),p(end,-width),p(-h,-width)],
    boundaries: [[p(-h,-width),p(-h,12)],[p(h,0),p(h,12)],[p(h,0),p(end,0)],[p(-h,-width),p(end,-width)]] as Segment[],
    finish: [p(end,-width),p(end,0)] as Segment };
}
const geometry = rightAngle();
export const RIGHT_ANGLE: CourseDefinition & ReturnType<typeof rightAngle> = {
  ...geometry, id:'right-angle', name:'直角转弯', number:'01', label:'RIGHT ANGLE',
  description:'把握转向时机，一次顺畅通过。',
  dimensions:`道路宽 ${geometry.width.toFixed(3)} m · 入口 12 m · 出口 10 m`,
  startYaw:0, startMark:[{x:-geometry.width/2,z:geometry.startLine},{x:geometry.width/2,z:geometry.startLine}],
  center:[{x:0,z:11.5},{x:0,z:-geometry.width/2},{x:11,z:-geometry.width/2}],
  bounds:boundsOf(geometry.polygon), rules:{noReverse:true,noStopAfterGo:true}, passReason:'车辆顺利通过直角转弯',
};
