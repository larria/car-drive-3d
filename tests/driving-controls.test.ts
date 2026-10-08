import {describe,expect,it} from 'vitest';
import {DrivingControls,AUTO_STOP_SPEED,type ControlIntent} from '../src/driving-controls';
import type {Gear} from '../src/physics';

const blank:ControlIntent={forward:false,reverse:false,brake:false,touchThrottle:false,steer:0};
function harness(){
 const controls=new DrivingControls();let gear:Gear='D',speed=0,attempts=0,allow=true;
 const drive=(intent:Partial<ControlIntent>,realistic=false)=>controls.resolve({...blank,...intent},{gear,speed},realistic,next=>{attempts++;if(!allow)return false;gear=next;return true;});
 return{controls,drive,get gear(){return gear;},set gear(v:Gear){gear=v;},get speed(){return speed;},set speed(v:number){speed=v;},get attempts(){return attempts;},set allow(v:boolean){allow=v;}};
}
describe('input interpreter, independent of physics/rules',()=>{
 it('game W and S brake against motion, then accelerate in requested gear with hysteresis',()=>{
  const h=harness();expect(h.drive({forward:true}).input.throttle).toBe(1);
  h.speed=2;expect(h.drive({reverse:true}).input).toMatchObject({throttle:0,brake:1});expect(h.attempts).toBe(0);
  h.speed=AUTO_STOP_SPEED;expect(h.drive({reverse:true}).switching).toBe(true);
  h.speed=.02;expect(h.drive({reverse:true}).input).toMatchObject({throttle:1,brake:0});expect(h.gear).toBe('R');
  h.speed=-2;expect(h.drive({forward:true}).input.brake).toBe(1);h.speed=0;
  expect(h.drive({forward:true}).input.throttle).toBe(1);expect(h.gear).toBe('D');
 });
 it('brake, both directions and touch brake are always pure brakes',()=>{
  const h=harness();h.speed=.03;
  expect(h.drive({forward:true,reverse:true}).input).toMatchObject({throttle:0,brake:1});
  expect(h.drive({reverse:true,brake:true}).input).toMatchObject({throttle:0,brake:1});
  expect(h.drive({touchThrottle:true,brake:true}).input).toMatchObject({throttle:0,brake:1});
  expect(h.attempts).toBe(0);
 });
 it('realistic S is brake, W is throttle, touch throttle uses chosen gear',()=>{
  const h=harness();h.gear='R';
  expect(h.drive({reverse:true},true).input).toMatchObject({throttle:0,brake:1});
  expect(h.drive({forward:true},true).input.throttle).toBe(1);
  expect(h.drive({touchThrottle:true}).input.throttle).toBe(1);
  expect(h.attempts).toBe(0);
 });
 it('manual neutral holds until release and motion cannot bypass rejected protected change',()=>{
  const h=harness();h.controls.manual('N');h.gear='N';
  expect(h.drive({reverse:true}).input).toMatchObject({brake:1,throttle:0});expect(h.gear).toBe('N');
  h.controls.reset();expect(h.drive({reverse:true}).input.brake).toBe(1);
  h.controls.release();h.allow=false;
  expect(h.drive({reverse:true}).rejected).toBe(true);expect(h.gear).toBe('N');
  h.allow=true;expect(h.drive({reverse:true}).input.throttle).toBe(1);expect(h.gear).toBe('R');
 });
 it('release discards stale direction request',()=>{
  const h=harness();h.speed=2;h.drive({reverse:true});h.controls.release();h.speed=0;
  expect(h.drive({}).input.throttle).toBe(0);expect(h.attempts).toBe(0);
 });
});
