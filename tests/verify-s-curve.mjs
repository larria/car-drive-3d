import {chromium} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5173');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(800);
mkdirSync('artifacts',{recursive:true});
await page.screenshot({path:'artifacts/s-projects.png'});
await page.locator('[data-exam="select:s-curve"]').click();await page.screenshot({path:'artifacts/s-briefing.png'});
await page.locator('[data-exam="start"]').click();await page.screenshot({path:'artifacts/s-cockpit.png'});
const path=await page.evaluate(()=>window.larria.session.course.center);
const box=await page.locator('#steering-pad').boundingBox();const cx=box.x+box.width/2,cy=box.y+box.height/2;
await page.mouse.move(cx,cy);await page.mouse.down();await page.keyboard.down('w');
const track=[];let nearest=0,turnShot=false;
for(let i=0;i<1800;i++){
 const p=await page.evaluate(()=>{const p=window.larria.physics;return {x:p.chassis.position.x,z:p.chassis.position.z,yaw:2*Math.atan2(p.chassis.quaternion.y,p.chassis.quaternion.w),state:window.larria.session.state,speed:p.speed,result:window.larria.session.result};});
 track.push(p);if(p.state!=='running')break;
 // Read-only telemetry, pure pursuit with a rear-axle reference; all actuation is real DOM input.
 const rear=1.35, rx=p.x+Math.sin(p.yaw)*rear, rz=p.z+Math.cos(p.yaw)*rear;
 let best=Infinity;for(let j=Math.max(0,nearest-3);j<Math.min(path.length,nearest+20);j++){const d=Math.hypot(path[j].x-rx,path[j].z-rz);if(d<best){best=d;nearest=j;}}
 let target=nearest;while(target<path.length-1&&Math.hypot(path[target].x-rx,path[target].z-rz)<3.5)target++;
 const t=path[target],dx=t.x-rx,dz=t.z-rz,L=Math.hypot(dx,dz);
 const localX=Math.cos(p.yaw)*dx-Math.sin(p.yaw)*dz;
 const angle=-Math.atan2(2*2.65*localX,L*L);
 const steer=Math.max(-1,Math.min(1,angle*(1+Math.abs(p.speed)*.065)/.55));
 track.at(-1).steer=steer;track.at(-1).target=target;
 await page.mouse.move(cx-steer*95,cy);
 if(nearest>42&&!turnShot){await page.screenshot({path:'artifacts/s-turn.png'});turnShot=true;}
 await page.waitForTimeout(18);
}
await page.keyboard.up('w');await page.mouse.up();await page.screenshot({path:'artifacts/s-driven-result.png'});
writeFileSync('artifacts/s-drive-track.json',JSON.stringify({errors,track},null,2));
console.log(JSON.stringify(track.at(-1)));await browser.close();
if(!track.at(-1)?.result?.passed)process.exitCode=1;
