import { describe, it, expect } from 'vitest';
import { PARALLEL_PARKING, parallelParking } from '../src/courses/parallel-parking';
import { REVERSE_GARAGE, reverseGarage } from '../src/courses/reverse-garage';
import { ExamRules, PARK_DIRECTION_EPS, PARK_STOP_EPS, type ExamPose } from '../src/exam-rules';
import { ExamSession } from '../src/exam-session';
import { VEHICLE } from '../src/vehicle-config';
const parallel = PARALLEL_PARKING, garage=REVERSE_GARAGE;
const pose=(p:Partial<ExamPose>={}):ExamPose=>({x:0,z:0,yaw:0,speed:0,throttle:false,...p});
const parkedParallel=()=>pose({x:(parallel.parkZone.minX+parallel.parkZone.maxX)/2,z:0});
const parkedGarage=()=>pose({x:0,z:(garage.parkZone.minZ+garage.parkZone.maxZ)/2});
const startParallel=()=>pose({x:parallel.start.x,z:parallel.start.z});
const startGarage=()=>pose({x:garage.start.x,z:garage.start.z,yaw:garage.startYaw});

describe('reference parking field data, not inferred driving-exam rules',()=>{
 it('builds vehicle-dependent parallel dimensions and open walls in exact reference order',()=>{
  const L=VEHICLE.length*1.5+1,B1=VEHICLE.width+.8,B2=VEHICLE.width*1.5+.8;
  expect(parallel.parkZone).toMatchObject({minX:B2/2,maxX:B2/2+B1,minZ:-L/2,maxZ:L/2,heading:0});
  expect(parallel.start).toEqual({x:0,z:L/2+3.5});expect(parallel.finish).toEqual([{x:-B2/2,z:-L/2-6},{x:B2/2,z:-L/2-6}]);
  expect(parallel.roads).toHaveLength(2);expect(parallel.roads[0]).toHaveLength(4);expect(parallel.roads[0][0].z).toBe(-15);
  expect(parallel.penaltyLines).toHaveLength(6);
  expect(parallel.penaltyLines.map(p=>p.reason)).toEqual(['车辆越出边界线','车辆越出边界线','车辆越出边界线','车辆越出边界线','碰擦前车，考试不合格','碰擦后车，考试不合格']);
  expect(parallel.guides).toEqual([[{x:B2/2,z:-L/2},{x:B2/2,z:L/2}]]);
  expect(parallelParking(5,2).parkZone.maxX).toBeCloseTo(4.7);
  expect(parallelParking(5,2).parkZone).toMatchObject({minX:1.9,minZ:-4.25,maxZ:4.25});
 });
 it('preserves garage widths, six wall reasons, start yaw, open door and no fictitious D wall',()=>{
  expect(garage.parkZone).toMatchObject({minX:-1.15,maxX:1.15,minZ:3.35,heading:0});
  expect(garage.parkZone.maxZ).toBeCloseTo(3.35+VEHICLE.length+.7);
  expect(garage.roads[0]).toEqual([{x:-11,z:-3.35},{x:11,z:-3.35},{x:11,z:3.35},{x:-11,z:3.35}]);
  expect(garage.start).toEqual({x:-7.5,z:0});expect(garage.startYaw).toBe(-Math.PI/2);
  expect(garage.startMark[0].x).toBe(-8);expect(garage.finish[0].x).toBe(9);
  expect(garage.penaltyLines.map(p=>p.reason)).toEqual(['车辆越出边界线','车辆越出边界线','车辆越出边界线','碰擦库侧边，考试不合格','碰擦库侧边，考试不合格','碰擦库底，考试不合格']);
  expect(garage.guides[0]).toEqual([{x:-1.15,z:3.35},{x:1.15,z:3.35}]);
  expect(reverseGarage(5).parkZone.maxZ).toBeCloseTo(9.05);
 });
});

