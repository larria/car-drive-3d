import { RIGHT_ANGLE } from './courses/right-angle';
import { isParkingCourse, type CourseDefinition, type Point, type Segment } from './courses/course-definition';
import { VEHICLE, WHEEL_POSITIONS, WHEEL_RADIUS, WHEEL_WIDTH } from './vehicle-config';
export const REVERSE_EPS = .0042, STOP_EPS = .021;
export interface ExamPose { x: number; z: number; yaw: number; speed: number; throttle: boolean; steering?: number }
export interface ExamDeduction { points: number; reason: string; elapsed: number }
export interface ExamResult { passed: boolean; reason: string; score: number; deductions: ExamDeduction[] }
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
/** Ground-plane tire rectangle; front wheels use the actual steering angle. */
export function wheelPolygons(p: ExamPose): Point[][] {
  return WHEEL_POSITIONS.map((wheel,i)=>{
    const c=Math.cos(p.yaw),s=Math.sin(p.yaw),x=p.x+c*wheel.x+s*wheel.z,z=p.z-s*wheel.x+c*wheel.z;
    const angle=p.yaw+(i<2?(p.steering??0):0),wc=Math.cos(angle),ws=Math.sin(angle);
    return [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>({x:x+wc*a*WHEEL_WIDTH/2+ws*b*WHEEL_RADIUS,z:z-ws*a*WHEEL_WIDTH/2+wc*b*WHEEL_RADIUS}));
  });
}
function contains(poly: readonly Point[], p: Point): boolean {
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[j],b=poly[i],cross=(b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
    if(Math.abs(cross)<1e-8&&p.x>=Math.min(a.x,b.x)-1e-8&&p.x<=Math.max(a.x,b.x)+1e-8&&p.z>=Math.min(a.z,b.z)-1e-8&&p.z<=Math.max(a.z,b.z)+1e-8)return true;
    if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)inside=!inside;
  }
  return inside;
}
/** Inclusive marking contact; generic intersects deliberately remains strict. */
export function inclusiveIntersects(a: Point,b: Point,c: Point,d: Point): boolean {
  const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.z-p.z)-(q.z-p.z)*(r.x-p.x);
  const on=(p:Point,q:Point,r:Point)=>Math.abs(cross(p,q,r))<=1e-8&&r.x>=Math.min(p.x,q.x)-1e-8&&r.x<=Math.max(p.x,q.x)+1e-8&&r.z>=Math.min(p.z,q.z)-1e-8&&r.z<=Math.max(p.z,q.z)+1e-8;
  return intersects(a,b,c,d)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}
