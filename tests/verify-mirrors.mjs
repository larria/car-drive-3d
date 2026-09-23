import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto('http://127.0.0.1:5181/car-drive-3d/');
const data=await page.evaluate(async()=>{
 const THREE=await import('/car-drive-3d/node_modules/.vite/deps/three.js');
 const {loadCar}=await import('/car-drive-3d/src/car.ts');
 const {MirrorSystem}=await import('/car-drive-3d/src/mirrors.ts');
 const car=await loadCar(), scene=new THREE.Scene();scene.background=new THREE.Color('#b8ced4');scene.add(car.root);
 scene.add(new THREE.HemisphereLight(0xffffff,0x666666,3));
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(1440,900);
 document.body.replaceChildren(renderer.domElement);renderer.domElement.style.cssText='position:fixed;inset:0;width:1440px;height:900px';
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x707d70}));ground.rotation.x=-Math.PI/2;ground.position.y=-.01;scene.add(ground);
 for(let i=-3;i<=3;i++){const marker=new THREE.Mesh(new THREE.BoxGeometry(.35,1.5,.35),new THREE.MeshStandardMaterial({color:i<0?0xee3333:0x3344ee}));marker.position.set(i*1.5,.75,7);scene.add(marker)}
 const mirrors=new MirrorSystem(car.root,car.profile);mirrors.showSurfaces(true);mirrors.update(renderer,scene);
 const camera=new THREE.PerspectiveCamera(48,1440/900,.01,100);camera.position.copy(car.profile.eye);camera.lookAt(-.15,.96,-1);renderer.render(scene,camera);
 window.mirrorTest={THREE,car,scene,renderer,mirrors,camera};
 return mirrors.entries.map(e=>({name:e.name,triangles:e.surface.geometry.attributes.position.count/3,bounds:e.surface.geometry.boundingBox,aspect:e.camera.aspect}));
});
mkdirSync('artifacts/mirrors',{recursive:true});
await page.screenshot({path:'artifacts/mirrors/cockpit.png'});
for(const name of ['left','center','right']){
 await page.evaluate(name=>{const {THREE,car,scene,renderer,mirrors,camera}=window.mirrorTest;const e=mirrors.entries.find(e=>e.name===name);const center=e.surface.geometry.boundingBox.getCenter(new THREE.Vector3());camera.position.copy(center).add(new THREE.Vector3(name==='left'?.25:name==='right'?-.25:0,.06,.5));camera.lookAt(center);renderer.render(scene,camera)},name);
 await page.screenshot({path:`artifacts/mirrors/${name}-fit.png`});
}
console.log(JSON.stringify(data,null,2));await browser.close();
