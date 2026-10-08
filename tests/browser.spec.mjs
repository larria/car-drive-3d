import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const open=async page=>{await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(750);};
const start=async page=>{await page.locator('[data-exam="select"]').click();await page.locator('[data-exam="start"]').click();};
const startS=async page=>{await page.locator('[data-exam="select:s-curve"]').click();await page.locator('[data-exam="start"]').click();};
const state=page=>page.evaluate(()=>window.larria.session.state);
const pos=page=>page.evaluate(()=>window.larria.physics.chassis.position.toArray());
test('S failures, pause, switching ownership, stable resources and narrow UI',async({page})=>{
 await open(page);await startS(page);
 await page.keyboard.press('z');await page.keyboard.down('w');await expect(page.locator('.result-reason')).toHaveText('中途倒车，考试不合格');await page.keyboard.up('w');
 await page.locator('[data-exam="retry"]:visible').click();expect((await pos(page))[2]).toBe(9.5);
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.down('s');await expect(page.locator('.result-reason')).toHaveText('中途停车，考试不合格');await page.keyboard.up('s');
 await page.locator('[data-exam="retry"]:visible').click();await page.keyboard.down('w');await page.waitForTimeout(500);await page.locator('[data-exam="pause"]:visible').click();await page.keyboard.up('w');const frozen=await pos(page);await page.waitForTimeout(350);expect(await pos(page)).toEqual(frozen);
 await page.locator('[data-exam="resume"]').click();await page.keyboard.down('w');await expect(page.locator('.result-reason')).toHaveText('车辆越出边界线',{timeout:15000});await page.keyboard.up('w');await page.screenshot({path:'artifacts/s-fail-boundary.png'});
 await page.locator('[data-exam="exit"]:visible').click();const memory=[];
 for(let i=0;i<8;i++){
  if(i%2===0)await start(page);else await startS(page);
  await page.waitForTimeout(100);
  const data=await page.evaluate(()=>{const l=window.larria;const groups=[];l.scene.traverse(o=>{if(o.name.startsWith('course:'))groups.push(o.name);});return {groups,id:l.session.course.id,rules:l.session.rules.course.id,result:l.session.result,latch:l.session.rules.startedW,throttle:l.physics.throttle,geometries:l.renderer.info.memory.geometries,textures:l.renderer.info.memory.textures};});
  expect(data.groups).toEqual([`course:${data.id}`]);expect(data.rules).toBe(data.id);expect(data.result).toBeNull();expect(data.latch).toBe(false);expect(data.throttle).toBe(0);memory.push(data);
  await page.locator('[data-exam="exit"]:visible').click();
 }
 expect(memory[6].geometries).toBe(memory[2].geometries);expect(memory[7].geometries).toBe(memory[3].geometries);expect(memory[7].textures).toBe(memory[3].textures);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/s-mobile-projects.png'});await page.locator('[data-exam="select:s-curve"]').click();await page.screenshot({path:'artifacts/s-mobile-briefing.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('[data-exam="start"]').click();await page.screenshot({path:'artifacts/s-mobile-cockpit.png'});await expect(page.locator('#throttle')).toBeVisible();await expect(page.locator('#steering-pad')).toBeVisible();
 writeFileSync('artifacts/course-resources.json',JSON.stringify(memory,null,2));
 await test.info().attach('course-resources',{body:JSON.stringify(memory,null,2),contentType:'application/json'});
});
test('complete actual driving pass using only held keyboard and screen steering',async({page})=>{
 await open(page);await expect(page.locator('.project-placeholder:disabled')).toHaveCount(1);await page.keyboard.press('w');expect(await state(page)).toBe('projects');await start(page);
 await expect(page.locator('button[data-view].active')).toHaveCount(1);await expect(page.locator('button[data-view="cockpit"]')).toHaveClass('active');
 const box=await page.locator('#steering-pad').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.keyboard.down('w');let turning=false,straight=false;
 for(let i=0;i<1200;i++){
  const p=await page.evaluate(()=>{const p=window.larria.physics;return{x:p.chassis.position.x,z:p.chassis.position.z,yaw:2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w),state:window.larria.session.state};});
  if(p.state!=='running')break;if(p.z<1.48)turning=true;if(p.yaw< -1.53)straight=true;
  const steer=turning?(straight?Math.max(-1,Math.min(1,(-Math.PI/2-p.yaw)*3)):-1):Math.max(-.4,Math.min(.4,(p.x+.65)*.6-p.yaw*2));
  await page.mouse.move(cx-steer*95,cy);await page.waitForTimeout(18);
 }
 await page.keyboard.up('w');await page.mouse.up();await expect(page.locator('.result-card h1')).toHaveText('考试通过');await page.screenshot({path:'artifacts/exam-pass.png'});
 const frozen=await pos(page);await page.keyboard.down('w');await page.waitForTimeout(300);await page.keyboard.up('w');expect(await pos(page)).toEqual(frozen);
 await page.locator('[data-exam="retry"]:visible').click();expect((await pos(page))[2]).toBe(9);expect(await page.evaluate(()=>window.larria.session.rules.startedW)).toBe(false);
});
test('three failure reasons, keyboard gears, pause, help and explicit resume',async({page})=>{
 await open(page);await start(page);
 for(const [key,gear] of [['z','R'],['x','N'],['c','D']]){await page.keyboard.press(key);expect(await page.evaluate(()=>window.larria.physics.gear)).toBe(gear);}
 await page.keyboard.press('z');await page.keyboard.down('w');await expect(page.locator('.result-reason')).toHaveText('中途倒车，考试不合格');await page.keyboard.up('w');await page.screenshot({path:'artifacts/exam-fail-reverse.png'});
 await page.locator('[data-exam="retry"]:visible').click();await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.down('s');await expect(page.locator('.result-reason')).toHaveText('中途停车，考试不合格');await page.keyboard.up('s');
 await page.locator('[data-exam="retry"]:visible').click();await page.keyboard.down('w');await page.waitForTimeout(600);await page.locator('#help').click();await page.keyboard.up('w');expect(await state(page)).toBe('paused');const frozen=await pos(page);await page.waitForTimeout(400);expect(await pos(page)).toEqual(frozen);await page.locator('#help-dialog .close-dialog').click();expect(await state(page)).toBe('paused');await page.screenshot({path:'artifacts/exam-paused.png'});
 await page.locator('[data-exam="resume"]').click();await page.keyboard.down('w');await expect(page.locator('.result-reason')).toHaveText('车辆越出边界线',{timeout:15000});await page.keyboard.up('w');await page.screenshot({path:'artifacts/exam-fail-boundary.png'});
 await page.locator('[data-exam="retry"]:visible').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));expect(await state(page)).toBe('paused');await page.waitForTimeout(150);await page.locator('[data-exam="resume"]').click();expect(await state(page)).toBe('running');
});
test('hover look, UI exclusion, mirrors and narrow screen controls',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await start(page);
 await page.mouse.move(600,430);await page.mouse.move(680,450,{steps:4});expect(Math.abs(await page.evaluate(()=>window.larria.look.yaw))).toBeGreaterThan(.1);
 const before=await page.evaluate(()=>[window.larria.look.yaw,window.larria.look.pitch]);await page.locator('#exam-hud').hover();expect(await page.evaluate(()=>[window.larria.look.yaw,window.larria.look.pitch])).toEqual(before);
 await page.mouse.dblclick(700,460);expect(await page.evaluate(()=>window.larria.look.yaw)).toBe(0);await expect(page.locator('.mirror-strip')).toBeHidden();
 await page.locator('button[data-view="orbit"]').click();await page.locator('[data-mirror="left"]').click();await expect(page.locator('#expanded-wrap')).toBeVisible();await page.screenshot({path:'artifacts/exam-mirror.png'});await page.locator('#close-expanded').click();
 await page.setViewportSize({width:390,height:844});await page.locator('button[data-view="cockpit"]').click();await page.screenshot({path:'artifacts/exam-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.locator('[data-exam="exit"]:visible').click();await page.screenshot({path:'artifacts/exam-mobile-projects.png'});expect(errors).toEqual([]);
});


test('keyboard scope, repeated keys, focus and directional gear feedback',async({page})=>{
 await open(page);await start(page);
 await page.evaluate(()=>{window.__keys=[];document.addEventListener('keydown',e=>window.__keys.push([e.code,e.defaultPrevented]),true);});
 await page.keyboard.down('w');await page.keyboard.down('a');await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.larria.physics.throttle)).toBe(1);
 expect(await page.evaluate(()=>window.larria.physics.steering)).toBeGreaterThan(0);
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',repeat:true,bubbles:true,cancelable:true})));
 expect(await page.evaluate(()=>window.__keys.at(-1))).toEqual(['Space',false]); // capture phase is before preventDefault
 expect(await page.evaluate(()=>{let prevented=false;const e=new KeyboardEvent('keydown',{code:'ArrowDown',key:'ArrowDown',repeat:true,bubbles:true,cancelable:true});document.dispatchEvent(e);prevented=e.defaultPrevented;return prevented;})).toBe(true);
 await page.keyboard.up('a');await page.keyboard.up('w');
 await page.keyboard.press('Control+KeyZ');expect(await page.evaluate(()=>window.larria.physics.gear)).toBe('D');
 await page.locator('#help').focus();await page.keyboard.press('z');expect(await page.evaluate(()=>window.larria.physics.gear)).toBe('D');
 await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('z');expect(await page.evaluate(()=>window.larria.physics.gear)).toBe('R');
 await page.evaluate(()=>window.larria.physics.chassis.velocity.z=2);await page.keyboard.press('c');await expect(page.locator('#toast')).toContainText('倒退');
});

