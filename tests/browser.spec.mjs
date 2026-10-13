import {test,expect} from '@playwright/test';
import {writeFileSync,readFileSync} from 'node:fs';
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const open=async page=>{await page.goto(process.env.E2E_URL || 'http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(750);await page.locator('[data-exam="settings"]:visible').click();for(const id of ['right-angle','s-curve','parallel-parking','reverse-garage']){const input=page.locator(`[data-speed-course="${id}"]`);await input.evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'17');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});}await page.locator('#settings-dialog .close-dialog').click();};
const start=async page=>{await page.locator('[data-exam="select"]').click();await page.locator('[data-exam="start"]').click();};
const startS=async page=>{await page.locator('[data-exam="select:s-curve"]').click();await page.locator('[data-exam="start"]').click();};
const state=page=>page.evaluate(()=>window.larria.session.state);
const pos=page=>page.evaluate(()=>window.larria.physics.chassis.position.toArray());
test('S failures, pause, switching ownership, stable resources and narrow UI',async({page})=>{
 await open(page);await startS(page);
 await page.keyboard.press('z');await page.keyboard.down('s');await expect(page.locator('.result-reason')).toHaveText('中途倒车，考试不合格');await page.keyboard.up('s');
 await page.locator('[data-exam="retry"]:visible').click();expect((await pos(page))[2]).toBe(9.5);
 await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.down('Space');await expect(page.locator('.result-reason')).toHaveText('中途停车，考试不合格');await page.keyboard.up('Space');
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
 await page.clock.install();
 await open(page);await expect(page.locator('.project-card')).toHaveCount(4);await page.keyboard.press('w');expect(await state(page)).toBe('projects');
 // Freeze the browser clock, not the vehicle: real keyboard/pointer events feed
 // the normal animation loop and rules at fixed feedback intervals. CDP latency
 // must not turn a sampled steering decision into hundreds of ms of blind travel.
 await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));await start(page);
 await expect(page.locator('button[data-view].active')).toHaveCount(1);await expect(page.locator('button[data-view="cockpit"]')).toHaveClass('active');
 const box=await page.locator('#steering-pad').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.keyboard.down('w');let turning=false,straight=false;const trajectory=[];
 for(let i=0;i<1200;i++){
  const p=await page.evaluate(()=>{const p=window.larria.physics;return{x:p.chassis.position.x,z:p.chassis.position.z,yaw:2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w),speed:p.speed,steering:p.steering,throttle:p.throttle,state:window.larria.session.state,reason:window.larria.session.result?.reason};});trajectory.push(p);
  if(p.state!=='running')break;if(p.z<1.48)turning=true;if(p.yaw< -1.53)straight=true;
  const steer=turning?(straight?Math.max(-1,Math.min(1,(-Math.PI/2-p.yaw)*3)):-1):Math.max(-.4,Math.min(.4,(p.x+.65)*.6-p.yaw*2));
  await page.mouse.move(cx-steer*95,cy);await page.clock.runFor(17);
 }
 await test.info().attach('real-input-trajectory',{body:JSON.stringify(trajectory,null,2),contentType:'application/json'});
 await page.keyboard.up('w');await page.mouse.up();await expect(page.locator('.result-inspector h1')).toHaveText('✓ 考试通过');await expect(page.locator('body')).toHaveAttribute('data-result','passed');await page.screenshot({path:'artifacts/exam-pass.png'});
 const frozen=await pos(page);await page.keyboard.down('w');await page.clock.runFor(300);await page.keyboard.up('w');expect(await pos(page)).toEqual(frozen);
 await page.locator('[data-exam="retry"]:visible').click();expect((await pos(page))[2]).toBe(9);expect(await page.evaluate(()=>window.larria.session.rules.startedW)).toBe(false);
});
test('three failure reasons, keyboard gears, pause, help and explicit resume',async({page})=>{
 await open(page);await start(page);
 for(const [key,gear] of [['z','R'],['x','N'],['c','D']]){await page.keyboard.press(key);expect(await page.evaluate(()=>window.larria.physics.gear)).toBe(gear);}
 await page.keyboard.press('z');await page.keyboard.down('s');await expect(page.locator('.result-reason')).toHaveText('中途倒车，考试不合格');await page.keyboard.up('s');await page.screenshot({path:'artifacts/exam-fail-reverse.png'});
 await page.locator('[data-exam="retry"]:visible').click();await page.keyboard.down('w');await page.waitForTimeout(500);await page.keyboard.up('w');await page.keyboard.down('Space');await expect(page.locator('.result-reason')).toHaveText('中途停车，考试不合格');await page.keyboard.up('Space');
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
 await open(page);await page.locator('[data-exam="select:practice"]').click();await page.locator('[data-exam="start"]').click();
 await page.evaluate(()=>{window.__keys=[];document.addEventListener('keydown',e=>window.__keys.push([e.code,e.defaultPrevented]),true);});
 await page.keyboard.down('w');await page.keyboard.down('a');await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.larria.physics.throttle)).toBe(1);
 expect(await page.evaluate(()=>window.larria.physics.steering)).toBeGreaterThan(0);
 await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',key:' ',repeat:true,bubbles:true,cancelable:true})));
 expect(await page.evaluate(()=>window.__keys.at(-1))).toEqual(['Space',false]); // capture phase is before preventDefault
 expect(await page.evaluate(()=>{let prevented=false;const e=new KeyboardEvent('keydown',{code:'ArrowDown',key:'ArrowDown',repeat:true,bubbles:true,cancelable:true});document.dispatchEvent(e);prevented=e.defaultPrevented;return prevented;})).toBe(true);
 await page.keyboard.up('a');await page.keyboard.up('w');
 await page.keyboard.down('Space');await expect.poll(()=>page.evaluate(()=>Math.abs(window.larria.physics.speed))).toBeLessThan(.05);await page.keyboard.up('Space');
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

