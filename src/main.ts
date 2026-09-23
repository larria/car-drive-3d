import './style.css';
import {initPwa} from './pwa';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadCar} from './car';
import {MirrorSystem} from './mirrors';
import {createWorld} from './world';
import {DrivingPhysics} from './physics';

const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div id="viewport"></div>
<header><a class="brand" href="#" aria-label="LARRIA 首页"><span class="brand-mark">L</span> LARRIA<span class="brand-divider"></span><span class="brand-sub">DRIVE LAB</span></a><div class="header-center">Larria的3d驾照考试练习场 <span> / </span> 自由练习 · 熟悉车感</div><div class="live"><i></i> 实时 3D <span id="fps">60 FPS</span></div></header>
<main>
<section class="intro"><div class="eyebrow">LARRIA DRIVING PRACTICE <span>01 / 01</span></div><h1>练好每一步，从容上路。</h1><p>Larria的3d驾照考试练习场 · 转向、倒车与视角练习</p></section>
<nav class="views" aria-label="视角"><button data-view="orbit" class="active"><span>◈</span> 自由环绕 <kbd>1</kbd></button><button data-view="cockpit"><span>◉</span> 驾驶座舱 <kbd>2</kbd></button><button data-view="follow"><span>➤</span> 跟随视角 <kbd>3</kbd></button></nav>
<aside class="model-card"><div class="eyebrow">SELECTED VEHICLE</div><h2>458 <span>ITALIA</span></h2><p>Ferrari · 双门运动轿跑</p><div class="model-line"></div><div class="swatch-label"><span>车身涂装</span><span id="paint-name">鼠尾草绿</span></div><div class="swatches"><button class="selected" data-color="#668d83" data-name="鼠尾草绿" style="--swatch:#668d83" aria-label="鼠尾草绿"></button><button data-color="#a31e22" data-name="经典红" style="--swatch:#a31e22" aria-label="经典红"></button><button data-color="#e7e3d8" data-name="珍珠白" style="--swatch:#e7e3d8" aria-label="珍珠白"></button><button data-color="#283538" data-name="石墨黑" style="--swatch:#283538" aria-label="石墨黑"></button><button data-color="#d6ad50" data-name="香槟金" style="--swatch:#d6ad50" aria-label="香槟金"></button></div><button id="lights-toggle" class="text-button">◌ &nbsp; 车灯 <span>关闭</span></button><button id="quality" class="text-button">◇ &nbsp; 渲染质量 <span>高</span></button></aside>
<section class="mirror-strip" aria-label="实时后视镜"><div class="mirror-heading"><span><i></i> 实时后视镜</span><button id="mirror-toggle">收起 −</button></div><div class="mirror-items">${[['left','左后视镜'],['center','内后视镜'],['right','右后视镜']].map(([id,label])=>`<button class="mirror-card" data-mirror="${id}" aria-label="放大${label}"><div class="mirror-image" id="mirror-${id}"></div><span>${label}<b>↗</b></span></button>`).join('')}</div><div class="mirror-note">实时后向镜像 · 驾驶辅助视角</div></section>
<div class="scene-caption"><span class="scene-dot"></span> 01 &nbsp; 开放练习场 <span class="caption-rule"></span><span id="scene-help">拖动环绕 · 滚轮缩放</span></div>
<div class="right-tools"><button id="reset" title="复位车辆 (R)">↺<span>复位</span></button><button id="help" title="操作指南">?<span>帮助</span></button></div>
<section class="drive-console"><div class="velocity"><div class="eyebrow">VELOCITY</div><div><strong id="speed">00</strong><span>km/h</span></div><small id="drive-state">车辆静止 · 踩下油门出发</small></div><div class="console-separator"></div><div class="gear-block"><span class="control-label">行驶档位</span><div class="gears"><button data-gear="R">R</button><button data-gear="N">N</button><button data-gear="D" class="active">D</button></div><small>停车后切换方向</small></div><div class="steering-block"><div id="steering-pad" role="slider" tabindex="0" aria-label="方向盘" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><svg id="steering-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" stroke-width="8"/><path d="M14 42L39 51L43 88M86 42L61 51L57 88" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><circle cx="50" cy="51" r="15" fill="currentColor"/><path d="M47 45L47 54L54 54" fill="none" stroke="#eaece7" stroke-width="2"/></svg></div><div><span class="control-label">方向盘</span><p><kbd>A</kbd> <kbd>D</kbd><span id="steer-value">0°</span></p><small>拖动转向 · 松手回正</small></div></div><div class="pedals"><button id="brake" class="pedal"><span class="pedal-grooves">▥</span><span>刹车 <kbd>S</kbd></span></button><button id="throttle" class="pedal accelerator"><span class="pedal-grooves">▥</span><span>油门 <kbd>W</kbd></span></button></div></section>
<footer><span>THREE.JS × CANNON-ES <span class="foot-divider">/</span> 实时驾驶交互</span><span>低速体验模式 · 非专业驾驶仿真 <button id="credits">模型来源 ↗</button></span></footer>
</main>
<div id="loading"><span class="loading-logo">L</span><h2>准备你的专属练习场</h2><p>正在载入精细车型与实时场景…</p></div>
<div id="toast" role="status"></div>
<dialog id="help-dialog"><button class="close-dialog">×</button><div class="eyebrow">DRIVER'S GUIDE</div><h2>准备好，出发。</h2><p>W / ↑ 油门 · S / ↓ / 空格 刹车<br>A / ← 左转 · D / → 右转<br>1 自由环绕 · 2 驾驶座舱 · 3 跟随视角<br>R 复位车辆 · Esc 关闭弹窗</p><p>屏幕方向盘可拖动，油门和刹车支持按住。<br>驾驶座舱内拖动画面转头，双击回正。<br>点击后视镜可以放大，切换 D / R 前请停车。</p><small>采用 cannon-es 射线车轮物理；非驾考评分系统。<br>后视镜采用实时后向镜像相机，并非精确光学反射。</small></dialog>
<dialog id="credits-dialog"><button class="close-dialog">×</button><div class="eyebrow">ASSET CREDITS</div><h2>关于这辆车</h2><p>Ferrari 458 Italia · 原作者 vicent091036<br>模型来自 Three.js 官方汽车材质示例。<br>本项目调整材质并加入物理、视角、踏板与实时镜面。</p><p><a href="https://threejs.org/examples/webgl_materials_car.html" target="_blank" rel="noopener">Three.js 官方示例 ↗</a><br><a href="https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6" target="_blank" rel="noopener">原模型页面与许可 ↗</a></p><small>本站发布者已确认拥有模型公开发布授权。<br>模型与品牌权利归原权利人；不以开源库许可替代模型许可。</small></dialog>
<div id="expanded-wrap" hidden><div class="expanded-head"><span id="expanded-name">后视镜</span><button id="close-expanded">关闭 ×</button></div><div id="mirror-expanded"></div><p>实时后向镜像 · 与对应小窗口相同视角</p></div>`;

const $=(s:string)=>document.querySelector<HTMLElement>(s)!;
let toastTimer:ReturnType<typeof setTimeout>;
function toast(text:string){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2600);}

initPwa();

async function init(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.autoClear=false;
  $('#viewport').appendChild(renderer.domElement);
  const scene=new THREE.Scene();const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.7;
  const ground=createWorld(scene);
  scene.add(new THREE.HemisphereLight(0xe1edff,0x8a8974,2));
  const sun=new THREE.DirectionalLight(0xffefdc,3.6);sun.position.set(-16,24,-18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const car=await loadCar();scene.add(car.root);
  const physics=new DrivingPhysics();ground.walls.forEach(w=>physics.addBox(w.x,w.y,w.z,w.sx,w.sy,w.sz));
  const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.04,350);camera.position.set(-6,3.25,-6.6);
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.65,0);orbit.enableDamping=true;orbit.minDistance=2.5;orbit.maxDistance=16;orbit.maxPolarAngle=Math.PI*.48;orbit.enablePan=false;
  const eye=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.03,250);
  const mirrors=new MirrorSystem(car.root);
  let view='orbit',expanded:string|null=null,quality=true,headlights=false,headYaw=0,headPitch=0;
  const lamps:THREE.SpotLight[]=[];
  for(const x of [-.66,.66]){
    const light=new THREE.SpotLight(0xf4f8ff,0,30,.46,.6,1);light.position.set(x,.65,-1.8);light.target.position.set(x,.1,-16);car.root.add(light,light.target);lamps.push(light);
  }
  const keys=new Set<string>();const held={throttle:false,brake:false};let dragSteer=0,dragging=false;
  const prevPos=new THREE.Vector3();
  function setView(next:string){view=next;orbit.enabled=view==='orbit';headYaw=headPitch=0;document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',(e as HTMLElement).dataset.view===view));$('#scene-help').textContent=view==='orbit'?'拖动环绕 · 滚轮缩放':view==='cockpit'?'拖动转头 · 双击回正':'车辆跟随 · 自由驾驶';document.body.dataset.view=view;
    if(view==='orbit'){camera.position.copy(car.root.localToWorld(new THREE.Vector3(-6,3.25,-6.6)));orbit.target.copy(car.root.position).add(new THREE.Vector3(0,.65,0));camera.fov=38;camera.updateProjectionMatrix();}
    else{camera.fov=view==='cockpit'?70:48;camera.updateProjectionMatrix();}
  }
  document.querySelectorAll<HTMLElement>('[data-view]').forEach(e=>e.onclick=()=>setView(e.dataset.view!));
  document.querySelectorAll<HTMLElement>('[data-gear]').forEach(e=>e.onclick=()=>{if(physics.setGear(e.dataset.gear as 'D'|'N'|'R')){document.querySelectorAll('[data-gear]').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.gear===physics.gear));}else toast('请先刹停车辆，再切换行驶方向');});
  document.querySelectorAll<HTMLElement>('[data-color]').forEach(e=>e.onclick=()=>{car.paint.color.set(e.dataset.color!);$('#paint-name').textContent=e.dataset.name!;document.querySelectorAll('[data-color]').forEach(b=>b.classList.toggle('selected',b===e));});
  const release=()=>{keys.clear();held.throttle=held.brake=false;dragging=false;dragSteer=0;};
  window.addEventListener('blur',release);document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='Digit1')setView('orbit');if(e.code==='Digit2')setView('cockpit');if(e.code==='Digit3')setView('follow');if(e.code==='KeyR')reset();if(e.code==='Escape')closeExpanded();
  });document.addEventListener('keyup',e=>keys.delete(e.code));
  for(const name of ['throttle','brake'] as const){const el=$(`#${name}`);el.onpointerdown=e=>{el.setPointerCapture(e.pointerId);held[name]=true;};el.onpointerup=el.onpointercancel=()=>held[name]=false;el.onlostpointercapture=()=>held[name]=false;}
  let startX=0;
  $('#steering-pad').onpointerdown=e=>{dragging=true;startX=e.clientX;$('#steering-pad').setPointerCapture(e.pointerId);};
  $('#steering-pad').onpointermove=e=>{if(dragging)dragSteer=THREE.MathUtils.clamp((startX-e.clientX)/95,-1,1);};
  $('#steering-pad').onpointerup=$('#steering-pad').onpointercancel=()=>{dragging=false;dragSteer=0;};
  let looking=false,lastX=0,lastY=0;
  renderer.domElement.addEventListener('pointerdown',e=>{if(view==='cockpit'){looking=true;lastX=e.clientX;lastY=e.clientY;renderer.domElement.setPointerCapture(e.pointerId);}});
  renderer.domElement.addEventListener('pointermove',e=>{if(looking){headYaw=THREE.MathUtils.clamp(headYaw-(e.clientX-lastX)*.004,-1.25,1.25);headPitch=THREE.MathUtils.clamp(headPitch-(e.clientY-lastY)*.003,-.65,.5);lastX=e.clientX;lastY=e.clientY;}});
  renderer.domElement.addEventListener('pointerup',()=>looking=false);renderer.domElement.addEventListener('pointercancel',()=>looking=false);renderer.domElement.addEventListener('dblclick',()=>{headYaw=headPitch=0;});
  function reset(){release();physics.reset();car.root.position.set(0,0,0);car.root.quaternion.identity();prevPos.set(0,0,0);setView(view);document.querySelectorAll<HTMLElement>('[data-gear]').forEach(b=>b.classList.toggle('active',b.dataset.gear===physics.gear));toast('车辆已复位');}
  $('#reset').onclick=reset;
  $('#lights-toggle').onclick=()=>{headlights=!headlights;lamps.forEach(l=>l.intensity=headlights?18:0);$('#lights-toggle span').textContent=headlights?'开启':'关闭';toast(headlights?'车灯已开启':'车灯已关闭');};
  $('#quality').onclick=()=>{quality=!quality;renderer.setPixelRatio(Math.min(devicePixelRatio,quality?1.7:1));$('#quality span').textContent=quality?'高':'流畅';};
  $('#mirror-toggle').onclick=()=>{mirrors.enabled=!mirrors.enabled;$('.mirror-items').hidden=!mirrors.enabled;$('.mirror-note').hidden=!mirrors.enabled;$('#mirror-toggle').textContent=mirrors.enabled?'收起 −':'展开 +';if(!mirrors.enabled)closeExpanded();};
  const names:Record<string,string>={left:'左后视镜',center:'内后视镜',right:'右后视镜'};
  document.querySelectorAll<HTMLElement>('[data-mirror]').forEach(e=>e.onclick=()=>{expanded=e.dataset.mirror!;$('#expanded-name').textContent=names[expanded];$('#expanded-wrap').hidden=false;});
  function closeExpanded(){expanded=null;$('#expanded-wrap').hidden=true;}
  $('#close-expanded').onclick=closeExpanded;
  $('#help').onclick=()=>{release();($('#help-dialog') as HTMLDialogElement).showModal();};$('#credits').onclick=()=>{release();($('#credits-dialog') as HTMLDialogElement).showModal();};document.querySelectorAll<HTMLElement>('.close-dialog').forEach(e=>e.onclick=()=>e.closest('dialog')!.close());
  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=eye.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();eye.updateProjectionMatrix();});
  $('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),700);
  let last=performance.now(),mirrorTime=0,frames=0,fpsTime=last;
  const forward=new THREE.Vector3(),target=new THREE.Vector3(),delta=new THREE.Vector3();
  const debug={view,physics,car,mirrors,renderer,scene,camera,setView,reset,ready:true};(window as unknown as {larria:typeof debug}).larria=debug;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;
    const modal=!!document.querySelector('dialog[open]');
    const input={throttle:!modal&&(held.throttle||keys.has('KeyW')||keys.has('ArrowUp'))?1:0,brake:modal?1:(held.brake||keys.has('KeyS')||keys.has('ArrowDown')||keys.has('Space')?1:0),steer:dragging?dragSteer:(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0)};
    physics.update(dt,input);
    car.root.position.set(physics.chassis.position.x,physics.chassis.position.y-.65,physics.chassis.position.z);car.root.quaternion.set(physics.chassis.quaternion.x,physics.chassis.quaternion.y,physics.chassis.quaternion.z,physics.chassis.quaternion.w);
    car.update(physics.speed,physics.steering,input.brake,input.throttle,physics.gear,dt);
    delta.copy(car.root.position).sub(prevPos);prevPos.copy(car.root.position);
    eye.position.copy(car.root.localToWorld(new THREE.Vector3(-.34,1.015,.20)));eye.quaternion.copy(car.root.quaternion);eye.updateMatrixWorld();
    if(view==='orbit'){camera.position.add(delta);orbit.target.add(delta);orbit.update();}
    else if(view==='cockpit'){camera.position.copy(eye.position);camera.quaternion.copy(eye.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(headPitch,headYaw,0,'YXZ')));}
    else{target.copy(car.root.localToWorld(new THREE.Vector3(0,2.6,6.7)));camera.position.lerp(target,1-Math.exp(-dt*5));forward.copy(car.root.localToWorld(new THREE.Vector3(0,.7,-2)));camera.lookAt(forward);}
    sun.position.copy(car.root.position).add(new THREE.Vector3(-16,24,-18));sun.target.position.copy(car.root.position);
    renderer.shadowMap.autoUpdate=true;
    renderer.setRenderTarget(null);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();renderer.render(scene,camera);
    renderer.shadowMap.autoUpdate=false;
    if(now-mirrorTime>(quality?50:100)){mirrors.update(renderer,scene,eye);mirrorTime=now;}
    renderer.setRenderTarget(null);mirrors.draw(renderer,expanded);
    $('#speed').textContent=Math.round(Math.abs(physics.speed)*3.6).toString().padStart(2,'0');$('#drive-state').textContent=Math.abs(physics.speed)<.15?'车辆静止 · 踩下油门出发':input.brake?'正在制动':physics.gear==='R'?'倒车中 · 注意后方':'行驶中 · 保持专注';
    $('#steering-svg').style.transform=`rotate(${-physics.steering*12*180/Math.PI}deg)`;$('#steer-value').textContent=`${Math.round(physics.steering*180/Math.PI)}°`;$('#steering-pad').setAttribute('aria-valuenow',String(Math.round(physics.steering/.5*100)));
    $('#throttle').classList.toggle('pressed',input.throttle>0);$('#brake').classList.toggle('pressed',input.brake>0);
    debug.view=view;frames++;if(now-fpsTime>1000){$('#fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;frames=0;fpsTime=now;}
  });
}
init().catch(err=>{console.error(err);$('#loading').innerHTML='<h2>场景未能加载</h2><p>请检查 WebGL 支持和本地资源，然后刷新重试。</p><pre></pre>';$('#loading pre').textContent=String(err);});
