import { chromium } from '@playwright/test';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5181/car-drive-3d/');
const result = await page.evaluate(async()=>{
 const THREE=await import('/car-drive-3d/node_modules/.vite/deps/three.js');
 const {GLTFLoader}=await import('/car-drive-3d/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const {DRACOLoader}=await import('/car-drive-3d/node_modules/three/examples/jsm/loaders/DRACOLoader.js');
 const draco=new DRACOLoader().setDecoderPath('/car-drive-3d/draco/');
 const {scene:root}=await new GLTFLoader().setDRACOLoader(draco).loadAsync('/car-drive-3d/models/ferrari.glb');
 root.updateMatrixWorld(true); const output=[];
 root.traverse(mesh=>{
  if(!mesh.isMesh|| !/glass|chrome/.test(mesh.name))return;
  const g=mesh.geometry,p=g.attributes.position,idx=g.index, count=idx?idx.count:p.count;
  const parents=Array.from({length:p.count},(_,i)=>i), keys=new Map();
  const find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
  const union=(a,b)=>{parents[find(a)]=find(b)};
  for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');if(keys.has(k))union(i,keys.get(k));else keys.set(k,i)}
  for(let i=0;i<count;i+=3){const a=idx?idx.getX(i):i,b=idx?idx.getX(i+1):i+1,c=idx?idx.getX(i+2):i+2;union(a,b);union(a,c)}
  const groups=new Map();
  for(let i=0;i<count;i+=3){const a=idx?idx.getX(i):i,k=find(a);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i/3)}
  const components=[...groups.values()].map(tris=>{const box=new THREE.Box3(),n=new THREE.Vector3();let area=0;for(const t of tris){const vs=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx?idx.getX(t*3+j):t*3+j).applyMatrix4(mesh.matrixWorld));vs.forEach(v=>box.expandByPoint(v));const normal=vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0]));area+=normal.length()/2;if(normal.z>=0)n.add(normal);else n.sub(normal)}return {triangles:tris.length,first:tris[0],min:box.min.toArray(),max:box.max.toArray(),normal:n.normalize().toArray(),area}});
 output.push({name:mesh.name,triangles:count/3,components});
 });draco.dispose();return output;
});
console.log(JSON.stringify(result,null,2));await browser.close();
