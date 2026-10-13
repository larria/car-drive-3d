import { COURSES } from './courses';
import { RIGHT_ANGLE } from './courses/right-angle';
import type { CourseDefinition } from './courses/course-definition';
import { ExamRules, type ExamPose, type ExamResult, type ExamDeduction } from './exam-rules';
export type ExamState='projects'|'briefing'|'running'|'paused'|'result';
export type DrivingMode='exam'|'practice';
export type ExamScope='single'|'series';
export interface SessionDeduction extends ExamDeduction { courseId:string; courseName:string; projectIndex:number }
export class ExamSession {
  state: ExamState='projects';
  mode: DrivingMode='exam';
  scope:ExamScope='single';
  projectIndex=0;
  cumulativeScore=100;
  ledger:SessionDeduction[]=[];
  private archived=false;
  result: ExamResult|null=null;
  course:CourseDefinition=RIGHT_ANGLE;
  rules=new ExamRules(this.course);
  pauseReason='';
  get active(){return this.state==='running'||this.state==='paused';}
  get hasNext(){return this.scope==='series'&&this.state==='result'&&this.result?.passed===true&&this.projectIndex<COURSES.length-1;}
  get projectCount(){return COURSES.length;}
  select(course:CourseDefinition=RIGHT_ANGLE){this.mode='exam';this.scope='single';this.projectIndex=0;this.cumulativeScore=100;this.ledger=[];this.prepare(course);}
  selectSeries(){this.mode='exam';this.scope='series';this.projectIndex=0;this.cumulativeScore=100;this.ledger=[];this.prepare(COURSES[0]);}
  private prepare(course:CourseDefinition){this.course=course;this.rules=new ExamRules(course,this.cumulativeScore);this.state='briefing';this.result=null;this.pauseReason='';this.archived=false;}
  next(){if(!this.hasNext)return false;this.projectIndex++;this.prepare(COURSES[this.projectIndex]);return true;}
  selectPractice(){this.mode='practice';this.scope='single';this.projectIndex=0;this.cumulativeScore=100;this.ledger=[];this.rules.reset();this.state='briefing';this.result=null;this.pauseReason='';this.archived=false;}
  start(){if(this.state!=='briefing')return;if(this.mode==='exam')this.rules.reset(this.scope==='series'?this.cumulativeScore:100);this.result=null;this.state='running';this.pauseReason='';this.archived=false;}
  retry(){if(this.scope==='series')this.selectSeries();else this.state='briefing';this.start();}
  pause(reason='休息一下，准备好后继续。'){if(this.state==='running'){this.state='paused';this.pauseReason=reason;}}
  resume(){if(this.state==='paused')this.state='running';}
  exit(){this.select(this.course);this.state='projects';}
  step(p:ExamPose,dt=1/60){
    if(this.state!=='running'||this.mode!=='exam')return;
    this.result=this.rules.step(p,dt);
    if(this.result){
      this.state='result';
      if(!this.archived){this.cumulativeScore=this.result.score;this.ledger.push(...this.result.deductions.map(d=>({...d,courseId:this.course.id,courseName:this.course.name,projectIndex:this.projectIndex})));this.archived=true;}
    }
  }
}
