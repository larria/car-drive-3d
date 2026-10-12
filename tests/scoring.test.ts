import { describe,it,expect } from 'vitest';
import { ExamRules,wheelPolygons,type ExamPose } from '../src/exam-rules';
import { RIGHT_ANGLE } from '../src/courses/right-angle';
import { PARALLEL_PARKING } from '../src/courses/parallel-parking';
import { REVERSE_GARAGE } from '../src/courses/reverse-garage';
const pose=(p:Partial<ExamPose>={}):ExamPose=>({x:0,z:0,yaw:0,speed:1,throttle:false,...p});
describe('user scoring and simulated tire geometry',()=>{
 it('fails a diagonal forward front-tire exit but preserves the open bay',()=>{
  const r=new ExamRules(PARALLEL_PARKING);expect(r.step(pose({x:0,z:7,yaw:.5}))).toBeNull();expect(r.step(pose({x:-4,z:4,yaw:.5}))).toMatchObject({passed:false,score:0,reason:'前轮越出场地，考试不合格'});
  const bay=new ExamRules(PARALLEL_PARKING);expect(bay.step(pose({x:2.2,z:0,speed:0}))).toBeNull();
 });
 it('allows body-only sweeps but fails wheel contact in driving courses',()=>{
  const course={...RIGHT_ANGLE,boundaries:[[{x:-2,z:-1.8},{x:2,z:-1.8}]] as typeof RIGHT_ANGLE.boundaries};
  expect(new ExamRules(course).step(pose())).toBeNull();
  const r=new ExamRules({...course,boundaries:[[{x:-2,z:-1.155},{x:2,z:-1.155}]]});
  expect(r.step(pose())).toMatchObject({passed:false,score:0});expect(r.deductions[0].points).toBe(100);
 });
 it('classifies geometry explicitly rather than by penalty wording',()=>{
  expect(PARALLEL_PARKING.penaltyLines.map(l=>l.kind)).toEqual(['marking','marking','marking','marking','obstacle','obstacle']);
  expect(REVERSE_GARAGE.penaltyLines.every(l=>l.kind==='marking')).toBe(true);
  const course={...PARALLEL_PARKING,roads:[[{x:-10,z:-30},{x:10,z:-30},{x:10,z:30},{x:-10,z:30}]],penaltyLines:[{segment:[{x:.85,z:-20},{x:.85,z:20}] as const,reason:'碰擦但只是标线',kind:'marking' as const}]};
  const r=new ExamRules(course);expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
 });
 it('preserves continuous contact through a stop without suppressing newly entering motion',()=>{
  const course={...PARALLEL_PARKING,roads:[[{x:-10,z:-30},{x:10,z:-30},{x:10,z:30},{x:-10,z:30}]],penaltyLines:[{segment:[{x:.85,z:-20},{x:.85,z:20}] as const,reason:'边线',kind:'marking' as const}]};
  const r=new ExamRules(course);r.step(pose());r.step(pose({speed:0}));expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
  r.reset();r.step(pose({x:-2,speed:0}));expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
  r.reset();r.step(pose({speed:0}));expect(r.score).toBe(100);expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
 });
 it('uses optional actual steering without changing rear tire geometry',()=>{
  const base=wheelPolygons(pose()),turned=wheelPolygons(pose({steering:.7}));
  expect(turned[0]).not.toEqual(base[0]);expect(turned.slice(2)).toEqual(base.slice(2));
 });
 it('deducts both categories once continuously, rearms after leaving, and resets',()=>{
  const course={...PARALLEL_PARKING,roads:[[{x:-10,z:-30},{x:10,z:-30},{x:10,z:30},{x:-10,z:30}]],penaltyLines:[{segment:[{x:.85,z:-20},{x:.85,z:20}] as const,reason:'车辆越出边界线',kind:'marking' as const}]};
  const r=new ExamRules(course);
  expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);expect(r.deductions).toHaveLength(2);
  for(let i=0;i<20;i++)expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
  r.step(pose({x:-2}));expect(r.step(pose())).toMatchObject({passed:false,score:70});
  r.reset();expect(r.score).toBe(100);expect(r.deductions).toEqual([]);expect(r.step(pose())).toBeNull();expect(r.score).toBe(80);
 });
 it('does not accept initial/outbound stops as parking but fails an incomplete reverse arrival',()=>{
  const r=new ExamRules(PARALLEL_PARKING);expect(r.step(pose({...PARALLEL_PARKING.start,speed:0}))).toBeNull();
  r.reset();r.step(pose({x:2,z:0,speed:-1}));expect(r.step(pose({x:2,z:0,speed:0}))).toMatchObject({passed:false,score:0,reason:'入库停车时车身出线，考试不合格'});
  r.reset();r.parkCount=1;r.forwardAfterParked=true;expect(r.step(pose({x:0,z:-6,speed:0}))).toBeNull();
 });
 it('requires both front contact centers beyond the corresponding simulated line',()=>{
  const r=new ExamRules(REVERSE_GARAGE);r.step(pose({x:3,z:0,yaw:-Math.PI/2}));
  expect(r.step(pose({x:3,z:0,yaw:-Math.PI/2,speed:-1}))?.reason).toContain('右模拟控制线');
  r.reset();r.step(pose({x:5,z:0,yaw:-Math.PI/2}));expect(r.step(pose({x:5,z:0,yaw:-Math.PI/2,speed:-1}))).toBeNull();
  r.step(pose({x:5,z:0,yaw:-Math.PI/2}));expect(r.step(pose({x:5,z:0,yaw:-Math.PI/2,speed:-1}))?.reason).toContain('左模拟控制线');
  r.reset();expect(r.dirPhase).toBe(0);
 });
 it('rejects completely outside garage bodies and keeps the bay opening usable',()=>{
  expect(new ExamRules(REVERSE_GARAGE).step(pose({x:0,z:-10,speed:0}))).toMatchObject({passed:false,score:0});
  expect(new ExamRules(REVERSE_GARAGE).step(pose({x:0,z:3.35,speed:0}))).toBeNull();
 });
});
