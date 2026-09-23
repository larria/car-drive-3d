import { RIGHT_ANGLE, type Point, type Segment } from './courses/right-angle';
import { VEHICLE } from './vehicle-config';
export const REVERSE_EPS = .0042, STOP_EPS = .021;
export interface ExamPose { x: number; z: number; yaw: number; speed: number; throttle: boolean }
export interface ExamResult { passed: boolean; reason: string }
export function intersects(a: Point,b: Point,c: Point,d: Point): boolean {
  const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  return cross(c,d,a)*cross(c,d,b)<0 && cross(a,b,c)*cross(a,b,d)<0;
}
export function bodyCorners(p: ExamPose): Point[] {
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>{
    const x=a*VEHICLE.width/2,z=b*VEHICLE.length/2;
    return {x:p.x+c*x+s*z,z:p.z-s*x+c*z};
  });
}
export class ExamRules {
  startedW=false;
  reset(){this.startedW=false;}
  step(p: ExamPose): ExamResult | null {
    if(p.throttle)this.startedW=true;
    if(p.speed < -REVERSE_EPS)return {passed:false,reason:'中途倒车，考试不合格'};
    if(this.startedW&&!p.throttle&&p.speed<STOP_EPS)return {passed:false,reason:'中途停车，考试不合格'};
    const corners=bodyCorners(p);
    const hits=(line:Segment)=>corners.some((a,i)=>intersects(a,corners[(i+1)%4],...line));
    if(RIGHT_ANGLE.boundaries.some(hits))return {passed:false,reason:'车辆越出边界线'};
    if(hits(RIGHT_ANGLE.finish))return {passed:true,reason:'车辆顺利通过直角转弯'};
    return null;
  }
}