test('parking projects open their own rules and default cockpit, free remains independent',async({page})=>{
 await open(page);await expect(page.locator('.project-card')).toHaveCount(4);
 for(const [id,title] of [['parallel-parking','侧方位停车'],['reverse-garage','倒车入库']]){
  await page.locator(`[data-exam="select:${id}"]`).click();
  await expect(page.locator('.briefing-page h1')).toHaveText(title);
  await expect(page.locator('.exam-rules')).toContainText(`${id==='parallel-parking'?90:210} 秒`);
  await expect(page.locator('.exam-rules')).toContainText('2 秒');
  await expect(page.locator('.briefing-page .course-diagram')).toContainText('↑');
  await page.locator('[data-exam="start"]').click();
  expect(await page.evaluate(()=>window.larria.session.course.id)).toBe(id);
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await expect(page.locator('[data-parking="count"]')).toContainText('0');
  await page.locator('[data-exam="exit"]:visible').click();
 }
});

test('free practice drives forward, stops and reverses without scoring; switching clears scene and rules',async({page})=>{
 await open(page);await page.locator('[data-exam="select:practice"]').click();
 await expect(page.locator('.briefing-page h1')).toHaveText('自由练习');
 await expect(page.locator('.exam-rules')).toContainText('不设考试规则与时限');
 await expect(page.locator('.briefing-top-actions [data-exam="start"]')).toBeVisible();
 await page.screenshot({path:'artifacts/practice-briefing.png'});
 await page.locator('[data-exam="start"]').click();
 await expect(page.locator('body')).toHaveAttribute('data-mode','practice');
 await expect(page.locator('#exam-hud')).toContainText('自由驾驶中');
 await expect(page.locator('#exam-hud [data-parking]')).toHaveCount(0);
 const startZ=(await pos(page))[2];await page.keyboard.down('w');
 await expect.poll(async()=>(await pos(page))[2]).toBeLessThan(startZ-.6);
 await page.keyboard.up('w');await page.keyboard.down('Space');
 await expect.poll(async()=>Math.abs(await page.evaluate(()=>window.larria.physics.speed))).toBeLessThan(.1);
 await page.keyboard.up('Space');await page.keyboard.press('z');
 await expect.poll(async()=>page.evaluate(()=>window.larria.physics.gear)).toBe('R');
 const reverseZ=(await pos(page))[2];await page.keyboard.down('s');
 await expect.poll(async()=>(await pos(page))[2]).toBeGreaterThan(reverseZ+.4);
 await page.keyboard.up('s');expect(await page.evaluate(()=>window.larria.session.result)).toBeNull();
 await page.screenshot({path:'artifacts/practice-driving.png'});
 await page.locator('[data-exam="pause"]:visible').click();const frozen=await pos(page);
 await page.waitForTimeout(250);expect(await pos(page)).toEqual(frozen);
 await expect(page.locator('.result-card h1')).toHaveText('练习已暂停');
 await page.locator('.result-card [data-exam="retry"]').click();expect((await pos(page))[2]).toBeCloseTo(0,8);
 expect(await page.evaluate(()=>window.larria.session.mode)).toBe('practice');
 for(const selector of ['select','select:s-curve','select:parallel-parking','select:reverse-garage','select:practice']){
  await page.locator('[data-exam="exit"]:visible').click();await page.locator(`[data-exam="${selector}"]`).click();
  const group=await page.evaluate(()=>{const groups=[];window.larria.scene.traverse(o=>{if(o.name.startsWith('course:')||o.name.startsWith('practice:'))groups.push(o.name)});return groups});
  expect(group).toEqual([selector==='select:practice'?'practice:open-court':`course:${selector==='select'?'right-angle':selector.slice(7)}`]);
  await page.locator('[data-exam="start"]').click();expect(await page.evaluate(()=>window.larria.session.result)).toBeNull();
 }
 await page.locator('[data-exam="exit"]:visible').click();expect(await page.evaluate(()=>window.larria.session.mode)).toBe('exam');
});

