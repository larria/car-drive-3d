import { describe,it,expect } from 'vitest';
import { S_CURVE as s } from '../src/courses/s-curve';
import { RIGHT_ANGLE } from '../src/courses/right-angle';
import { ExamRules, type ExamPose } from '../src/exam-rules';
import { ExamSession } from '../src/exam-session';
const distance=(a:{x:number;z:number},b:{x:number;z:number})=>Math.hypot(a.x-b.x,a.z-b.z);
const pose=(extra:Partial<ExamPose>={}):ExamPose=>({...s.start,yaw:0,speed:0,throttle:false,...extra});
describe('reference S geometry',()=>{
 it('has 48 samples per arc, 97 joined arc points, 99 extended points per side and 196 open boundaries',()=>{
  expect(s.center).toHaveLength(99);expect(s.sideA).toHaveLength(99);expect(s.sideB).toHaveLength(99);expect(s.polygon).toHaveLength(198);expect(s.boundaries).toHaveLength(196);
  expect(s.boundaries.some(([a,b])=>a===s.sideA[0]&&b===s.sideB[0])).toBe(false);
 });
 it('retains radii, width and full precision reflected circle center',()=>{
  for(let i=1;i<=49;i++){expect(distance(s.center[i],s.o1)).toBeCloseTo(7.5,12);expect(distance(s.sideA[i],s.o1)).toBeCloseTo(5.75,12);expect(distance(s.sideB[i],s.o1)).toBeCloseTo(9.25,12);}
  for(let i=49;i<=97;i++){expect(distance(s.center[i],s.o2)).toBeCloseTo(7.5,12);expect(distance(s.sideA[i],s.o2)).toBeCloseTo(9.25,12);expect(distance(s.sideB[i],s.o2)).toBeCloseTo(5.75,12);}
  for(let i=0;i<99;i++)expect(distance(s.sideA[i],s.sideB[i])).toBeCloseTo(3.5,12);
  expect(s.o2.x).toBeCloseTo(7.5+15/Math.sqrt(2),12);expect(s.o2.z).toBeCloseTo(8-15/Math.sqrt(2),12);
  expect(distance(s.center[48],s.center[49])).toBeCloseTo(distance(s.center[49],s.center[50]),12);
 });
 it('extends along sampled chords, not ideal tangents, and keeps independent finish',()=>{
  expect(distance(s.center[0],s.center[1])).toBeCloseTo(2,12);expect(distance(s.center[97],s.center[98])).toBeCloseTo(3,12);
  expect(s.center[0].x).toBeLessThan(0);expect(s.center[98].x).toBeGreaterThan(s.center[97].x);
  for(const [a,b,c] of [[s.center[0],s.center[1],s.center[2]],[s.center[96],s.center[97],s.center[98]]])expect((b.x-a.x)*(c.z-b.z)-(b.z-a.z)*(c.x-b.x)).toBeCloseTo(0,12);
  expect(s.finish).toEqual([{x:23.8566,z:-5.6066},{x:27.3566,z:-5.6066}]);expect(s.finish[0]).not.toEqual(s.sideA[98]);
  expect(s.start).toEqual({x:0,z:9.5});expect(s.startMark).toEqual([{x:-1.75,z:9.5},{x:1.75,z:9.5}]);
 });
 it('bounds include every road and marking point',()=>{for(const p of [...s.polygon,...s.center,...s.finish,...s.startMark]){expect(p.x).toBeGreaterThanOrEqual(s.bounds.minX);expect(p.x).toBeLessThanOrEqual(s.bounds.maxX);expect(p.z).toBeGreaterThanOrEqual(s.bounds.minZ-.001);expect(p.z).toBeLessThanOrEqual(s.bounds.maxZ);}});
});
describe('S rules and session isolation',()=>{
 it('waits then rejects reverse and stop, allows coasting',()=>{const r=new ExamRules(s);expect(r.step(pose())).toBeNull();expect(r.step(pose({speed:-.005}))?.reason).toContain('倒车');r.reset();expect(r.step(pose({throttle:true}))).toBeNull();expect(r.step(pose({speed:.5}))).toBeNull();expect(r.step(pose()))?.toMatchObject({passed:false,reason:'中途停车，考试不合格'});});
 it('fails crossing, prioritizes boundary over independent finish and passes correct finish',()=>{
  expect(new ExamRules(s).step(pose({x:1,z:8,speed:1}))?.reason).toContain('边界');
  expect(new ExamRules(s).step(pose({x:23.9,z:-4.8,speed:1}))?.reason).toContain('边界');
  expect(new ExamRules(s).step(pose({x:25.6066,z:-4.5,speed:1}))).toEqual({passed:true,reason:s.passReason});
 });
 it('retry preserves course, pause freezes rules, switching drops latch and old result',()=>{
  const session=new ExamSession();session.select(s);session.start();session.step(pose({throttle:true,speed:1}));session.pause();session.step(pose());expect(session.result).toBeNull();session.resume();session.step(pose());expect(session.result?.passed).toBe(false);
  session.start();expect(session.course).toBe(s);expect(session.rules.startedW).toBe(false);expect(session.result).toBeNull();session.exit();session.select(RIGHT_ANGLE);expect(session.rules.course).toBe(RIGHT_ANGLE);expect(session.rules.step({...pose(),z:9})).toBeNull();session.select(s);expect(session.rules.course).toBe(s);expect(session.result).toBeNull();
 });
});