test('explicit pointer lock, natural Escape and rejected-lock fallback',async({page})=>{
 await open(page);await start(page);
 await page.locator('#look-lock').click();await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
 await page.mouse.move(700,400);await page.mouse.move(900,460);expect(Math.abs(await page.evaluate(()=>window.larria.look.yaw))).toBeGreaterThan(.1);
 await page.keyboard.press('Escape');await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false);expect(await state(page)).toBe('running');
 await page.keyboard.press('Escape');await expect(page.locator('[data-exam="resume"]')).toBeVisible();await page.locator('[data-exam="resume"]').click();
 await page.locator('#look-lock').click();await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(true);
 await page.keyboard.press('3');await expect.poll(()=>page.evaluate(()=>!!document.pointerLockElement)).toBe(false);
 await page.locator('button[data-view="cockpit"]').click();
 await page.evaluate(()=>{document.querySelector('#viewport canvas').requestPointerLock=()=>Promise.reject(new Error('denied'));});
 await page.locator('#look-lock').click();await expect(page.locator('#toast')).toContainText('未允许锁定');expect(await state(page)).toBe('running');
 await page.mouse.move(600,400);await page.mouse.move(680,430);expect(Math.abs(await page.evaluate(()=>window.larria.look.yaw))).toBeGreaterThan(.1);
 await page.locator('#look-center').click();expect(await page.evaluate(()=>window.larria.look.yaw)).toBe(0);
});