test('briefing actions remain above fold on short phone and desktop, and cursor states differ',async({page})=>{
 await page.setViewportSize({width:390,height:620});await open(page);
 for(const selector of ['select','select:s-curve','select:parallel-parking','select:reverse-garage','select:practice']){
  await page.locator(`[data-exam="${selector}"]`).click();const button=page.locator('.briefing-top-actions [data-exam="start"]');
  await expect.poll(()=>page.locator('#exam-overlay').evaluate(el=>el.scrollTop)).toBe(0);
  const bounds=await button.evaluate(el=>{const r=el.getBoundingClientRect();return{top:r.top,bottom:r.bottom}});
  expect(bounds.top).toBeGreaterThanOrEqual(65);expect(bounds.bottom).toBeLessThanOrEqual(620);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.screenshot({path:`artifacts/short-${selector.replace(':','-')}.png`});
  await page.locator('.briefing-top-actions [data-exam="exit"]').click();
 }
 await page.setViewportSize({width:1000,height:550});await page.locator('[data-exam="select:practice"]').click();
 expect(await page.locator('.briefing-top-actions [data-exam="start"]').evaluate(el=>el.getBoundingClientRect().bottom)).toBeLessThanOrEqual(550);
 await page.locator('[data-exam="start"]').click();
 expect(await page.locator('#steering-pad').evaluate(el=>getComputedStyle(el).cursor)).toContain('12 14, ew-resize');
 expect(await page.locator('#exam-hud [data-exam="pause"]').evaluate(el=>getComputedStyle(el).cursor)).toContain('9 2, pointer');
 await page.evaluate(()=>document.querySelector('#exam-hud [data-exam="pause"]').disabled=true);
 expect(await page.locator('#exam-hud [data-exam="pause"]').evaluate(el=>getComputedStyle(el).cursor)).toBe('not-allowed');
});