describe('reference parking checks at a fixed 60Hz',()=>{
 it('latches throttle for timers, freezes before first press and after pause/result',()=>{
  const s=new ExamSession();s.select(parallel);s.start();for(let i=0;i<90;i++)s.step(startParallel());expect(s.rules.totalElapsed).toBe(0);
  s.step({...startParallel(),throttle:true});
  expect(s.rules.totalElapsed).toBeCloseTo(1/60);
  s.pause();for(let i=0;i<150;i++)s.step(startParallel());expect(s.rules.totalElapsed).toBeCloseTo(1/60);
  s.resume();for(let i=0;i<20;i++)s.step(startParallel());expect(s.rules.outsideStopped).toBeCloseTo(21/60);
  s.start();expect(s.rules.totalElapsed).toBe(0);expect(s.rules.outsideStopped).toBe(0);expect(s.rules.startedW).toBe(false);
 });
 it('exempts a fully contained car from outside stop timer even when its heading is wrong',()=>{
  const r=new ExamRules(parallel),p=parkedParallel();r.step({...p,yaw:Math.PI,throttle:true});
  for(let i=0;i<90;i++)r.step({...p,yaw:Math.PI});expect(r.parkCount).toBe(0);expect(r.outsideStopped).toBe(0);
 });
 it('counts only whole body, inclusive zone edges, ±15° and stopped speed',()=>{
  const r=new ExamRules(parallel),p=parkedParallel();
  r.step({...p,x:parallel.parkZone.maxX-VEHICLE.width/2+.00001});expect(r.parkCount).toBe(0);
  r.step({...p,yaw:Math.PI/12+.000001});expect(r.parkCount).toBe(0);
  r.step({...p,speed:PARK_STOP_EPS});expect(r.parkCount).toBe(0);
  // The reference allows 15° by heading, but this car cannot physically fit
  // inside this bay at that angle; geometry is checked independently first.
  r.step({...p,yaw:Math.PI/12});expect(r.parkCount).toBe(0);
  r.step(p);expect(r.parkCount).toBe(1);
  r.step({...p,speed:PARK_STOP_EPS});expect(r.parked).toBe(false);
  r.step(p);expect(r.parkCount).toBe(2); // faithful reference: slight motion re-arms count
 });
 it('keeps parallel reversed/exit flags and checks actual speed, not gear or input',()=>{
  const r=new ExamRules(parallel);r.step({...startParallel(),speed:-PARK_DIRECTION_EPS});expect(r.reversed).toBe(false);
  r.step({...startParallel(),speed:-PARK_DIRECTION_EPS-.00001});expect(r.reversed).toBe(true);
  expect(r.step({...startParallel(),speed:PARK_DIRECTION_EPS+.001})?.reason).toContain('倒车后入库前');
  r.reset();r.step(parkedParallel());r.step({...parkedParallel(),speed:PARK_DIRECTION_EPS+.01});
  expect(r.step({...startParallel(),speed:-.5})?.reason).toContain('出库后不得再倒车');
 });
 it('permits garage strict forward-reverse-forward-reverse-forward and requires motion in prior phase',()=>{
  const r=new ExamRules(garage),p=startGarage();
  expect(r.step({...p,speed:-1})?.reason).toContain('操作顺序错误');r.reset();
  for(const [speed,phase] of [[1,0],[-1,1],[1,2],[-1,3],[1,4]] as const){expect(r.step({...p,speed})).toBeNull();expect(r.dirPhase).toBe(phase);}
  expect(r.step({...p,speed:-1})?.reason).toContain('操作顺序错误');
 });
 it('requires two separate garage parking episodes and ignores finish while speed is negative',()=>{
  const r=new ExamRules(garage),p=parkedGarage();r.step(p);expect(r.parkCount).toBe(1);
  r.step({...p,speed:PARK_STOP_EPS});expect(r.parked).toBe(false);r.step(p);expect(r.parkCount).toBe(2);
  const finish=pose({x:9,z:0,yaw:-Math.PI/2,speed:-.001});expect(r.step(finish)).toBeNull();
  expect(r.step({...finish,speed:0})?.passed).toBe(true);
  r.reset();expect(r.step({...finish,speed:0})?.reason).toContain('两次入库');
 });
 it('stops on cumulative outside 2s, not 2s of one continuous stop',()=>{
  const r=new ExamRules(parallel),p=startParallel();r.step({...p,throttle:true});
  for(let i=0;i<59;i++)expect(r.step(p)).toBeNull();
  r.step({...p,speed:.4});for(let i=0;i<59;i++)expect(r.step(p)).toBeNull();
  expect(r.outsideStopped).toBeCloseTo(119/60);
  for(let i=0;i<2;i++)if(r.step(p)?.reason?.includes('停车超 2 秒'))return;
  throw new Error('Cumulative parking timer did not expire at 2 seconds');
 });
 it('30s and direction checks precede wall and finish checks in the same substep',()=>{
  const r=new ExamRules(parallel),p=startParallel();r.totalElapsed=30-1/60;r.startedW=true;
  expect(r.step({...p,speed:1})?.reason).toContain('30 秒');
  r.reset();r.reversed=true;expect(r.step({...p,speed:1})?.reason).toContain('倒车后');
  r.reset();r.outsideStopped=2-1/60;r.startedW=true;expect(r.step(p)?.reason).toContain('停车超 2 秒');
  r.reset();expect(r.step({...p,x:parallel.parkZone.maxX,z:0})?.reason).toContain('边界线');
 });
 it('prioritizes short parking bay corners and fails finish without required parking',()=>{
  const r=new ExamRules(parallel);
  expect(r.step(pose({x:parallel.parkZone.minX+1,z:parallel.parkZone.minZ}))?.reason).toContain('前车');
  expect(r.step(pose({x:parallel.parkZone.minX+1,z:parallel.parkZone.maxZ}))?.reason).toContain('后车');
  expect(r.step(pose({x:0,z:parallel.finish[0].z}))?.reason).toContain('未完成侧方入库');
 });
 it('cleans counters, phases, timers and course ownership on four-course switching',async()=>{
  const {COURSES}=await import('../src/courses');const s=new ExamSession();for(const c of [...COURSES,...COURSES]){
   s.select(c);s.start();s.step(pose({x:c.start.x,z:c.start.z,yaw:c.startYaw,speed:1,throttle:true}));
   s.exit();expect(s.rules.course).toBe(c);expect(s.rules.totalElapsed).toBe(0);expect(s.rules.parkCount).toBe(0);expect(s.rules.dirPhase).toBe(0);
  }
 });
});
