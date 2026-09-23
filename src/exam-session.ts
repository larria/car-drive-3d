import { ExamRules, type ExamPose, type ExamResult } from './exam-rules';
export type ExamState='projects'|'briefing'|'running'|'paused'|'result';
export class ExamSession {
  state: ExamState='projects';
  result: ExamResult|null=null;
  readonly rules=new ExamRules();
  pauseReason='';
  get active(){return this.state==='running'||this.state==='paused';}
  select(){this.state='briefing';this.result=null;}
  start(){this.rules.reset();this.result=null;this.state='running';this.pauseReason='';}
  pause(reason='休息一下，准备好后继续。'){if(this.state==='running'){this.state='paused';this.pauseReason=reason;}}
  resume(){if(this.state==='paused')this.state='running';}
  exit(){this.state='projects';this.result=null;this.rules.reset();}
  step(p:ExamPose){if(this.state!=='running')return;this.result=this.rules.step(p);if(this.result)this.state='result';}
}
