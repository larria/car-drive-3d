import { describe, it, expect } from 'vitest';
import { ExamRules, bodyCorners, type ExamPose } from '../src/exam-rules';
import { RIGHT_ANGLE } from '../src/courses/right-angle';
import { S_CURVE } from '../src/courses/s-curve';
import { PARALLEL_PARKING } from '../src/courses/parallel-parking';
import { REVERSE_GARAGE } from '../src/courses/reverse-garage';
import type { DrivingCourse } from '../src/courses/course-definition';
const course:DrivingCourse={...RIGHT_ANGLE,boundaries:[],finish:[{x:0,z:-2},{x:0,z:2}],finishExitNormal:{x:1,z:0}};
const pose=(x:number,z=0,yaw=-Math.PI/2):ExamPose=>({x,z,yaw,speed:1,throttle:false});
// Model-matched rear wheel center 1.495m behind the origin, radius .35m.
const rearClearance=1.495+.35;
describe('finite outward rear-wheel finish traversal',()=>{
 it('clears front-wheel evidence when required parks switch finish to rear wheels',()=>{
  const parking={...PARALLEL_PARKING,finish:course.finish,finishExitNormal:course.finishExitNormal,penaltyLines:[],roads:[[{x:-20,z:-20},{x:20,z:-20},{x:20,z:20},{x:-20,z:20}]]};
  const r=new ExamRules(parking);expect(r.step(pose(-3))).toBeNull();expect(r.step(pose(-1))?.passed).toBe(false);
  r.parkCount=1;expect(r.step(pose(3))).toBeNull();expect(r.step(pose(-3))).toBeNull();expect(r.step(pose(3))?.passed).toBe(true);
 });
 it('declares explicit exit normals for all four courses',()=>{
  expect(RIGHT_ANGLE.finishExitNormal).toEqual({x:1,z:0});
  expect(REVERSE_GARAGE.finishExitNormal).toEqual({x:1,z:0});
  expect(S_CURVE.finishExitNormal).toEqual({x:0,z:-1});
  expect(PARALLEL_PARKING.finishExitNormal).toEqual({x:0,z:-1});
 });
 it('waits for both complete rear wheel projections, including exact contact',()=>{
  const r=new ExamRules(course);
  for(const x of [-3,-2.05,0,1.495,rearClearance])expect(r.step(pose(x))).toBeNull();
  const exit=pose(rearClearance+.00001);
  expect(bodyCorners(exit).some(p=>p.x<0)).toBe(true);
  expect(r.step(exit)?.passed).toBe(true);
 });
 it('does not pass while the yawed trailing rear wheel is still inside',()=>{
  const r=new ExamRules(course),yaw=-Math.PI/4;
  // Farther rear center is (1.495+.82)/sqrt(2) inside the origin;
  // its rotated tire projects another (.35+.11)/sqrt(2) along X.
  const threshold=(1.495+.82+.35+.11)/Math.sqrt(2);
  expect(r.step(pose(-3,0,yaw))).toBeNull();
  expect(r.step(pose(1.5,0,yaw))).toBeNull();
  expect(r.step(pose(threshold-.00001,0,yaw))).toBeNull();
  expect(r.step(pose(threshold+.00001,0,yaw))?.passed).toBe(true);
 });
 it('detects real rear wheel projections during a one-step jump',()=>{
  const r=new ExamRules(course);expect(r.step(pose(-4))).toBeNull();expect(r.step(pose(4))?.passed).toBe(true);
 });
 it('rejects a narrow line between rear tires, not a fictitious axle crossing',()=>{
  const narrow={...course,finish:[{x:0,z:-.05},{x:0,z:.05}] as DrivingCourse['finish']};
  const r=new ExamRules(narrow);expect(r.step(pose(-4))).toBeNull();expect(r.step(pose(4))).toBeNull();
 });
 it('detects a finite line within the tire width between corner trajectories',()=>{
  const narrow={...course,finish:[{x:0,z:.80},{x:0,z:.84}] as DrivingCourse['finish']};
  const r=new ExamRules(narrow);expect(r.step(pose(-4))).toBeNull();expect(r.step(pose(4))?.passed).toBe(true);
 });
 it('tracks actual rear wheel arcs during rotation without center translation',()=>{
  const r=new ExamRules(course);expect(r.step(pose(1.5,0,-Math.PI/2))).toBeNull();
  expect(r.step(pose(1.5,0,-.1))?.passed).toBe(true);
 });
 it('uses the shortest yaw path across the angle wrap',()=>{
  const wrapped=new ExamRules(course),unwrapped=new ExamRules(course);
  wrapped.step(pose(-3,0,Math.PI-.1));unwrapped.step(pose(-3,0,Math.PI-.1));
  expect(wrapped.step(pose(3,0,-Math.PI+.1))).toEqual(unwrapped.step(pose(3,0,Math.PI+.1)));
  expect(wrapped.step(pose(3,0,-Math.PI+.1))?.passed).toBe(true);
 });
 it('rejects tiny reverse deadband rear-first traversal and wrong heading',()=>{
  for(const speed of [-.001,0,1]){const r=new ExamRules({...course,rules:{...course.rules,noStopAfterGo:false}});r.step(pose(-4,0,Math.PI/2));expect(r.step({...pose(4,0,Math.PI/2),speed})).toBeNull();}
  const r=new ExamRules({...course,rules:{...course.rules,noStopAfterGo:false}});r.step(pose(-4));expect(r.step({...pose(4),speed:-.001})).toBeNull();
 });
 it('rejects first samples beyond finish, inward motion and extension-only crossings',()=>{
  const r=new ExamRules(course);expect(r.step(pose(4))).toBeNull();expect(r.step(pose(-4))).toBeNull();
  r.reset();expect(r.step(pose(-4,5))).toBeNull();expect(r.step(pose(4,5))).toBeNull();
  expect(r.step(pose(4,0))).toBeNull();
 });
 it('cannot reuse crossing evidence after reset or a full return inside',()=>{
  const r=new ExamRules(course);r.step(pose(-4));r.step(pose(1.5));r.reset();expect(r.step(pose(4))).toBeNull();
  r.step(pose(-4));r.step(pose(1.5));r.step(pose(-4));
  r.step(pose(-4,5));expect(r.step(pose(4,5))).toBeNull();
 });
 it('keeps wheel-boundary and reverse failures ahead of an otherwise completed exit',()=>{
  const r=new ExamRules({...course,boundaries:[[{x:4,z:-2},{x:4,z:2}]]});
  r.step(pose(-4));expect(r.step(pose(4))?.reason).toContain('边界');
  const reverse=new ExamRules(course);reverse.step(pose(-4));expect(reverse.step({...pose(4),speed:-1})?.reason).toContain('倒车');
 });
});
