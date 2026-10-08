import { RIGHT_ANGLE } from './courses/right-angle';
import type { CourseDefinition } from './courses/course-definition';
import { ExamRules, type ExamPose, type ExamResult } from './exam-rules';
export type ExamState='projects'|'briefing'|'running'|'paused'|'result';
export type DrivingMode='exam'|'practice';
export class ExamSession {
  state: ExamState='projects';
  mode: DrivingMode='exam';
  result: ExamResult|null=null;
  course:CourseDefinition=RIGHT_ANGLE;
  rules=new ExamRules(this.course);
  pauseReason='';
  get active(){return this.state==='running'||this.state==='paused';}
  select(course:CourseDefinition=RIGHT_ANGLE){this.mode='exam';this.course=course;this.rules=new ExamRules(course);this.state='briefing';this.result=null;this.pauseReason='';}
  selectPractice(){this.mode='practice';this.state='briefing';this.result=null;this.pauseReason='';this.rules.reset();}
  start(){if(this.mode==='exam')this.rules.reset();this.result=null;this.state='running';this.pauseReason='';}
  pause(reason='休息一下，准备好后继续。'){if(this.state==='running'){this.state='paused';this.pauseReason=reason;}}
  resume(){if(this.state==='paused')this.state='running';}
  exit(){this.state='projects';this.mode='exam';this.result=null;this.pauseReason='';this.rules.reset();}
  step(p:ExamPose,dt=1/60){if(this.state!=='running'||this.mode!=='exam')return;this.result=this.rules.step(p,dt);if(this.result)this.state='result';}
}