test('all courses preserve selected view on failure and success retry with matching mirrors',async({page})=>{
 await open(page);
 const cases=[['right-angle','select','orbit'],['s-curve','select:s-curve','follow'],['parallel-parking','select:parallel-parking','orbit'],['reverse-garage','select:reverse-garage','follow']];
 for(const [id,select,view] of cases){
  await page.locator(`[data-exam="${select}"]`).click();await page.locator('[data-exam="start"]').click();
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await page.locator(`button[data-view="${view}"]`).click();
  await page.keyboard.down('w');await expect(page.locator('.result-inspector h1')).toBeVisible({timeout:35000});await page.keyboard.up('w');
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


test('result inspection preserves frozen scene and permits only observation',async({page})=>{
 await open(page);await expect(page.locator('footer .app-version')).toHaveText(`v${version}`);await start(page);
 await page.keyboard.down('s');await expect(page.locator('.result-inspector')).toBeVisible();await page.keyboard.up('s');
 await expect(page.locator('#throttle')).toBeHidden();await expect(page.locator('button[data-view="orbit"]')).toBeVisible();
 const snapshot=()=>page.evaluate(()=>({position:window.larria.physics.chassis.position.toArray(),gear:window.larria.physics.gear,time:window.larria.session.rules.totalElapsed}));const frozen=await snapshot();
 await page.locator('[data-exam="result-toggle"]').click();await expect(page.locator('.result-content')).toBeHidden();await expect(page.locator('body')).toHaveAttribute('data-result','failed');
 await page.emulateMedia({reducedMotion:'reduce'});expect(await page.evaluate(()=>getComputedStyle(document.body,'::after').animationName)).toBe('none');expect(await page.evaluate(()=>getComputedStyle(document.body,'::after').pointerEvents)).toBe('none');
 await page.keyboard.press('1');await expect.poll(()=>page.evaluate(()=>window.larria.view)).toBe('orbit');await page.mouse.move(700,400);await page.mouse.wheel(0,-100);
 await page.keyboard.press('2');await page.mouse.move(600,400);await page.mouse.move(780,440,{steps:6});expect(Math.abs(await page.evaluate(()=>window.larria.look.yaw))).toBeGreaterThan(.1);
 await page.keyboard.down('w');await page.keyboard.press('z');await page.waitForTimeout(250);await page.keyboard.up('w');expect(await snapshot()).toEqual(frozen);
 await page.setViewportSize({width:390,height:844});await page.locator('[data-exam="result-toggle"]').click();await expect(page.locator('[data-exam="retry"]:visible')).toBeInViewport();
 await page.locator('[data-exam="retry"]:visible').click();expect(await state(page)).toBe('running');expect(await page.evaluate(()=>document.body.dataset.result)).toBeUndefined();expect(await page.evaluate(()=>window.larria.view)).toBe('cockpit');
});

 test('vertical drag persists in follow and cockpit, clamps, resets and works in frozen result',async({page})=>{
  await open(page);await start(page);
  await page.mouse.move(710,400);await page.mouse.down();await page.mouse.move(710,500,{steps:5});await page.mouse.up();
  expect(await page.evaluate(()=>window.larria.look.pitch)).toBeLessThan(-.1);
  await page.locator('button[data-view="follow"]').click();
  await page.mouse.move(710,470);await page.mouse.down();await page.mouse.move(710,360,{steps:6});await page.mouse.up();
  const offset=await page.evaluate(()=>window.larria.look.followPitch);expect(offset).toBeLessThan(-.1);
  await page.waitForTimeout(400);expect(await page.evaluate(()=>window.larria.look.followPitch)).toBe(offset);
  await page.locator('#look-center').click();expect(await page.evaluate(()=>window.larria.look.followPitch)).toBe(0);
  await page.mouse.move(710,430);await page.mouse.down();await page.mouse.move(710,-800,{steps:4});await page.mouse.up();
  expect(await page.evaluate(()=>window.larria.look.followPitch)).toBeLessThanOrEqual(.8);
  await page.keyboard.down('s');await expect.poll(()=>state(page)).toBe('result');await page.keyboard.up('s');
  const frozen=await pos(page);await page.locator('#look-center').click();
  await page.mouse.move(710,430);await page.mouse.down();await page.mouse.move(710,350,{steps:4});await page.mouse.up();
  expect(await page.evaluate(()=>window.larria.look.followPitch)).toBeLessThan(-.1);expect(await pos(page)).toEqual(frozen);
  await expect(page.locator('.result-score')).toHaveCount(0);await expect(page.locator('.deduction-list')).toHaveCount(0);
 });


test('UI activation releases held driving keys without swallowing brake; slider keyboard and mouse buttons',async({page})=>{
 await page.goto(process.env.E2E_URL||'http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(750);
 await page.locator('[data-exam="select:practice"]').click();await page.locator('[data-exam="start"]').click();
 for(const selector of ['[data-gear="D"]','#look-center']){
  await page.keyboard.down('w');await page.waitForTimeout(100);await page.locator(selector).click();await page.keyboard.down('Space');
  await expect.poll(()=>page.evaluate(()=>window.larria.physics.throttle)).toBe(0);await expect(page.locator('#brake')).toHaveClass(/pressed/);
  await page.keyboard.up('w');await page.keyboard.up('Space');
 }
 await page.locator('#exam-hud [data-exam="pause"]').focus();await page.keyboard.press('Space');await expect(page.locator('[data-exam="resume"]')).toBeVisible();await page.locator('[data-exam="resume"]').click();
 await page.locator('#steering-pad').focus();await page.keyboard.press('ArrowLeft');await expect.poll(()=>page.evaluate(()=>window.larria.physics.steering)).toBeGreaterThan(0);
 await page.keyboard.press('Home');await expect.poll(()=>page.evaluate(()=>window.larria.physics.steering)).toBe(0);
 await page.keyboard.press('ArrowRight');await expect.poll(()=>page.evaluate(()=>window.larria.physics.steering)).toBeLessThan(0);await page.keyboard.press('Home');
 for(const button of ['right','middle']){await page.locator('#throttle').click({button});await expect.poll(()=>page.evaluate(()=>window.larria.physics.throttle)).toBe(0);}
 await page.locator('button[data-view="orbit"]').click();await page.locator('[data-mirror="left"]').click();await page.keyboard.press('r');await expect(page.locator('#expanded-wrap')).toBeHidden();
 await page.locator('[data-mirror="left"]').click();await page.locator('[data-exam="pause"]:visible').click();await expect(page.locator('#expanded-wrap')).toBeHidden();
});

test('late pointer lock is rejected after view invalidation and invisible mirrors skip rendering',async({page})=>{
 await open(page);await start(page);
 await page.evaluate(()=>{const canvas=document.querySelector('#viewport canvas');canvas.requestPointerLock=()=>new Promise(resolve=>window.__resolveLock=resolve);});
 await page.locator('#look-lock').click();await page.locator('button[data-view="orbit"]').click();
 const late=await page.evaluate(()=>{const canvas=document.querySelector('#viewport canvas');let exited=0;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>canvas});document.exitPointerLock=()=>{exited++;Object.defineProperty(document,'pointerLockElement',{configurable:true,value:null});};document.dispatchEvent(new Event('pointerlockchange'));window.__resolveLock();return exited;});expect(late).toBe(1);
 const calls=await page.evaluate(()=>{const l=window.larria;document.querySelector('.mirror-strip').style.visibility='hidden';l.mirrors.showSurfaces(false);let count=0;const render=l.renderer.render;l.renderer.render=()=>count++;try{l.mirrors.update(l.renderer,l.scene,l.camera);l.mirrors.draw(l.renderer,null);}finally{l.renderer.render=render;}return count;});expect(calls).toBe(0);
});


test('legacy void pointer lock accepts delayed event but rejects event after cancellation',async({page})=>{
 await open(page);await start(page);
 await page.evaluate(()=>{const canvas=document.querySelector('#viewport canvas');window.__lockElement=null;window.__lockExits=0;Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>window.__lockElement});canvas.requestPointerLock=()=>undefined;document.exitPointerLock=()=>{window.__lockExits++;window.__lockElement=null;document.dispatchEvent(new Event('pointerlockchange'));};window.__grantLock=()=>{window.__lockElement=canvas;document.dispatchEvent(new Event('pointerlockchange'));};});
 await page.locator('#look-lock').click();await page.waitForTimeout(50);await page.evaluate(()=>window.__grantLock());expect(await page.evaluate(()=>window.larria.look.locked)).toBe(true);expect(await page.evaluate(()=>window.__lockExits)).toBe(0);
 await page.locator('#look-lock').click();await page.locator('#look-lock').click();await page.locator('button[data-view="orbit"]').click();await page.evaluate(()=>window.__grantLock());expect(await page.evaluate(()=>window.larria.look.locked)).toBe(false);expect(await page.evaluate(()=>window.__lockExits)).toBe(2);
});

