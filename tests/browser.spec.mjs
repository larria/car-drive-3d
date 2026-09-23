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
  if(p.state!=='running'){console.log('drive-terminal',p);break;}if(p.z<1.48)turning=true;if(p.yaw< -1.53)straight=true;
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


test('upcoming parking projects show a dismissible placeholder',async({page})=>{
 await open(page);
 for(const title of ['侧方位停车','倒车入库']){
  const card=page.locator(`[data-upcoming="${title}"]`);await card.click();
  await expect(page.locator('#upcoming-dialog')).toBeVisible();
  await expect(page.locator('#upcoming-title')).toHaveText(title);
  await expect(page.locator('#upcoming-dialog')).toContainText('敬请期待');
  expect(await state(page)).toBe('projects');
  await page.getByRole('button',{name:'返回项目',exact:true}).click();
  await expect(page.locator('#upcoming-dialog')).not.toBeVisible();
  await expect(card).toBeFocused();
 }
 await page.locator('[data-upcoming="侧方位停车"]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#upcoming-dialog')).toBeVisible();await page.keyboard.press('Escape');
 await expect(page.locator('#upcoming-dialog')).not.toBeVisible();
});