test('touch ownership across pedals, wheel and cockpit and cancellation',async({page})=>{
 await open(page);await start(page);
 const result=await page.evaluate(()=>{
  const ids={throttle:11,brake:12,steer:13,look:14,extra:15};const el=s=>document.querySelector(s),canvas=el('#viewport canvas');
  const send=(target,type,id,x=700,y=400)=>target.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',isPrimary:id===11,bubbles:true,cancelable:true,clientX:x,clientY:y}));
  const throttle=el('#throttle'),brake=el('#brake'),steer=el('#steering-pad');
  send(throttle,'pointerdown',ids.extra);send(throttle,'pointerdown',ids.throttle);
  send(brake,'pointerdown',ids.brake);send(steer,'pointerdown',ids.steer,500);send(canvas,'pointerdown',ids.look);
  send(steer,'pointermove',ids.steer,420);send(canvas,'pointermove',ids.look,770,420);
  const lookYaw=window.larria.look.yaw;
  send(throttle,'pointerup',ids.throttle);send(steer,'pointermove',ids.extra,540);
  const afterOne={yaw:window.larria.look.yaw,throttleCount:throttle.hasPointerCapture(ids.extra)};
  send(canvas,'pointercancel',ids.look);send(steer,'pointercancel',ids.steer);
  return{lookYaw,afterOne,touchReleased:!canvas.hasPointerCapture(ids.look),wheelReleased:!steer.hasPointerCapture(ids.steer)};
 });
 expect(result.lookYaw).not.toBe(0);expect(result.afterOne.yaw).toBe(result.lookYaw);
 expect(result.touchReleased).toBe(true);expect(result.wheelReleased).toBe(true);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('[data-exam="resume"]')).toBeVisible();
 expect(await page.evaluate(()=>document.querySelector('#throttle').hasPointerCapture(15))).toBe(false);
});

