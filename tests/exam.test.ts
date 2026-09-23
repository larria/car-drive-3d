import { describe, it, expect } from 'vitest';
import { RIGHT_ANGLE, rightAngle } from '../src/courses/right-angle';
import { ExamRules, intersects, STOP_EPS, REVERSE_EPS, type ExamPose } from '../src/exam-rules';
import { ExamSession } from '../src/exam-session';
import { DrivingPhysics } from '../src/physics';
const pose=(extra:Partial<ExamPose>={}):ExamPose=>({x:0,z:9,yaw:0,speed:0,throttle:false,...extra});
describe('reference right-angle rules',()=>{
 it('uses wheelbase-derived dimensions and only four boundaries',()=>{expect(RIGHT_ANGLE.width).toBe(3.65);expect(rightAngle(3).width).toBe(4);expect(RIGHT_ANGLE.boundaries).toHaveLength(4);expect(RIGHT_ANGLE.polygon).toHaveLength(6);});
 it('waits before throttle, latches any throttle, permits coasting and exact stop threshold',()=>{const r=new ExamRules();expect(r.step(pose())).toBeNull();r.step(pose({throttle:true}));expect(r.step(pose({speed:STOP_EPS}))).toBeNull();expect(r.step(pose({speed:STOP_EPS-.000001}))?.reason).toContain('停车');});
 it('uses strict reverse threshold',()=>{const r=new ExamRules();expect(r.step(pose({speed:-REVERSE_EPS}))).toBeNull();expect(r.step(pose({speed:-REVERSE_EPS-.000001}))?.reason).toContain('倒车');});
 it('rejects endpoints and collinear contact',()=>{const p=(x:number,z:number)=>({x,z});expect(intersects(p(0,0),p(2,0),p(1,-1),p(1,1))).toBe(true);expect(intersects(p(0,0),p(2,0),p(2,0),p(2,1))).toBe(false);expect(intersects(p(0,0),p(2,0),p(1,0),p(3,0))).toBe(false);});
 it('prioritizes reverse over boundaries, boundaries over finish',()=>{const r=new ExamRules();expect(r.step(pose({x:1,z:5,speed:-1}))?.reason).toContain('倒车');expect(r.step(pose({x:11,z:0,yaw:-Math.PI/2,speed:1}))?.reason).toContain('边界');expect(r.step(pose({x:10,z:-1.825,yaw:-Math.PI/2,speed:1}))?.passed).toBe(true);});
 it('freezes paused and result states and cleans retry',()=>{const s=new ExamSession();s.select();s.start();s.step(pose({throttle:true,speed:1}));s.pause();s.step(pose());expect(s.result).toBeNull();s.resume();s.step(pose());expect(s.state).toBe('result');s.step(pose({throttle:true}));expect(s.state).toBe('result');s.start();expect(s.rules.startedW).toBe(false);expect(s.result).toBeNull();});
 it('fixed substeps agree across rendering cadences and stop immediately',()=>{const a=new DrivingPhysics(),b=new DrivingPhysics();for(let i=0;i<120;i++)a.update(1/60,{throttle:1,brake:0,steer:0});for(let i=0;i<40;i++)b.update(1/20,{throttle:1,brake:0,steer:0});expect(a.chassis.position.z).toBeCloseTo(b.chassis.position.z,9);let steps=0;a.update(.05,{throttle:1,brake:0,steer:0},()=>{steps++;return false;});expect(steps).toBe(1);});
});
