import { it, expect } from 'vitest';
import { DrivingPhysics } from '../src/physics';
import { ExamRules, type ExamResult } from '../src/exam-rules';
it('the unmodified course and body admit a real continuous driving path',()=>{
 const p=new DrivingPhysics();p.reset(0,9);const rules=new ExamRules();let turning=false,straight=false,result:ExamResult|null=null;
 for(let i=0;i<1200;i++){
  let yaw=2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w);
  if(p.chassis.position.z<1.4)turning=true;if(yaw< -1.53)straight=true;
  const steer=turning?(straight?Math.max(-1,Math.min(1,(-Math.PI/2-yaw)*3)):-1):Math.max(-.4,Math.min(.4,(p.chassis.position.x+.65)*.6-yaw*2));
  p.update(1/60,{throttle:1,brake:0,steer});
  yaw=2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w);
  result=rules.step({x:p.chassis.position.x,z:p.chassis.position.z,yaw,speed:p.speed,throttle:true});if(result)break;
 }
 expect(result?.passed).toBe(true);
});
