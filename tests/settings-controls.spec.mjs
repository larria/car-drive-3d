import {test,expect} from '@playwright/test';

async function open(page){await page.goto(process.env.E2E_URL || 'http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(500);}
async function startPractice(page){await page.locator('[data-exam="select:practice"]').click();await page.locator('[data-exam="start"]').click();}
const snapshot=page=>page.evaluate(()=>{const l=window.larria,p=l.physics;return{speed:p.speed,gear:p.gear,z:p.chassis.position.z,throttle:p.throttle,brake:p.brake,state:l.session.state,result:l.session.result};});

test('default game W/S actually switches R/D after braking; Space and touch brake never reverse',async({page})=>{
 await open(page);expect(await page.evaluate(()=>window.larria.settingsStore.get().realisticControls)).toBe(false);
 await startPractice(page);await page.keyboard.down('w');
 await expect.poll(async()=>Math.abs((await snapshot(page)).z)).toBeGreaterThan(.65);
 await page.keyboard.up('w');let moving=await snapshot(page);expect(moving.gear).toBe('D');
 await page.keyboard.down('s');await expect.poll(async()=>{const s=await snapshot(page);return s.brake===1&&s.gear==='D';}).toBe(true);
 await expect.poll(async()=>{const s=await snapshot(page);return s.gear==='R'&&s.throttle===1;},{timeout:12000}).toBe(true);
 const reverseZ=(await snapshot(page)).z;await expect.poll(async()=>(await snapshot(page)).z).toBeGreaterThan(reverseZ+.4);
 await page.keyboard.up('s');await page.keyboard.down('w');
 await expect.poll(async()=>{const s=await snapshot(page);return s.brake===1&&s.gear==='R';}).toBe(true);
 await expect.poll(async()=>{const s=await snapshot(page);return s.gear==='D'&&s.throttle===1;},{timeout:12000}).toBe(true);
 await page.keyboard.up('w');await page.keyboard.down('Space');await page.waitForTimeout(250);
 expect((await snapshot(page)).gear).toBe('D');await page.keyboard.up('Space');
 const brake=page.locator('#brake');const box=await brake.boundingBox();const cdp=await page.context().newCDPSession(page);
 const touch={id:77,x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[touch]});await page.waitForTimeout(150);
 expect((await snapshot(page)).gear).toBe('D');expect((await snapshot(page)).brake).toBe(1);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.screenshot({path:'artifacts/settings-game-drive.png'});
});

test('settings pause, persist safely, restore UI and position reset; realistic brake and manual shifts',async({page})=>{
 await open(page);await startPractice(page);await page.keyboard.down('w');await expect.poll(async()=>(await snapshot(page)).z).toBeLessThan(-.4);
 await page.locator('#exam-hud [data-exam="settings"]').click();await page.keyboard.up('w');
 expect((await snapshot(page)).state).toBe('paused');const frozen=await snapshot(page);await page.waitForTimeout(350);expect((await snapshot(page)).z).toBe(frozen.z);
 await page.locator('#setting-realistic').check();await page.locator('#setting-paint').selectOption('#a31e22');await page.locator('#setting-lights').check();await page.locator('#setting-quality').selectOption('smooth');await page.locator('#setting-mirrors').uncheck();
 await page.screenshot({path:'artifacts/settings-dialog-desktop.png'});
 await page.locator('#settings-dialog .close-dialog').click();expect((await snapshot(page)).state).toBe('paused');expect((await snapshot(page)).z).toBe(frozen.z);
 await page.locator('[data-exam="resume"]').click();await page.keyboard.down('s');await page.waitForTimeout(250);
 expect((await snapshot(page)).gear).toBe('D');expect((await snapshot(page)).throttle).toBe(0);expect((await snapshot(page)).brake).toBe(1);
 await page.keyboard.up('s');await page.keyboard.press('z');expect((await snapshot(page)).gear).toBe('R');
 await page.keyboard.press('x');expect((await snapshot(page)).gear).toBe('N');
 await page.keyboard.press('c');expect((await snapshot(page)).gear).toBe('D');
 await page.reload();await page.waitForFunction(()=>window.larria?.ready);
 expect(await page.evaluate(()=>window.larria.settingsStore.get())).toMatchObject({realisticControls:true,paint:'#a31e22',headlights:true,quality:'smooth',mirrorsExpanded:false});
 expect((await snapshot(page)).state).toBe('projects');expect((await snapshot(page)).z).toBe(9);
 await expect(page.locator('#paint-name')).toHaveText('经典红');await expect(page.locator('#quality span')).toHaveText('流畅');await expect(page.locator('#mirror-toggle')).toHaveText('展开 +');
 await page.locator('.project-settings').click();await expect(page.locator('#setting-realistic')).toBeChecked();
 await page.screenshot({path:'artifacts/settings-restored.png'});
});

test('parking S starts timer only when actual reverse throttle; straight exam still forbids reverse',async({page})=>{
 await open(page);await page.locator('[data-exam="select:parallel-parking"]').click();await page.locator('[data-exam="start"]').click();
 expect(await page.evaluate(()=>window.larria.session.rules.startedW)).toBe(false);
 await page.keyboard.down('s');await expect.poll(()=>page.evaluate(()=>window.larria.session.rules.startedW)).toBe(true);
 expect((await snapshot(page)).gear).toBe('R');await page.keyboard.up('s');
 await page.locator('[data-exam="exit"]:visible').click();await page.locator('[data-exam="select:s-curve"]').click();await page.locator('[data-exam="start"]').click();
 await page.keyboard.down('s');await expect(page.locator('.result-reason')).toHaveText('中途倒车，考试不合格',{timeout:15000});await page.keyboard.up('s');
});

test('course and practice switching disposes owned resources across nine cycles',async({page})=>{
 await open(page);const samples=[];
 for(let i=0;i<12;i++){
  const selector=['select','select:s-curve','select:parallel-parking','select:reverse-garage','select:practice'][i%5];
  await page.locator(`[data-exam="${selector}"]`).click();await page.locator('[data-exam="start"]').click();await page.waitForTimeout(110);
  const item=await page.evaluate(()=>{const l=window.larria;const groups=[];l.scene.traverse(o=>{if(o.name.startsWith('course:')||o.name.startsWith('practice:'))groups.push(o.name);});return{groups,geometries:l.renderer.info.memory.geometries,textures:l.renderer.info.memory.textures};});
  expect(item.groups).toEqual([selector==='select:practice'?'practice:open-court':`course:${selector==='select'?'right-angle':selector.slice(7)}`]);
  samples.push({selector,...item});await page.locator('[data-exam="exit"]:visible').click();
 }
 for(const index of [5,6,7,8,9,10,11]){
  const earlier=samples[index-5],later=samples[index];expect(later.geometries).toBeLessThanOrEqual(earlier.geometries+3);expect(later.textures).toBeLessThanOrEqual(earlier.textures+3);
 }
});

test('practice overview contains four translated unchanged visual course groups, no rules, and responsive settings',async({page})=>{
 await open(page);await page.locator('[data-exam="select:practice"]').click();
 const islands=await page.evaluate(()=>{const l=window.larria,g=l.scene.getObjectByName('practice:open-court');return g.children.filter(x=>x.name.startsWith('island:')).map(x=>({id:x.name,x:x.position.x,z:x.position.z,meshes:x.children.length}));});
 expect(islands.map(({id,x,z})=>[id,x,z])).toEqual([['island:right-angle',-26,19],['island:s-curve',8,19],['island:parallel-parking',-36,-16],['island:reverse-garage',20,-22]]);
 expect(islands.every(x=>x.meshes>5)).toBe(true);
 await page.screenshot({path:'artifacts/practice-four-islands-briefing.png'});
 await page.locator('[data-exam="start"]').click();await page.locator('button[data-view="orbit"]').click();await page.waitForTimeout(350);
 await page.locator('#viewport canvas').hover({position:{x:750,y:410}});
 for(let i=0;i<3;i++)await page.mouse.wheel(0,480);
 await page.waitForTimeout(500);
 await page.screenshot({path:'artifacts/practice-four-islands-overview.png'});
 await page.screenshot({path:'artifacts/practice-four-islands-driving.png'});
 expect(await page.evaluate(()=>window.larria.session.rules.startedW)).toBe(false);
 await page.keyboard.down('w');await page.waitForTimeout(350);await page.keyboard.up('w');expect((await snapshot(page)).result).toBeNull();
 await page.setViewportSize({width:390,height:844});await page.locator('#exam-hud [data-exam="settings"]').click();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await page.screenshot({path:'artifacts/settings-dialog-mobile.png'});
});

test('far orbit recovers depth precision and switching back preserves cockpit near detail',async({page})=>{
 await open(page);await startPractice(page);await page.locator('[data-view="orbit"]').click();
 await page.locator('#viewport canvas').hover({position:{x:850,y:450}});await page.mouse.wheel(0,6000);
 await expect.poll(()=>page.evaluate(()=>window.larria.camera.near)).toBe(1);
 await page.screenshot({path:'artifacts/orbit-depth-regression.png'});
 await page.locator('[data-view="cockpit"]').click();await expect.poll(()=>page.evaluate(()=>window.larria.camera.near)).toBe(.04);
 expect(await page.evaluate(()=>window.larria.mirrors.entries.every(e=>e.camera.near===.05))).toBe(true);
});

test('speed sliders drag live, persist on input, retain focus and keep mobile header reachable',async({page})=>{
 await open(page);await page.locator('.project-settings').click();
 const slider=page.locator('[data-speed-course="right-angle"]');await slider.scrollIntoViewIfNeeded();
 const box=await slider.boundingBox();await page.mouse.move(box.x+10+(box.width-20)*3/17,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+10+(box.width-20)*10/17,box.y+box.height/2,{steps:12});
 await expect(slider.locator('..').locator('output')).toHaveText('13 km/h');
 expect(await page.evaluate(()=>window.larria.settingsStore.get().maxSpeeds['right-angle'])).toBe(13);
 await expect(slider).toBeFocused();await page.screenshot({path:'artifacts/settings-slider-drag-desktop.png'});await page.mouse.up();
 await slider.press('End');await expect(slider).toHaveValue('20');await slider.press('Home');await expect(slider).toHaveValue('3');await slider.press('ArrowRight');
 await page.locator('#settings-dialog .close-dialog').click();await page.reload();await page.waitForFunction(()=>window.larria?.ready);
 await page.locator('.project-settings').click();await expect(slider).toHaveValue('4');await expect(slider.locator('..').locator('output')).toHaveText('4 km/h');
 await page.setViewportSize({width:390,height:600});await page.locator('.settings-body').evaluate(e=>e.scrollTop=e.scrollHeight);
 const header=await page.locator('.settings-header').boundingBox(),close=await page.locator('#settings-dialog .close-dialog').boundingBox();
 expect(header.y).toBeGreaterThanOrEqual(0);expect(close.width).toBe(44);expect(close.height).toBe(44);
 await expect(page.locator('[data-speed-course="practice"]')).toHaveAttribute('max','60');
 await page.screenshot({path:'artifacts/settings-slider-mobile-bottom.png'});
 await page.locator('#settings-dialog .close-dialog').click();await expect(page.locator('#settings-dialog')).not.toBeVisible();
});

test('shared speed bounds and settings header stay usable after scrolling on mobile',async({page})=>{
 await open(page);await page.setViewportSize({width:390,height:600});await page.locator('.project-settings').click();
 for(const input of await page.locator('[data-speed-course]').all())expect(await input.getAttribute('min')).toBe('3');
 await expect(page.locator('#settings-description')).toContainText('无需点击保存');
 const body=page.locator('.settings-body');await body.evaluate(e=>e.scrollTop=e.scrollHeight);
 const close=page.locator('#settings-dialog .close-dialog');const box=await close.boundingBox();expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThan(600);
 await close.click();await expect(page.locator('#settings-dialog')).not.toBeVisible();
});

 test('default exam ceiling, persisted course limits and protected restart shortcut',async({page})=>{
  await open(page);await page.locator('[data-exam="select"]').click();await page.locator('[data-exam="start"]').click();
  await page.keyboard.down('w');await page.waitForTimeout(3000);expect((await snapshot(page)).speed*3.6).toBeGreaterThan(5.8);expect((await snapshot(page)).speed*3.6).toBeLessThan(6.05);await page.keyboard.up('w');
  await page.keyboard.press('Escape');await page.locator('[data-exam="resume"]:visible').focus();await page.keyboard.press('r');expect((await snapshot(page)).state).toBe('running');expect((await snapshot(page)).z).toBe(9);
  await page.locator('#settings-running').click();const input=page.locator('[data-speed-course="right-angle"]');await input.focus();await page.keyboard.press('Home');for(let i=0;i<5;i++)await page.keyboard.press('ArrowRight');await expect(input.locator('..').locator('output')).toHaveText('8 km/h');await page.keyboard.press('r');expect((await snapshot(page)).state).toBe('paused');await page.locator('#settings-dialog .close-dialog').click();await page.locator('[data-exam="resume"]:visible').focus();await page.keyboard.press('r');
  await page.keyboard.down('s');await expect.poll(async()=>(await snapshot(page)).state).toBe('result');await page.keyboard.up('s');await page.locator('[data-exam="retry"]:visible').focus();await page.keyboard.press('r');expect((await snapshot(page)).state).toBe('running');
  await page.reload();await page.waitForFunction(()=>window.larria?.ready);expect(await input.inputValue()).toBe('8');expect(await page.locator('[data-speed-course="practice"]').inputValue()).toBe('15');
 });
