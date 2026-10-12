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
  private previousPose: ExamPose | null = null;
  private crossedFinishOutward = false;
  get phaseLabel(){return phases[this.dirPhase];}
  private finished(p: ExamPose, corners: Point[]): boolean {
    const { finish: [a,b], finishExitNormal: n } = this.course;
    const distance=(q:Point)=>(q.x-a.x)*n.x+(q.z-a.z)*n.z;
    const epsilon=1e-7,dx=b.x-a.x,dz=b.z-a.z,lengthSquared=dx*dx+dz*dz;
    const onFinish=(q:Point)=>{
      const along=((q.x-a.x)*dx+(q.z-a.z)*dz)/lengthSquared;
      return along>=0&&along<=1;
    };
    const allowed=this.course.id!=='reverse-garage'||p.speed>=0;
    const previous=this.previousPose;
    this.previousPose={...p};
    if(previous&&allowed){
      const yawDelta=Math.atan2(Math.sin(p.yaw-previous.yaw),Math.cos(p.yaw-previous.yaw));
      // Bound both translation and corner arc travel; never interpolate the long yaw path.
      const radius=Math.hypot(VEHICLE.width/2,VEHICLE.length/2);
      const steps=Math.max(1,Math.ceil((Math.hypot(p.x-previous.x,p.z-previous.z)+radius*Math.abs(yawDelta))/.02));
      let beforeCorners=bodyCorners(previous);
      for(let step=1;step<=steps;step++){
        const t=step/steps;
        const current=bodyCorners({...p,x:previous.x+(p.x-previous.x)*t,z:previous.z+(p.z-previous.z)*t,yaw:previous.yaw+yawDelta*t});
        if(current.every(q=>distance(q)<=epsilon))this.crossedFinishOutward=false;
        for(let i=0;i<4;i++){
          const from=beforeCorners[i],to=current[i],before=distance(from),after=distance(to);
          if(before<=0&&after>epsilon){
            const fraction=-before/(after-before);
            if(onFinish({x:from.x+fraction*(to.x-from.x),z:from.z+fraction*(to.z-from.z)}))this.crossedFinishOutward=true;
          }
          // A narrow marking may lie between both corner trajectories. Check the
          // current body edge and the outward motion of its material contact point.
          const j=(i+1)%4,end=current[j],dEnd=distance(end);
          // Test finish endpoints inside the swept edge strip as well: an edge
          // parallel to the finish can cross it entirely between two samples.
          const sweptContains=(q:Point,u:Point,v:Point,w:Point)=>{
            const cross=(r:Point,s:Point,t:Point)=>(s.x-r.x)*(t.z-r.z)-(s.z-r.z)*(t.x-r.x);
            const area=cross(u,v,w);
            if(Math.abs(area)<1e-12)return false;
            const weights=[cross(q,v,w)/area,cross(u,q,w)/area,cross(u,v,q)/area];
            return weights.every(weight=>weight>=-1e-9&&weight<=1+1e-9);
          };
          if(Math.min(after-before,dEnd-distance(beforeCorners[j]))>epsilon&&
            [a,b].some(q=>sweptContains(q,from,beforeCorners[j],end)||sweptContains(q,from,end,to)))this.crossedFinishOutward=true;
          if((after<=0&&dEnd>0)||(after>0&&dEnd<=0)){
            const fraction=-after/(dEnd-after);
            const contact={x:to.x+fraction*(end.x-to.x),z:to.z+fraction*(end.z-to.z)};
            const oldContact={x:from.x+fraction*(beforeCorners[j].x-from.x),z:from.z+fraction*(beforeCorners[j].z-from.z)};
            if(onFinish(contact)&&distance(contact)-distance(oldContact)>epsilon)this.crossedFinishOutward=true;
          }
        }
        beforeCorners=current;
      }
    }
    if(corners.every(q=>distance(q)<=epsilon))this.crossedFinishOutward=false;
    return allowed&&this.crossedFinishOutward&&corners.every(q=>distance(q)>epsilon);
  }
  reset(){
    this.startedW=false;this.totalElapsed=0;this.outsideStopped=0;
    this.parkCount=0;this.parked=false;this.reversed=false;this.forwardAfterParked=false;
    this.dirPhase=0;this.dirPhaseStarted=false;
    this.previousPose=null;this.crossedFinishOutward=false;
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
      if(this.finished(p,corners))
        return this.parkCount>=course.requiredParks?{passed:true,reason:course.passReason}:{passed:false,reason:course.notParkedReason};
      return null;
    }
    if(course.boundaries.some(hits))return {passed:false,reason:'车辆越出边界线'};
    if(this.finished(p,corners))return {passed:true,reason:course.passReason};
    return null;
  }
}
