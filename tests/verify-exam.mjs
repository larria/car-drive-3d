import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(800);
mkdirSync('artifacts',{recursive:true});
await page.screenshot({path:'artifacts/exam-projects.png'});
await page.locator('[data-exam="select"]').click();await page.screenshot({path:'artifacts/exam-briefing.png'});
await page.locator('[data-exam="start"]').click();await page.screenshot({path:'artifacts/exam-cockpit.png'});
const box=await page.locator('#steering-pad').boundingBox();const cx=box.x+box.width/2,cy=box.y+box.height/2;
await page.mouse.move(cx,cy);await page.mouse.down();await page.keyboard.down('w');
let turning=false,straight=false;const track=[];
for(let i=0;i<1200;i++){
 const p=await page.evaluate(()=>{const p=window.larria.physics;return {x:p.chassis.position.x,z:p.chassis.position.z,yaw:2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w),state:window.larria.session.state,speed:p.speed,result:window.larria.session.result};});
 track.push(p);if(p.state!=='running')break;
 if(p.z<1.48)turning=true;if(p.yaw < -1.53)straight=true;
 const steer=turning?(straight?Math.max(-1,Math.min(1,(-Math.PI/2-p.yaw)*3)):-1):Math.max(-.4,Math.min(.4,(p.x+.65)*.6-p.yaw*2));
 await page.mouse.move(cx-steer*95,cy);await page.waitForTimeout(18);
}
await page.keyboard.up('w');await page.mouse.up();await page.screenshot({path:'artifacts/exam-driven-result.png'});
writeFileSync('artifacts/exam-drive-track.json',JSON.stringify({errors,track},null,2));
console.log(JSON.stringify(track.at(-1)));await browser.close();