function touches(poly: Point[], line: Segment): boolean {
  return line.some(q=>contains(poly,q))||poly.some((a,i)=>inclusiveIntersects(a,poly[(i+1)%poly.length],...line));
}
const MAX_SWEEP_STEPS=4096;
function sweepSteps(a: ExamPose,b: ExamPose): number {
  const yaw=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
  return Math.max(1,Math.ceil((Math.hypot(b.x-a.x,b.z-a.z)+3*Math.abs(yaw)+WHEEL_RADIUS*Math.abs((b.steering??0)-(a.steering??0)))/.02));
}
// Reference speed thresholds are px/frame; 7mm/px at 60Hz converts them to m/s.
export const PARK_DIRECTION_EPS = .01 * .007 * 60;
export const PARK_STOP_EPS = .05 * .007 * 60;
export const TOTAL_LIMIT = 30, OUTSIDE_STOP_LIMIT = 2;
const phases = ['前进','倒车','前进','倒车','前进'] as const;
export class ExamRules {
  constructor(readonly course:CourseDefinition=RIGHT_ANGLE) {}
  score=100;
  deductions: ExamDeduction[]=[];
  private bodyContact=false;
  private wheelContact=false;
  private parkingAttempt=false;
  private startedMoving=false;
  private countedParkPhases=new Set<number>();
  private boundaryPose: ExamPose | null=null;
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
  private prematureFinish = false;
  private result(passed:boolean,reason:string): ExamResult { return {passed,reason,score:this.score,deductions:this.deductions.map(d=>({...d}))}; }
  private deduct(points:number,reason:string): ExamResult | null {
    this.score=Math.max(0,this.score-points);this.deductions.push({points,reason,elapsed:this.totalElapsed});
    return this.score<80?this.result(false,reason):null;
  }
  private fail(reason:string): ExamResult { this.deduct(100,reason);return this.result(false,reason); }
  get phaseLabel(){return phases[this.dirPhase];}
  private finished(p: ExamPose, corners: Point[], premature = false): boolean {
    if(this.prematureFinish!==premature){this.crossedFinishOutward=false;this.previousPose=null;this.prematureFinish=premature;}
    const { finish: [a,b], finishExitNormal: n } = this.course;
    const distance=(q:Point)=>(q.x-a.x)*n.x+(q.z-a.z)*n.z;
    const epsilon=1e-7,dx=b.x-a.x,dz=b.z-a.z,lengthSquared=dx*dx+dz*dz;
    const onFinish=(q:Point)=>{
      const along=((q.x-a.x)*dx+(q.z-a.z)*dz)/lengthSquared;
      return along>=0&&along<=1;
    };
    const allowed=p.speed>0 && (-Math.sin(p.yaw)*n.x-Math.cos(p.yaw)*n.z)>1e-7;
    const tires=(pose:ExamPose)=>wheelPolygons(pose).slice(premature?0:2,premature?2:4).flat();
    const previous=this.previousPose;
    this.previousPose={...p};
    if(previous&&allowed){
      const yawDelta=Math.atan2(Math.sin(p.yaw-previous.yaw),Math.cos(p.yaw-previous.yaw));
      // Bound both translation and corner arc travel; never interpolate the long yaw path.
      const radius=Math.hypot(VEHICLE.width/2,VEHICLE.length/2);
      const steps=Math.min(MAX_SWEEP_STEPS,Math.max(1,Math.ceil((Math.hypot(p.x-previous.x,p.z-previous.z)+radius*Math.abs(yawDelta))/.02)));
      let beforeCorners=tires(previous);
      for(let step=1;step<=steps;step++){
        const t=step/steps;
        const current=tires({...p,x:previous.x+(p.x-previous.x)*t,z:previous.z+(p.z-previous.z)*t,yaw:previous.yaw+yawDelta*t,steering:(previous.steering??0)+((p.steering??0)-(previous.steering??0))*t});
        if(current.every(q=>distance(q)<=epsilon))this.crossedFinishOutward=false;
        for(let i=0;i<8;i++){
          const from=beforeCorners[i],to=current[i],before=distance(from),after=distance(to);
          if(before<=0&&after>epsilon){
            const fraction=-before/(after-before);
            if(onFinish({x:from.x+fraction*(to.x-from.x),z:from.z+fraction*(to.z-from.z)}))this.crossedFinishOutward=true;
          }
          // A narrow marking may lie between both corner trajectories. Check the
          // current body edge and the outward motion of its material contact point.
          const j=Math.floor(i/4)*4+(i+1)%4,end=current[j],dEnd=distance(end);
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
    corners=tires(p);
    if(corners.every(q=>distance(q)<=epsilon))this.crossedFinishOutward=false;
    return allowed&&this.crossedFinishOutward&&(premature||corners.every(q=>distance(q)>epsilon));
  }
  reset(){
    this.score=100;this.deductions=[];this.bodyContact=false;this.wheelContact=false;this.parkingAttempt=false;this.boundaryPose=null;
    this.startedW=false;this.startedMoving=false;this.countedParkPhases.clear();this.totalElapsed=0;this.outsideStopped=0;
    this.parkCount=0;this.parked=false;this.reversed=false;this.forwardAfterParked=false;
    this.dirPhase=0;this.dirPhaseStarted=false;
    this.previousPose=null;this.crossedFinishOutward=false;this.prematureFinish=false;
  }
  step(p: ExamPose, dt=1/60): ExamResult | null {
    if(![p.x,p.z,p.yaw,p.speed,p.steering??0,dt].every(Number.isFinite)||dt<0||Math.max(Math.abs(p.x),Math.abs(p.z))>1e6||Math.abs(p.yaw)>1e6||Math.abs(p.steering??0)>1e6)return this.fail('车辆状态数值异常，考试不合格');
    if(this.boundaryPose&&sweepSteps(this.boundaryPose,p)>MAX_SWEEP_STEPS)return this.fail('车辆位移超出检测预算，考试不合格');
    if(p.throttle)this.startedW=true;
    if(Math.abs(p.speed)>=STOP_EPS)this.startedMoving=true;
    const course=this.course;
    if(!isParkingCourse(course)){
      if(course.rules.noReverse && p.speed < -REVERSE_EPS)return this.fail('中途倒车，考试不合格');
      if(course.rules.noStopAfterGo&&this.startedMoving&&Math.abs(p.speed)<STOP_EPS)return this.fail('中途停车，考试不合格');
    }
    const corners=bodyCorners(p);
    const hits=(line:Segment)=>touches(corners,line);
    const samples: ExamPose[]=[];
    const previous=this.boundaryPose;
    this.boundaryPose={...p};
    if(previous){
      const yaw=Math.atan2(Math.sin(p.yaw-previous.yaw),Math.cos(p.yaw-previous.yaw));
      const steps=sweepSteps(previous,p);
      for(let i=1;i<=steps;i++){const t=i/steps;samples.push({...p,x:previous.x+(p.x-previous.x)*t,z:previous.z+(p.z-previous.z)*t,yaw:previous.yaw+yaw*t,steering:(previous.steering??0)+((p.steering??0)-(previous.steering??0))*t});}
    }else samples.push(p);
    const wheelHits=(lines: readonly Segment[])=>samples.some(q=>wheelPolygons(q).some(w=>lines.some(l=>touches(w,l))));
    if(isParkingCourse(course)){
      const forward=p.speed>PARK_DIRECTION_EPS, reverse=p.speed < -PARK_DIRECTION_EPS;
      // Reference checks direction first, before timers, walls and parking state.
      if(course.direction==='parallel'){
        if(reverse)this.reversed=true;
        const zone=course.parkZone;
        // Low-speed bay adjustments are still parking, not irreversible exit.
        if(this.parkCount>0&&forward&&!corners.every(c=>c.x>=zone.minX&&c.x<=zone.maxX&&c.z>=zone.minZ&&c.z<=zone.maxZ))this.forwardAfterParked=true;
        if(this.reversed&&this.parkCount===0&&forward)return this.fail('倒车后入库前不得前进，考试不合格');
        if(this.forwardAfterParked&&reverse)return this.fail('出库后不得再倒车，考试不合格');
      }else if(forward||reverse){
        const current=forward?'前进':'倒车';
        if(current===phases[this.dirPhase])this.dirPhaseStarted=true;
        else if(this.dirPhaseStarted&&this.dirPhase<phases.length-1&&current===phases[this.dirPhase+1]){
          if(reverse){
            const control=course.reverseControlLines?.[this.dirPhase===0?0:1];
            if(control){const [a,b]=control.segment,dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
              const fronts=wheelPolygons(p).slice(0,2).map(poly=>({x:poly.reduce((n,q)=>n+q.x,0)/4,z:poly.reduce((n,q)=>n+q.z,0)/4}));
              if(!fronts.every(q=>{const t=((q.x-a.x)*dx+(q.z-a.z)*dz)/len;return (q.x-a.x)*control.normal.x+(q.z-a.z)*control.normal.z>1e-7&&t>=0&&t<=1;}))return this.fail('倒车前两前轮未越过'+control.label+'，考试不合格');
            }
          }
          this.dirPhase++;this.dirPhaseStarted=true;
        }else return this.fail('操作顺序错误，考试不合格');
      }
      if(this.startedW){
        this.totalElapsed=Math.min(TOTAL_LIMIT,this.totalElapsed+dt);
        if(this.totalElapsed>=TOTAL_LIMIT)return this.fail('30 秒内未完成，考试不合格');
        const zone=course.parkZone;
        const inZone=corners.every(c=>c.x>=zone.minX&&c.x<=zone.maxX&&c.z>=zone.minZ&&c.z<=zone.maxZ);
        if(Math.abs(p.speed)<PARK_STOP_EPS&&!inZone)this.outsideStopped=Math.min(OUTSIDE_STOP_LIMIT,this.outsideStopped+dt);
        if(this.outsideStopped>=OUTSIDE_STOP_LIMIT)return this.fail('中途停车超 2 秒，考试不合格');
      }
      if(course.direction==='strict'){
        // The road has an open right exit: keeping its decorative end at x=11
        // as a wall would reject the nose before the rear tires can clear x=9.
        const legal=(c:Point)=>course.roads.some((road,index)=>contains(road,c)||
          (index===0&&c.x>course.bounds.maxX&&c.z>=course.bounds.minZ&&c.z<=course.parkZone.minZ));
        const outside=samples.some(q=>{const body=bodyCorners(q);return body.some(c=>!legal(c))||course.boundaries.some(line=>body.some((a,i)=>intersects(a,body[(i+1)%4],...line)));});
        if(outside)return this.fail('车身越出道路或车库边界，考试不合格');
      }else{
        // Only a tire that truly leaves the road/bay union is an exit; touching
        // a marking retains its 10-point penalty and the bay mouth stays open.
        const legalTire=(w:Point[])=>w.some(c=>course.roads.some(road=>contains(road,c)));
        if(forward&&samples.some(q=>wheelPolygons(q).slice(0,2).some((w,i)=>!legalTire(w)&&(!previous||legalTire(wheelPolygons(previous)[i])))))return this.fail('前轮越出场地，考试不合格');
        const obstacles=course.penaltyLines.filter(l=>l.kind==='obstacle');
        for(const line of obstacles)if(samples.some(q=>touches(bodyCorners(q),line.segment)))return this.fail(line.reason);
        const edges=course.penaltyLines.filter(l=>l.kind==='marking').map(l=>l.segment);
        // The dashed bay opening is a guide, not a penalized boundary.
        const bodyNow=edges.some(hits),wheelNow=wheelPolygons(p).some(w=>edges.some(l=>touches(w,l)));
        if(Math.abs(p.speed)>=PARK_STOP_EPS){
          const bodySweep=samples.some(q=>edges.some(l=>touches(bodyCorners(q),l)));
          if(bodySweep&&!this.bodyContact){const result=this.deduct(10,'行驶中车身触边，扣10分');if(result)return result;}
          if(wheelHits(edges)&&!this.wheelContact){const result=this.deduct(10,'行驶中车轮压边，扣10分');if(result)return result;}
          this.bodyContact=bodyNow;this.wheelContact=wheelNow;
        }else{
          // A stop does not create a scored contact; an existing scored contact
          // remains continuous until geometry actually leaves the marking.
          this.bodyContact=this.bodyContact&&bodyNow;this.wheelContact=this.wheelContact&&wheelNow;
        }
      }
      const zone=course.parkZone;
      const inZone=corners.every(c=>c.x>=zone.minX&&c.x<=zone.maxX&&c.z>=zone.minZ&&c.z<=zone.maxZ);
      if(course.direction==='parallel'&&!this.forwardAfterParked){
        const nearBay=corners.some(c=>c.x>zone.minX&&c.z>zone.minZ&&c.z<zone.maxZ);
        if(reverse&&nearBay)this.parkingAttempt=true;
        if(this.parkingAttempt&&Math.abs(p.speed)<PARK_STOP_EPS&&!inZone)return this.fail('入库停车时车身出线，考试不合格');
      }
      const heading=Math.abs(Math.atan2(Math.sin(p.yaw-zone.heading),Math.cos(p.yaw-zone.heading)))<=zone.tolerance;
      const valid=inZone&&heading&&Math.abs(p.speed)<PARK_STOP_EPS;
      if(valid&&!this.parked){
        this.parked=true;
        const phase=course.direction==='parallel'?1:this.dirPhase;
        if((course.direction==='parallel'||(phase===1||phase===3)&&this.dirPhaseStarted)&&!this.countedParkPhases.has(phase)){
          this.countedParkPhases.add(phase);this.parkCount++;
        }
      }
      else if(!valid&&this.parked)this.parked=false;
      const complete=this.parkCount>=course.requiredParks&&(course.direction==='parallel'||this.dirPhase===4&&this.dirPhaseStarted);
      if(this.finished(p,corners,!complete))
        return complete?this.result(true,course.passReason):this.fail(course.notParkedReason);
      return null;
    }
    if(wheelHits(course.boundaries))return this.fail('车辆越出边界线');
    if(this.finished(p,corners))return this.result(true,course.passReason);
    return null;
  }
}
