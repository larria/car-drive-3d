import { RIGHT_ANGLE } from './courses/right-angle';
import { isParkingCourse, type CourseDefinition, type Point, type Segment } from './courses/course-definition';
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
// Reference speed thresholds are px/frame; 7mm/px at 60Hz converts them to m/s.
export const PARK_DIRECTION_EPS = .01 * .007 * 60;
export const PARK_STOP_EPS = .05 * .007 * 60;
export const TOTAL_LIMIT = 30, OUTSIDE_STOP_LIMIT = 2;
const phases = ['前进','倒车','前进','倒车','前进'] as const;
export class ExamRules {
  constructor(readonly course:CourseDefinition=RIGHT_ANGLE) {}
  startedW=false;
  totalElapsed=0;
  outsideStopped=0;
  parkCount=0;
  parked=false;
  reversed=false;
  forwardAfterParked=false;
  dirPhase=0;
  dirPhaseStarted=false;
  get phaseLabel(){return phases[this.dirPhase];}
  reset(){
    this.startedW=false;this.totalElapsed=0;this.outsideStopped=0;
    this.parkCount=0;this.parked=false;this.reversed=false;this.forwardAfterParked=false;
    this.dirPhase=0;this.dirPhaseStarted=false;
  }
  step(p: ExamPose, dt=1/60): ExamResult | null {
    if(p.throttle)this.startedW=true;
    const course=this.course;
    if(!isParkingCourse(course)){
      if(course.rules.noReverse && p.speed < -REVERSE_EPS)return {passed:false,reason:'中途倒车，考试不合格'};
      if(course.rules.noStopAfterGo&&this.startedW&&!p.throttle&&p.speed<STOP_EPS)return {passed:false,reason:'中途停车，考试不合格'};
    }
    const corners=bodyCorners(p);
    const hits=(line:Segment)=>corners.some((a,i)=>intersects(a,corners[(i+1)%4],...line));
    if(isParkingCourse(course)){
      const forward=p.speed>PARK_DIRECTION_EPS, reverse=p.speed < -PARK_DIRECTION_EPS;
      // Reference checks direction first, before timers, walls and parking state.
      if(course.direction==='parallel'){
        if(reverse)this.reversed=true;
        if(this.parked&&forward)this.forwardAfterParked=true;
        if(this.reversed&&this.parkCount===0&&forward)return {passed:false,reason:'倒车后入库前不得前进，考试不合格'};
        if(this.forwardAfterParked&&reverse)return {passed:false,reason:'出库后不得再倒车，考试不合格'};
      }else if(forward||reverse){
        const current=forward?'前进':'倒车';
        if(current===phases[this.dirPhase])this.dirPhaseStarted=true;
        else if(this.dirPhaseStarted&&this.dirPhase<phases.length-1&&current===phases[this.dirPhase+1]){
          this.dirPhase++;this.dirPhaseStarted=true;
        }else return {passed:false,reason:'操作顺序错误，考试不合格'};
      }
      if(this.startedW){
        this.totalElapsed=Math.min(TOTAL_LIMIT,this.totalElapsed+dt);
        if(this.totalElapsed>=TOTAL_LIMIT)return {passed:false,reason:'30 秒内未完成，考试不合格'};
        const zone=course.parkZone;
        const inZone=corners.every(c=>c.x>=zone.minX&&c.x<=zone.maxX&&c.z>=zone.minZ&&c.z<=zone.maxZ);
        if(Math.abs(p.speed)<PARK_STOP_EPS&&!inZone)this.outsideStopped=Math.min(OUTSIDE_STOP_LIMIT,this.outsideStopped+dt);
        if(this.outsideStopped>=OUTSIDE_STOP_LIMIT)return {passed:false,reason:'中途停车超 2 秒，考试不合格'};
      }
      for(const line of course.penaltyLines)if(hits(line.segment))return {passed:false,reason:line.reason};
      const zone=course.parkZone;
      const inZone=corners.every(c=>c.x>=zone.minX&&c.x<=zone.maxX&&c.z>=zone.minZ&&c.z<=zone.maxZ);
      const heading=Math.abs(Math.atan2(Math.sin(p.yaw-zone.heading),Math.cos(p.yaw-zone.heading)))<=zone.tolerance;
      const valid=inZone&&heading&&Math.abs(p.speed)<PARK_STOP_EPS;
      if(valid&&!this.parked){this.parked=true;this.parkCount++;}
      else if(!valid&&this.parked)this.parked=false;
      // Garage finish ignores actual negative speed, including the tiny reverse deadband.
      if(hits(course.finish)&&(course.id!=='reverse-garage'||p.speed>=0))
        return this.parkCount>=course.requiredParks?{passed:true,reason:course.passReason}:{passed:false,reason:course.notParkedReason};
      return null;
    }
    if(course.boundaries.some(hits))return {passed:false,reason:'车辆越出边界线'};
    if(hits(course.finish))return {passed:true,reason:course.passReason};
    return null;
  }
}