test('Chrome CDP three-finger throttle, steering and cockpit look remain independent',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);await start(page);
 const cdp=await page.context().newCDPSession(page);
 const point=async(selector,id)=>{const box=await page.locator(selector).boundingBox();return{x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2),id}};
 const throttle=await point('#throttle',1),wheel=await point('#steering-pad',2),look={x:210,y:450,id:3};
 const dispatch=async(type,touchPoints)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});await page.waitForTimeout(100)};
 const sample=()=>page.evaluate(()=>({throttle:window.larria.physics.throttle,steer:window.larria.physics.steering,yaw:window.larria.look.yaw}));
 await dispatch('touchStart',[throttle]);await dispatch('touchStart',[throttle,wheel]);await dispatch('touchStart',[throttle,wheel,look]);
 await dispatch('touchMove',[throttle,{...wheel,x:wheel.x-25},{...look,x:look.x+35}]);
 const together=await sample();expect(together.throttle).toBe(1);expect(together.steer).toBeGreaterThan(.05);expect(Math.abs(together.yaw)).toBeGreaterThan(.05);
 await page.screenshot({path:'artifacts/three-finger-cockpit.png'});
 await dispatch('touchMove',[throttle,wheel,{...look,x:look.x+65}]);const moving=await sample();expect(Math.abs(moving.yaw)).toBeGreaterThan(Math.abs(together.yaw));
 await dispatch('touchEnd',[{...wheel,x:wheel.x-25}]);const wheelUp=await sample();expect(wheelUp.throttle).toBe(1);
 await dispatch('touchEnd',[{...look,x:look.x+65}]);const lookUp=await sample();expect(lookUp.throttle).toBe(1);
 await dispatch('touchEnd',[]);expect((await sample()).throttle).toBe(0);
});

test('parking projects open their own rules and default cockpit, free remains disabled',async({page})=>{
 await open(page);await expect(page.locator('.project-placeholder:disabled')).toHaveCount(1);
 for(const [id,title] of [['parallel-parking','侧方位停车'],['reverse-garage','倒车入库']]){
  await page.locator(`[data-exam="select:${id}"]`).click();
  await expect(page.locator('.briefing-page h1')).toHaveText(title);
  await expect(page.locator('.exam-rules')).toContainText('30 秒');
  await expect(page.locator('.exam-rules')).toContainText('2 秒');
  await expect(page.locator('.briefing-page .course-diagram')).toContainText('↑');
  await page.locator('[data-exam="start"]').click();
  expect(await page.evaluate(()=>window.larria.session.course.id)).toBe(id);
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await expect(page.locator('[data-parking="count"]')).toContainText('0');
  await page.locator('[data-exam="exit"]:visible').click();
 }
});

test('all courses preserve selected view on failure and success retry with matching mirrors',async({page})=>{
 await open(page);
 const cases=[['right-angle','select','orbit'],['s-curve','select:s-curve','follow'],['parallel-parking','select:parallel-parking','orbit'],['reverse-garage','select:reverse-garage','follow']];
 for(const [id,select,view] of cases){
  await page.locator(`[data-exam="${select}"]`).click();await page.locator('[data-exam="start"]').click();
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await page.locator(`button[data-view="${view}"]`).click();
  await page.keyboard.down('w');await expect(page.locator('.result-card h1')).toBeVisible({timeout:35000});await page.keyboard.up('w');
  await page.locator('[data-exam="retry"]:visible').click();
  const data=await page.evaluate(()=>({view:window.larria.view,active:[...document.querySelectorAll('button[data-view].active')].map(b=>b.dataset.view),surfaces:window.larria.mirrors.entries.map(e=>e.surface.visible),strip:document.querySelector('.mirror-strip').hidden,gear:window.larria.physics.gear,course:window.larria.session.course.id}));
  expect(data.view).toBe(view);expect(data.active).toEqual([view]);expect(data.strip).toBe(false);expect(data.surfaces).toEqual([false,false,false]);expect(data.gear).toBe('D');expect(data.course).toBe(id);
  await page.locator('button[data-view="cockpit"]').click();await page.keyboard.press('r');
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await expect(page.locator('.mirror-strip')).toBeHidden();
  expect(await page.evaluate(()=>window.larria.mirrors.entries.map(e=>e.surface.visible))).toEqual([true,true,true]);
  await page.locator('[data-exam="exit"]:visible').click();
 }
});
