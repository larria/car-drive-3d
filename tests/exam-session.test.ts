import { describe,it,expect,vi } from 'vitest';
import { ExamSession } from '../src/exam-session';
import { ExamRules } from '../src/exam-rules';
import { COURSES } from '../src/courses';
const pose={x:0,z:0,yaw:0,speed:1,throttle:true};
function finish(s:ExamSession,score=100,passed=true){vi.spyOn(s.rules,'step').mockReturnValueOnce({passed,score,reason:'回放结果',deductions:score<100?[{points:10,reason:'接触',elapsed:1}]:[]});s.step(pose);}
describe('series lifecycle (rule-result replay, not driving)',()=>{
 it('requires confirmation, inherits exactly 80, archives once and ends only after four',()=>{
  const s=new ExamSession();s.selectSeries();s.start();
  for(let i=0;i<4;i++){expect(s.course).toBe(COURSES[i]);finish(s,80);s.step(pose);expect(s.ledger).toHaveLength(i+1);expect(s.state).toBe('result');if(i<3){expect(s.hasNext).toBe(true);expect(s.next()).toBe(true);expect(s.state).toBe('briefing');expect(s.rules.score).toBe(80);s.start();expect(s.rules.score).toBe(80);}}
  expect(s.hasNext).toBe(false);expect(s.next()).toBe(false);expect(s.cumulativeScore).toBe(80);
 });
 it('pauses current project, restarts entire round, clears exit/practice',()=>{const s=new ExamSession();s.selectSeries();s.start();finish(s,90);s.next();s.start();s.pause();s.step(pose);expect(s.projectIndex).toBe(1);s.resume();s.retry();expect(s.projectIndex).toBe(0);expect(s.rules.score).toBe(100);expect(s.ledger).toEqual([]);s.exit();expect(s.scope).toBe('single');expect(s.state).toBe('projects');s.selectPractice();expect(s.mode).toBe('practice');});
 it('inherited 90 tolerates one contact at 80 but second fails immediately',()=>{
  const base=COURSES[2];if(!('penaltyLines' in base))throw new Error('parking course required');
  const course={...base,roads:[[{x:-10,z:-30},{x:10,z:-30},{x:10,z:30},{x:-10,z:30}]],penaltyLines:[{segment:[{x:.85,z:-20},{x:.85,z:20}] as const,reason:'边线',kind:'marking' as const}]};
  const r=new ExamRules(course,90);expect(r.step(pose)).toMatchObject({passed:false,score:70});expect(r.deductions).toHaveLength(2);
  const exact=new ExamRules(course,100);expect(exact.step(pose)).toBeNull();expect(exact.score).toBe(80);expect(exact.step(pose)).toBeNull();expect(exact.deductions).toHaveLength(2);
 });
 it('start is only allowed from briefing and cannot erase live deductions',()=>{const s=new ExamSession();s.selectSeries();s.start();s.rules.score=80;s.start();expect(s.rules.score).toBe(80);s.pause();s.start();expect(s.state).toBe('paused');expect(s.rules.score).toBe(80);s.retry();expect(s.state).toBe('running');expect(s.rules.score).toBe(100);});
 it('failure cannot advance',()=>{const s=new ExamSession();s.selectSeries();s.start();finish(s,70,false);expect(s.hasNext).toBe(false);expect(s.next()).toBe(false);expect(s.state).toBe('result');});
 it('explicit score reset never defaults inherited score back to 100',()=>{const r=new ExamRules(COURSES[2],80);expect(r.score).toBe(80);r.reset(90);expect(r.score).toBe(90);expect(r.deductions).toEqual([]);expect(()=>r.reset(NaN)).toThrow();});
 it('strict initial parking and unattempted parallel parking do not glow',()=>{for(const course of COURSES.slice(2)){const r=new ExamRules(course);if(!('parkZone' in course))continue;const z=course.parkZone;r.step({x:(z.minX+z.maxX)/2,z:(z.minZ+z.maxZ)/2,yaw:z.heading,speed:0,throttle:false});expect(r.parkingFeedback).toBe(false);r.reset();expect(r.parkingFeedback).toBe(false);}});
});