// UI flow uses explicit rule-result replay; not a four-project real-driving pass.
test('series confirmation and whole-round R; single hides scores',async({page})=>{
 await open(page);await start(page);await expect(page.locator('.exam-score')).toHaveCount(0);
 await page.locator('[data-exam="exit"]:visible').click();await page.locator('[data-exam="select:series"]').click();await page.locator('[data-exam="start"]').click();
 await expect(page.locator('.exam-score')).toContainText('1 / 4');
 await page.evaluate(()=>{const s=window.larria.session;s.rules.step=()=>({passed:true,score:80,reason:'规则结果回放',deductions:[]});});
 await expect(page.locator('[data-exam="next"]')).toBeVisible();await expect(page.locator('.result-inspector h1')).toHaveText('第 1 项完成');
 await page.locator('[data-exam="next"]').click();expect(await state(page)).toBe('briefing');expect(await page.evaluate(()=>window.larria.session.rules.score)).toBe(80);
 await page.locator('[data-exam="start"]').click();await expect(page.locator('.exam-score')).toContainText('2 / 4');await page.keyboard.press('r');
 expect(await page.evaluate(()=>[window.larria.session.projectIndex,window.larria.session.rules.score,window.larria.session.ledger.length])).toEqual([0,100,0]);
 await page.locator('[data-exam="exit"]:visible').click();await page.locator('[data-exam="select:parallel-parking"]').click();
 await expect(page.locator('.scoring-note')).toHaveCount(0);await page.locator('[data-exam="start"]').click();await expect(page.locator('.exam-timer')).toHaveAttribute('aria-valuenow','90');
 await page.waitForTimeout(150);await expect(page.locator('.exam-timer')).toHaveAttribute('aria-valuenow','90');
 await page.locator('[data-exam="pause"]:visible').click();const elapsed=await page.evaluate(()=>window.larria.session.rules.totalElapsed);await page.waitForTimeout(150);expect(await page.evaluate(()=>window.larria.session.rules.totalElapsed)).toBe(elapsed);
});


