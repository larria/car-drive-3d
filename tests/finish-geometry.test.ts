import { describe, it, expect } from 'vitest';
import { ExamRules, bodyCorners, type ExamPose } from '../src/exam-rules';
import { RIGHT_ANGLE } from '../src/courses/right-angle';
import { S_CURVE } from '../src/courses/s-curve';
import { PARALLEL_PARKING } from '../src/courses/parallel-parking';
import { REVERSE_GARAGE } from '../src/courses/reverse-garage';
import type { DrivingCourse } from '../src/courses/course-definition';
const course:DrivingCourse={...RIGHT_ANGLE,boundaries:[],finish:[{x:0,z:-2},{x:0,z:2}],finishExitNormal:{x:1,z:0}};
const pose=(x:number,z=0,yaw=-Math.PI/2):ExamPose=>({x,z,yaw,speed:1,throttle:false});
describe('finite outward finish traversal',()=>{
 it('declares explicit exit normals for all four courses',()=>{
  expect(RIGHT_ANGLE.finishExitNormal).toEqual({x:1,z:0});
  expect(REVERSE_GARAGE.finishExitNormal).toEqual({x:1,z:0});
  expect(S_CURVE.finishExitNormal).toEqual({x:0,z:-1});
  expect(PARALLEL_PARKING.finishExitNormal).toEqual({x:0,z:-1});
 });
 it('does not pass front contact, center crossing or rear contact',()=>{
  const r=new ExamRules(course);
  for(const x of [-3,-2.05,-2,0,2.05])expect(r.step(pose(x))).toBeNull();
  expect(r.step(pose(2.05001))?.passed).toBe(true);
 });
 it('uses all rotated corners rather than just center or nominal rear',()=>{
  const r=new ExamRules(course),yaw=-Math.PI/4;
  expect(r.step(pose(-3,0,yaw))).toBeNull();expect(r.step(pose(1.5,0,yaw))).toBeNull();
  expect(bodyCorners(pose(1.5,0,yaw)).some(p=>p.x<0)).toBe(true);
  expect(r.step(pose(3,0,yaw))?.passed).toBe(true);
 });
 it('detects a whole-body one-step jump across the finite finish',()=>{
  const r=new ExamRules(course);expect(r.step(pose(-4))).toBeNull();expect(r.step(pose(4))?.passed).toBe(true);
 });
 it('tracks a finite marking in the middle of an edge, between corner paths',()=>{
  const narrow={...course,finish:[{x:0,z:-.05},{x:0,z:.05}] as DrivingCourse['finish']};
  const r=new ExamRules(narrow);expect(r.step(pose(-4))).toBeNull();expect(r.step(pose(4))?.passed).toBe(true);
  const inward=new ExamRules(narrow);inward.step(pose(4));expect(inward.step(pose(-4))).toBeNull();
 });
 it('tracks outward corner arcs during rotation without center translation',()=>{
  const r=new ExamRules(course);expect(r.step(pose(1.5,0,-Math.PI/2))).toBeNull();
  expect(r.step(pose(1.5,0,0))?.passed).toBe(true);
 });
 it('uses the shortest yaw path across the angle wrap',()=>{
  const wrapped=new ExamRules(course),unwrapped=new ExamRules(course);
  wrapped.step(pose(-3,0,Math.PI-.1));unwrapped.step(pose(-3,0,Math.PI-.1));
  expect(wrapped.step(pose(3,0,-Math.PI+.1))).toEqual(unwrapped.step(pose(3,0,Math.PI+.1)));
  expect(wrapped.step(pose(3,0,-Math.PI+.1))?.passed).toBe(true);
 });
 it('rejects first samples beyond finish, inward motion and extension-only crossings',()=>{
  const r=new ExamRules(course);expect(r.step(pose(4))).toBeNull();expect(r.step(pose(-4))).toBeNull();
  r.reset();expect(r.step(pose(-4,5))).toBeNull();expect(r.step(pose(4,5))).toBeNull();
  expect(r.step(pose(4,0))).toBeNull();
 });
 it('cannot reuse crossing evidence after reset or a full return inside',()=>{
  const r=new ExamRules(course);r.step(pose(-4));r.step(pose(0));r.reset();expect(r.step(pose(4))).toBeNull();
  r.step(pose(-4));r.step(pose(0));r.step(pose(-4));
  r.step(pose(-4,5));expect(r.step(pose(4,5))).toBeNull();
 });
 it('keeps boundary and reverse failures ahead of an otherwise completed exit',()=>{
  const r=new ExamRules({...course,boundaries:[[{x:4,z:-2},{x:4,z:2}]]});
  r.step(pose(-4));expect(r.step(pose(4))?.reason).toContain('边界');
  const reverse=new ExamRules(course);reverse.step(pose(-4));expect(reverse.step({...pose(4),speed:-1})?.reason).toContain('倒车');
 });
});
