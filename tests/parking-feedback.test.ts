import { describe, it, expect } from 'vitest';
import { ExamRules, type ExamPose } from '../src/exam-rules';
import { ParkingFeedback } from '../src/parking-feedback';
import { PARALLEL_PARKING as parallel } from '../src/courses/parallel-parking';
import { REVERSE_GARAGE as garage } from '../src/courses/reverse-garage';
const p:ExamPose={x:(parallel.parkZone.minX+parallel.parkZone.maxX)/2,z:0,yaw:0,speed:0,throttle:false};
describe('parking presentation and pure progress',()=>{
 it('does not count an idle initial bay, captures once, retains micro-motion, clears real exit',()=>{
  const r=new ExamRules(parallel),f=new ParkingFeedback();
  r.step(p);expect(r.parkCount).toBe(0);expect(f.capture(r)).toBeNull();expect(r.parkingFullyInside).toBe(true);
  r.step({...p,speed:-.1});f.capture(r);r.step(p);
  expect(f.capture(r)).toMatchObject({index:1,total:1});expect(r.parkingStep?.index).toBe(3);
  r.step({...p,z:.01,speed:-.1});expect(r.parkingFeedback).toBe(false);expect(f.capture(r)).toBeNull();expect(f.active).toBe(true);
  r.step(p);expect(f.capture(r)).toBeNull();expect(r.parkCount).toBe(1);
  r.step({...p,x:parallel.parkZone.minX+.8,speed:.1});f.capture(r);expect(f.active).toBe(false);
 });
 it('clears on failure, reset, replacement, and never affects timers or score',()=>{
  const r=new ExamRules(parallel),f=new ParkingFeedback();r.step({...p,speed:-.1});f.capture(r);r.step(p);f.capture(r);
  const score=r.score,time=r.totalElapsed;expect(f.active).toBe(true);expect(r.score).toBe(score);expect(r.totalElapsed).toBe(time);
  f.capture(r,{passed:false,reason:'failure',score:0,deductions:[]});expect(f.active).toBe(false);
  r.reset();f.capture(r);expect(f.active).toBe(false);expect(r.parkingFullyInside).toBe(false);
  f.capture(new ExamRules(garage));expect(f.active).toBe(false);
 });
 it('uses both actual front-wheel centres for control readiness, not direction input',()=>{
  const r=new ExamRules(garage),start={...p,x:garage.start.x,z:garage.start.z,yaw:garage.startYaw,speed:1};
  r.step(start);expect(r.parkingStep?.index).toBe(1);
  r.step({...start,x:7});expect(r.parkingStep?.index).toBe(2);
  r.step({...start,x:0});expect(r.parkingStep?.index).toBe(1);
  r.reset();expect(r.parkingStep).toMatchObject({index:1,total:6});
 });
 it('captures separate reverse phases once, even when several steps occur in one render frame',()=>{
  const course={...garage,reverseControlLines:undefined,boundaries:[],roads:[[{x:-20,z:-20},{x:20,z:-20},{x:20,z:20},{x:-20,z:20}]]};
  const r=new ExamRules(course),f=new ParkingFeedback(),bay={...p,x:0,z:(garage.parkZone.minZ+garage.parkZone.maxZ)/2};
  const events=[];
  for(const speed of [1,-1,0,-.1,0,1,-1,0,-.1]){r.step({...bay,speed});const event=f.capture(r);if(event)events.push(event);}
  expect(events.map(e=>e.index)).toEqual([1,2]);expect(r.parkCount).toBe(2);expect(f.active).toBe(true);
 });
});