test('homepage six entrances follow series, four equal singles and free across responsive sizes',async({page})=>{
 await open(page);
 const entrances=page.locator('.home-project-grid button');
 expect(await entrances.evaluateAll(els=>els.map(el=>el.dataset.exam))).toEqual(['select:series','select','select:s-curve','select:parallel-parking','select:reverse-garage','select:practice']);
 await expect(page.locator('.project-page')).not.toContainText('已开放');
 await expect(page.locator('.mode-series')).toContainText('80 分合格');
 await expect(page.locator('.mode-practice')).toContainText('不评分');
 await page.locator('[data-exam="select:series"]').focus();
 for(const id of ['select','select:s-curve','select:parallel-parking','select:reverse-garage','select:practice']){await page.keyboard.press('Tab');await expect(page.locator(`[data-exam="${id}"]`)).toBeFocused();}
 for(const [width,height,columns] of [[1440,900,3],[1024,768,2],[768,900,2],[480,800,1],[375,812,1],[320,640,1],[844,390,2]]){
  await page.setViewportSize({width,height});
  expect(await page.locator('.home-project-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length)).toBe(columns);
  const sizes=await page.locator('.project-card').evaluateAll(els=>els.map(el=>Math.round(el.getBoundingClientRect().width)));expect(new Set(sizes).size).toBe(1);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.locator('#exam-overlay').evaluate(el=>el.scrollTop=el.scrollHeight);await expect(page.locator('[data-exam="select:practice"]')).toBeInViewport();
  const bottom=await page.locator('[data-exam="select:practice"]').evaluate(el=>el.getBoundingClientRect().bottom),footer=await page.locator('footer').evaluate(el=>el.getBoundingClientRect().top);expect(bottom).toBeLessThanOrEqual(footer);
  await page.screenshot({path:`artifacts/entrances-${width}-${height}.png`});
 }
});

test('homepage thumbnails retain real briefing geometry with text left and maps right',async({page})=>{
 await open(page);await expect(page.locator('#loading')).toBeHidden();
 await expect(page.locator('.project-road')).toHaveCount(0);
 const cards=page.locator('.project-card');await expect(cards.locator('.project-thumbnail svg')).toHaveCount(4);
 const maps=await cards.locator('svg').evaluateAll(els=>els.map(el=>el.innerHTML));
 for(const [index,id] of ['select','select:s-curve','select:parallel-parking','select:reverse-garage'].entries()){
  await page.locator(`[data-exam="${id}"]`).click();
  expect(await page.locator('.briefing-page .course-diagram').innerHTML()).toBe(maps[index]);
  await page.locator('[data-exam="exit"]:visible').click();
 }
 for(const [width,height] of [[1440,1000],[375,812]]){
  await page.setViewportSize({width,height});await page.locator('#exam-overlay').evaluate(el=>el.scrollTop=0);
  const boxes=await cards.evaluateAll(els=>els.map(el=>{const c=el.getBoundingClientRect(),t=el.querySelector('.project-copy').getBoundingClientRect(),g=el.querySelector('svg').getBoundingClientRect();return {textRight:t.right,mapLeft:g.left,mapRight:g.right,cardRight:c.right,mapWidth:g.width,mapHeight:g.height};}));
  for(const box of boxes){expect(box.mapLeft).toBeGreaterThanOrEqual(box.textRight);expect(box.mapRight).toBeLessThanOrEqual(box.cardRight);expect(box.mapWidth).toBeGreaterThanOrEqual(100);expect(box.mapHeight).toBeGreaterThanOrEqual(130);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({path:`artifacts/home-real-geometry-${width}.png`});
 }
});

// Explicit rule-state replay verifies presentation/event delivery only, NOT a parking driving pass.
test('parking rule steps and success event remain cockpit-visible without stealing focus',async({page})=>{
 await page.clock.install();await open(page);await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
 for(const [id,total] of [['parallel-parking',3],['reverse-garage',6]]){
  await page.locator(`[data-exam="select:${id}"]`).click();await page.locator('[data-exam="start"]').click();
  await page.clock.runFor(200);await expect(page.locator('#parking-step .step-index')).toHaveText(`1/${total}`);
  await page.evaluate(()=>{const s=window.larria.session;s.rules.step=()=>{if(s.course.id==='parallel-parking'&&!s.rules.deductions.length)s.rules.deductions.push({points:10,reason:'可继续轻扣 UI 回放',elapsed:0});s.rules.parkCount=1;return null;};document.querySelector('#viewport canvas').focus();});
  await page.clock.runFor(200);await expect(page.locator('#parking-success')).toContainText(`入库完成 · 1/${id==='parallel-parking'?1:2}`);
  await expect(page.locator('[data-parking="count"]')).toHaveText('1');
  if(id==='parallel-parking'){await expect(page.locator('#deduction-toast')).toBeVisible();await expect(page.locator('#parking-success')).toBeVisible();}
  await expect(page.locator('button[data-view="cockpit"]')).toHaveClass(/active/);
  await expect(page.locator('#viewport canvas')).toBeFocused();
  await page.setViewportSize({width:320,height:640});
  const overlap=await page.evaluate(()=>{const r=document.querySelector('#parking-success').getBoundingClientRect();return ['#steering-pad','#throttle','#brake'].some(s=>{const c=document.querySelector(s).getBoundingClientRect();return r.left<c.right&&r.right>c.left&&r.top<c.bottom&&r.bottom>c.top;});});expect(overlap).toBe(false);
  await page.clock.runFor(3100);await expect(page.locator('#parking-success')).toBeHidden();await expect(page.locator('[data-parking="count"]')).toHaveText('1');
  await page.locator('[data-exam="pause"]:visible').click();await expect(page.locator('#parking-step')).toBeHidden();await page.locator('[data-exam="resume"]').click();await expect(page.locator('#parking-success')).toBeHidden();
  await page.locator('[data-exam="exit"]:visible').click();await page.setViewportSize({width:1280,height:720});
 }
 await start(page);await expect(page.locator('#parking-step')).toBeHidden();await expect(page.locator('#parking-success')).toBeHidden();
});

 test('homepage settings gear opens driving settings and initial focus is continuous exam',async({page})=>{
 await page.goto(process.env.E2E_URL || 'http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await expect(page.locator('#loading')).toBeHidden();
 await expect(page.locator('[data-exam="select:series"]')).toBeFocused();
 const settings=page.getByRole('button',{name:'驾驶设置',exact:true});await expect(settings).toHaveAttribute('title','驾驶设置');await expect(settings.locator('svg')).toHaveCount(1);
 const box=await settings.boundingBox();expect(box.width).toBe(44);expect(box.height).toBe(44);await settings.click();await expect(page.locator('#settings-dialog')).toBeVisible();
 });
