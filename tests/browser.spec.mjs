import {test,expect} from '@playwright/test';
test('drive, brake, reverse, mirrors and mobile layout',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5173/car-drive-3d/');await page.waitForFunction(()=>window.larria?.ready);await page.waitForTimeout(800);
 await page.keyboard.down('w');await page.waitForTimeout(1500);await page.keyboard.up('w');
 expect(await page.evaluate(()=>window.larria.physics.speed)).toBeGreaterThan(.4);
 expect(await page.evaluate(()=>window.larria.physics.chassis.position.z)).toBeLessThan(-.3);
 await page.locator('[data-gear="R"]').click();expect(await page.evaluate(()=>window.larria.physics.gear)).toBe('D');
 await page.keyboard.down('s');await page.waitForTimeout(2200);await page.keyboard.up('s');expect(Math.abs(await page.evaluate(()=>window.larria.physics.speed))).toBeLessThan(.5);
 await page.locator('[data-gear="R"]').click();expect(await page.evaluate(()=>window.larria.physics.gear)).toBe('R');
 await page.keyboard.down('w');await page.waitForTimeout(1300);await page.keyboard.up('w');expect(await page.evaluate(()=>window.larria.physics.speed)).toBeLessThan(-.3);
 await page.locator('#reset').click();await page.locator('[data-view="cockpit"]').click();await expect.poll(()=>page.evaluate(()=>window.larria.view)).toBe('cockpit');
 await page.locator('[data-mirror="left"]').click();await expect(page.locator('#expanded-wrap')).toBeVisible();await page.screenshot({path:'artifacts/mirror-expanded.png'});await page.locator('#close-expanded').click();
 await page.locator('[data-color="#a31e22"]').evaluate(e=>e.click());expect(await page.evaluate(()=>window.larria.car.paint.color.getHexString())).toBe('a31e22');
 await page.locator('[data-view="follow"]').click();await page.keyboard.down('a');await page.waitForTimeout(400);expect(await page.evaluate(()=>window.larria.physics.steering)).toBeGreaterThan(.1);await page.keyboard.up('a');
 await page.setViewportSize({width:553,height:772});await page.locator('[data-view="orbit"]').click();await page.waitForTimeout(600);await page.screenshot({path:'artifacts/mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(553);expect(errors).toEqual([]);
});
