import './style.css';
import {initPwa} from './pwa';
import {DrivingUi, CockpitLook} from './driving-ui';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {loadCar} from './car';
import {MirrorSystem} from './mirrors';
import {createWorld} from './world';
import {DrivingPhysics, type Gear} from './physics';
import {ExamSession} from './exam-session';
import {ExamUi} from './exam-ui';
import {RIGHT_ANGLE} from './courses/right-angle';
import {getCourse} from './courses';
import {VEHICLE} from './vehicle-config';
import {createSettingsStore, PAINTS, type Settings} from './settings';
import {DrivingControls} from './driving-controls';
import {practiceBounds} from './practice-layout';

const settingsStore=createSettingsStore();
const app=document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML=`
<div id="viewport"></div>
<header><a class="brand" href="#" aria-label="LARRIA 首页"><span class="brand-mark">L</span> LARRIA<span class="brand-divider"></span><span class="brand-sub">DRIVE LAB</span></a><div class="header-center">Larria的3d驾照考试练习场 <span> / </span> 科目二 · 精准驾驶</div><div class="live"><i></i> 实时 3D <span id="fps">60 FPS</span></div></header>
<main>
<section class="intro"><div class="eyebrow">LARRIA DRIVING PRACTICE <span>01 / 01</span></div><h1>练好每一步，从容上路。</h1><p>Larria的3d驾照考试练习场 · 转向、倒车与视角练习</p></section>
<nav class="views" aria-label="视角"><button data-view="orbit" class="active"><span>◈</span> 自由环绕 <kbd>1</kbd></button><button data-view="cockpit"><span>◉</span> 驾驶座舱 <kbd>2</kbd></button><button data-view="follow"><span>➤</span> 跟随视角 <kbd>3</kbd></button></nav>
<aside class="model-card"><div class="eyebrow">SELECTED VEHICLE</div><h2>458 <span>ITALIA</span></h2><p>Ferrari · 双门运动轿跑</p><div class="model-line"></div><div class="swatch-label"><span>车身涂装</span><span id="paint-name">鼠尾草绿</span></div><div class="swatches"><button class="selected" data-color="#668d83" data-name="鼠尾草绿" style="--swatch:#668d83" aria-label="鼠尾草绿"></button><button data-color="#a31e22" data-name="经典红" style="--swatch:#a31e22" aria-label="经典红"></button><button data-color="#e7e3d8" data-name="珍珠白" style="--swatch:#e7e3d8" aria-label="珍珠白"></button><button data-color="#283538" data-name="石墨黑" style="--swatch:#283538" aria-label="石墨黑"></button><button data-color="#d6ad50" data-name="香槟金" style="--swatch:#d6ad50" aria-label="香槟金"></button></div><button id="lights-toggle" class="text-button">◌ &nbsp; 车灯 <span>关闭</span></button><button id="quality" class="text-button">◇ &nbsp; 渲染质量 <span>高</span></button></aside>
<section class="mirror-strip" aria-label="实时后视镜"><div class="mirror-heading"><span><i></i> 实时后视镜</span><button id="mirror-toggle">收起 −</button></div><div class="mirror-items">${[['left','左后视镜'],['center','内后视镜'],['right','右后视镜']].map(([id,label])=>`<button class="mirror-card" data-mirror="${id}" aria-label="放大${label}"><div class="mirror-image" id="mirror-${id}"></div><span>${label}<b>↗</b></span></button>`).join('')}</div><div class="mirror-note">实时后向镜像 · 驾驶辅助视角</div></section>
<div class="scene-caption"><span class="scene-dot"></span> <span id="course-caption">01 &nbsp; 直角转弯考场</span> <span class="caption-rule"></span><span id="scene-help">拖动环绕 · 滚轮缩放</span></div>
<div class="right-tools"><button id="settings-running" type="button" title="设置">⚙<span>设置</span></button><button id="look-lock" type="button" aria-pressed="false" hidden>锁定环视</button><button id="look-center" type="button" hidden>回正视角</button><button id="focus-toggle" type="button" aria-pressed="false">专注驾驶</button><button id="reset" title="复位车辆 (R)">↺<span>复位</span></button><button id="help" title="操作指南">?<span>帮助</span></button></div>
<section class="drive-console"><div class="velocity"><div class="eyebrow">VELOCITY</div><div><strong id="speed">00</strong><span>km/h</span></div><small id="drive-state">车辆静止 · 踩下油门出发</small></div><div class="console-separator"></div><div class="gear-block"><span class="control-label">行驶档位</span><div class="gears"><button data-gear="R">R</button><button data-gear="N">N</button><button data-gear="D" class="active">D</button></div><small>停车后切换方向</small></div><div class="steering-block"><div id="steering-pad" role="slider" tabindex="0" aria-label="方向盘" aria-valuemin="-100" aria-valuemax="100" aria-valuenow="0"><svg id="steering-svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="39" fill="none" stroke="currentColor" stroke-width="8"/><path d="M14 42L39 51L43 88M86 42L61 51L57 88" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><circle cx="50" cy="51" r="15" fill="currentColor"/><path d="M47 45L47 54L54 54" fill="none" stroke="#eaece7" stroke-width="2"/></svg></div><div><span class="control-label">方向盘</span><p><kbd>A</kbd> <kbd>D</kbd><span id="steer-value">0°</span></p><small>拖动转向 · 松手回正</small></div></div><div class="pedals"><button id="brake" class="pedal"><span class="pedal-grooves">▥</span><span>刹车 <kbd>空格</kbd></span></button><button id="throttle" class="pedal accelerator"><span class="pedal-grooves">▥</span><span>油门 <kbd>W</kbd></span></button></div></section>
<footer><span>THREE.JS × CANNON-ES <span class="foot-divider">/</span> 实时驾驶交互</span><span>低速体验模式 · 非专业驾驶仿真 <button id="credits">模型来源 ↗</button></span></footer>
</main>
<div id="loading"><span class="loading-logo">L</span><h2>准备你的专属练习场</h2><p>正在载入精细车型与实时场景…</p></div>
<button id="toast" type="button" role="status" aria-label="关闭提示" aria-hidden="true" tabindex="-1"></button>
<dialog id="settings-dialog" aria-label="驾驶设置"><button class="close-dialog" type="button" aria-label="关闭设置">×</button><div class="eyebrow">DRIVE LAB / PREFERENCES</div><h2>驾驶设置</h2><p>偏好保存在本机浏览器。车辆位置和考试进度不会保存。</p><label class="setting-row"><span><strong>拟真操作</strong><small>关闭（默认）：W 前进、S 制动至停稳后倒车；倒车时 W 刹停后前进。开启：W 油门、S 纯刹车，Z / X / C 手动换档。</small></span><input id="setting-realistic" type="checkbox"></label><label class="setting-row"><span><strong>车身涂装</strong><small>即时预览，刷新后保留。</small></span><select id="setting-paint">${PAINTS.map(item=>`<option value="${item.color}">${item.name}</option>`).join('')}</select></label><label class="setting-row"><span><strong>车灯</strong></span><input id="setting-lights" type="checkbox"></label><label class="setting-row"><span><strong>渲染质量</strong></span><select id="setting-quality"><option value="high">高</option><option value="smooth">流畅</option></select></label><label class="setting-row"><span><strong>车外后视镜窗口</strong></span><input id="setting-mirrors" type="checkbox"></label><p class="settings-warning">空格及触屏刹车始终只刹车；Z / X / C 可手动选择 R / N / D，N 档仍受换挡保护。考试规则不因操作模式改变：直角和曲线禁止实际倒退，停车遵循原有方向及时间判定。运行中打开设置会暂停；关闭后请显式点击继续。</p></dialog>
	<dialog id="help-dialog"><button class="close-dialog">×</button><div class="eyebrow">DRIVER'S GUIDE</div><h2>准备好，出发。</h2><p id="help-controls"></p><p>A / ← 左转 · D / → 右转<br>1 自由环绕 · 2 驾驶座舱 · 3 跟随视角<br>Z R档 · X N档 · C D档<br>R 复位当前项目 · Esc 暂停 / 关闭弹窗</p><p>屏幕方向盘可拖动，油门和刹车支持按住。<br>驾驶座舱中移动鼠标即可转头，触屏单指拖动。点击“锁定环视”可不受画布边缘限制连续转头，Esc 先解锁、再次按下才暂停；浏览器拒绝时继续悬停转头。双击场景或点击“回正视角”回正。<br>操作车辆自动收起无关面板，可点“显示面板”恢复。<br>座舱镜面直接显示后方，车外镜窗口可放大。切换 D / R 前请停车。</p><small>采用 cannon-es 射线车轮物理；参考场地规则判定，不设置分数。<br>后视镜采用实时后向镜像相机，并非精确光学反射。</small></dialog>
<dialog id="credits-dialog"><button class="close-dialog">×</button><div class="eyebrow">ASSET CREDITS</div><h2>关于这辆车</h2><p>Ferrari 458 Italia · 原作者 vicent091036<br>模型来自 Three.js 官方汽车材质示例。<br>本项目调整材质并加入物理、视角、踏板与实时镜面。</p><p><a href="https://threejs.org/examples/webgl_materials_car.html" target="_blank" rel="noopener">Three.js 官方示例 ↗</a><br><a href="https://sketchfab.com/models/57bf6cc56931426e87494f554df1dab6" target="_blank" rel="noopener">原模型页面与许可 ↗</a></p><small>本站发布者已确认拥有模型公开发布授权。<br>模型与品牌权利归原权利人；不以开源库许可替代模型许可。</small></dialog>
<div id="expanded-wrap" hidden><div class="expanded-head"><span id="expanded-name">后视镜</span><button id="close-expanded">关闭 ×</button></div><div id="mirror-expanded"></div><p>实时后向镜像 · 与对应小窗口相同视角</p></div>`;

const $=(s:string)=>document.querySelector<HTMLElement>(s)!;
let toastTimer:ReturnType<typeof setTimeout>;
const toastElement=$('#toast');
function dismissToast(){clearTimeout(toastTimer);toastElement.classList.remove('show');toastElement.setAttribute('aria-hidden','true');toastElement.tabIndex=-1;}
function toast(text:string){toastElement.textContent=text;toastElement.setAttribute('aria-hidden','false');toastElement.tabIndex=0;toastElement.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(dismissToast,4500);}
toastElement.addEventListener('click',dismissToast);
toastElement.addEventListener('keydown',event=>{if(event.key==='Escape'){dismissToast();event.stopPropagation();}});

// Utility footer must sit outside the fixed driving layer stacking context.
app.appendChild(document.querySelector('footer')!);
initPwa(toast);

async function init(){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.autoClear=false;
  $('#viewport').appendChild(renderer.domElement);
  const scene=new THREE.Scene();const pmrem=new THREE.PMREMGenerator(renderer);const room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.environmentIntensity=.7;
  const ground=createWorld(scene);
  scene.add(new THREE.HemisphereLight(0xe1edff,0x8a8974,2));
  const sun=new THREE.DirectionalLight(0xffefdc,3.6);sun.position.set(-16,24,-18);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;sun.shadow.normalBias=.035;sun.shadow.bias=-.0002;scene.add(sun,sun.target);
  const car=await loadCar();scene.add(car.root);
  const physics=new DrivingPhysics();physics.reset(RIGHT_ANGLE.start.x,RIGHT_ANGLE.start.z);ground.walls.forEach(w=>physics.addBox(w.x,w.y,w.z,w.sx,w.sy,w.sz));
  const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.04,350);camera.position.set(-6,3.25,-6.6);
  const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(0,.65,0);orbit.enableDamping=true;orbit.minDistance=2.5;orbit.maxDistance=16;orbit.maxPolarAngle=Math.PI*.48;orbit.enablePan=false;
  const eye=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,.03,250);
  const mirrors=new MirrorSystem(car.root,car.profile);
  let view:'orbit'|'cockpit'|'follow'='orbit',expanded:string|null=null;
  let settings=settingsStore.get();
  let quality=settings.quality==='high',headlights=settings.headlights,mirrorsExpanded=settings.mirrorsExpanded;
  const controls=new DrivingControls();
  const lamps:THREE.SpotLight[]=[];
  for(const x of [-.66,.66]){
    const light=new THREE.SpotLight(0xf4f8ff,0,30,.46,.6,1);light.position.set(x,.65,-1.8);light.target.position.set(x,.1,-16);car.root.add(light,light.target);lamps.push(light);
  }
  const keys=new Set<string>();const held={throttle:new Set<number>(),brake:new Set<number>()};let dragSteer=0,steeringOwner:number|null=null,steerTarget=0,steerCurrent=0;
  const prevPos=new THREE.Vector3();
  const drivingUi=new DrivingUi($('#focus-toggle') as HTMLButtonElement);
  const session=new ExamSession();
  const look=new CockpitLook(renderer.domElement,()=>view==='cockpit'&&session.state==='running', $('#look-lock') as HTMLButtonElement, toast);
  $('#look-lock').onclick=()=>{void look.lock();renderer.domElement.focus({preventScroll:true});};
  $('#look-center').onclick=()=>{look.reset();toast('视角已回正');};
  const examUi=new ExamUi(session,action=>{
    if(action==='select:practice'){release();session.selectPractice();ground.setPractice();resetPose();setView('orbit');$('#course-caption').textContent='05　自由练习场';examUi.render();}
    else if(action==='select'||action.startsWith('select:')){release();session.select(getCourse(action.split(':')[1]??'right-angle'));ground.setCourse(session.course);resetPose();setView('orbit');$('#course-caption').textContent=`${session.course.number}　${session.course.name}考场`;examUi.render();}
    if(action==='start')reset(true);
    if(action==='retry')reset();
    if(action==='pause')pause();
    if(action==='settings')openSettings();
    if(action==='resume'){release();physics.clearAccumulator();session.resume();examUi.render();focusScene();toast(`已继续${session.mode==='practice'?'练习':'考试'} · 请重新按下驾驶键`);}
    if(action==='exit'){release();session.exit();ground.setCourse(session.course);resetPose();drivingUi.setFocused(false);setView('orbit');$('#course-caption').textContent=`${session.course.number}　${session.course.name}考场`;examUi.render();}
  });
  function pause(reason?:string){if(session.state!=='running')return;release();physics.clearAccumulator();session.pause(reason);examUi.render();}
  function syncGear(){document.querySelectorAll<HTMLElement>('[data-gear]').forEach(b=>b.classList.toggle('active',b.dataset.gear===physics.gear));}
  function requestGear(gear:Gear){if(session.state!=='running')return false;controls.manual(gear);if(!physics.setGear(gear)){toast(gear==='R'?'车辆仍在前进，请刹停后挂 R 档':gear==='D'?'车辆仍在倒退，请刹停后挂 D 档':'请先刹停车辆，再切换行驶方向');return false;}syncGear();return true;}
  function openSettings(){if(session.state==='running')pause('设置已打开，关闭后请点击继续。');release();($('#settings-dialog') as HTMLDialogElement).showModal();}
  function applySettings(next:Settings){
    settings=next;quality=settings.quality==='high';headlights=settings.headlights;mirrorsExpanded=settings.mirrorsExpanded;
    const color=PAINTS.find(item=>item.color===settings.paint)!;
    car.paint.color.set(settings.paint);$('#paint-name').textContent=color.name;
    document.querySelectorAll<HTMLElement>('[data-color]').forEach(b=>b.classList.toggle('selected',b.dataset.color===settings.paint));
    lamps.forEach(l=>l.intensity=headlights?18:0);$('#lights-toggle span').textContent=headlights?'开启':'关闭';
    renderer.setPixelRatio(Math.min(devicePixelRatio,quality?1.7:1));$('#quality span').textContent=quality?'高':'流畅';
    $('.mirror-items').hidden=!mirrorsExpanded;$('.mirror-note').hidden=!mirrorsExpanded;$('#mirror-toggle').textContent=mirrorsExpanded?'收起 −':'展开 +';if(!mirrorsExpanded)closeExpanded();
    ($('#setting-realistic') as HTMLInputElement).checked=settings.realisticControls;
    ($('#setting-paint') as HTMLSelectElement).value=settings.paint;
    ($('#setting-lights') as HTMLInputElement).checked=headlights;
    ($('#setting-quality') as HTMLSelectElement).value=settings.quality;
    ($('#setting-mirrors') as HTMLInputElement).checked=mirrorsExpanded;
    $('#help-controls').textContent=settings.realisticControls?'拟真：W / ↑ 油门 · S / ↓ / 空格 纯刹车':'游戏化：W / ↑ 前进 · S / ↓ 刹停后倒车 · 空格纯刹车';
    document.querySelectorAll<HTMLElement>('[data-control-description]').forEach(el=>el.textContent=settings.realisticControls?'W 油门 · S / 空格刹车 · Z / X / C 换档':'W 前进 · S 刹停后倒车 · 空格纯刹车 · Z / X / C 可手动换档');
    $('#brake kbd').textContent=settings.realisticControls?'S / 空格':'空格';
    examUi.setControlsRealistic(settings.realisticControls);
  }
  function changeSettings(patch:Partial<Settings>){const changedMode=patch.realisticControls!==undefined&&patch.realisticControls!==settings.realisticControls;if(changedMode){release();}applySettings(settingsStore.update(patch));}
  ($('#setting-realistic') as HTMLInputElement).onchange=e=>changeSettings({realisticControls:(e.target as HTMLInputElement).checked});
  ($('#setting-paint') as HTMLSelectElement).onchange=e=>changeSettings({paint:(e.target as HTMLSelectElement).value});
  ($('#setting-lights') as HTMLInputElement).onchange=e=>changeSettings({headlights:(e.target as HTMLInputElement).checked});
  ($('#setting-quality') as HTMLSelectElement).onchange=e=>changeSettings({quality:(e.target as HTMLSelectElement).value as Settings['quality']});
  ($('#setting-mirrors') as HTMLInputElement).onchange=e=>changeSettings({mirrorsExpanded:(e.target as HTMLInputElement).checked});
  $('#settings-running').onclick=openSettings;
  function setView(next:'orbit'|'cockpit'|'follow'){if(next!==view)look.unlock();view=next;orbit.enabled=view==='orbit';look.reset();$('#look-lock').hidden=view!=='cockpit'||!matchMedia('(pointer:fine)').matches;$('#look-center').hidden=view!=='cockpit';document.querySelectorAll('button[data-view]').forEach(e=>e.classList.toggle('active',(e as HTMLElement).dataset.view===view));$('#scene-help').textContent=view==='orbit'?'拖动环绕 · 滚轮缩放':view==='cockpit'?'移动鼠标转头 · 双击回正':'车辆跟随 · 自由驾驶';document.body.dataset.view=view;mirrors.showSurfaces(view==='cockpit');$('.mirror-strip').hidden=view==='cockpit';if(view==='cockpit')closeExpanded();
    if(view==='orbit'&&(session.mode==='practice'||!session.active)){const b=session.mode==='practice'?practiceBounds:session.course.bounds;const center=new THREE.Vector3((b.minX+b.maxX)/2,0,(b.minZ+b.maxZ)/2);const extent=Math.max(b.maxX-b.minX,b.maxZ-b.minZ);orbit.maxDistance=session.mode==='practice'?145:80;orbit.target.copy(center);camera.position.copy(center).add(session.mode==='practice'?new THREE.Vector3(-extent*.06,extent*.92,extent*.12):new THREE.Vector3(-extent*.2,extent*1.7,extent*.8));camera.fov=48;camera.updateProjectionMatrix();orbit.update();}
    else if(view==='orbit'){orbit.maxDistance=16;camera.position.copy(car.root.localToWorld(new THREE.Vector3(-6,3.25,-6.6)));orbit.target.copy(car.root.position).add(new THREE.Vector3(0,.65,0));camera.fov=38;camera.updateProjectionMatrix();}
    else{camera.fov=view==='cockpit'?70:48;camera.updateProjectionMatrix();}
  }
  document.querySelectorAll<HTMLElement>('button[data-view]').forEach(e=>e.onclick=()=>{setView(e.dataset.view as typeof view);focusScene();});
  document.querySelectorAll<HTMLElement>('[data-gear]').forEach(e=>{const key={R:'Z',N:'X',D:'C'}[e.dataset.gear!];e.title=`${e.dataset.gear} 档 (${key})`;e.innerHTML=`${e.dataset.gear}<kbd>${key}</kbd>`;e.onclick=()=>requestGear(e.dataset.gear as Gear);});
  document.querySelectorAll<HTMLElement>('[data-color]').forEach(e=>e.onclick=()=>changeSettings({paint:e.dataset.color!}));
  const release=()=>{controls.release();keys.clear();for(const name of ['throttle','brake'] as const){const el=$(`#${name}`);for(const id of held[name])if(el.hasPointerCapture(id))el.releasePointerCapture(id);held[name].clear();}const pad=$('#steering-pad');if(steeringOwner!==null&&pad.hasPointerCapture(steeringOwner))pad.releasePointerCapture(steeringOwner);steeringOwner=null;dragSteer=steerTarget=steerCurrent=0;look.unlock();};
  window.addEventListener('blur',()=>pause('窗口已失去焦点。确认准备好后继续。'));document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(`你离开了${session.mode==='practice'?'练习':'考试'}窗口。确认准备好后继续。`);});
  const drivingCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space']);
  const commandCodes=new Set(['KeyZ','KeyX','KeyC','Digit1','Digit2','Digit3','KeyR','Escape']);
  const textFocus=(target:EventTarget|null)=>target instanceof HTMLElement&&!!target.closest('input,textarea,select,button,a,[contenteditable],[role="textbox"],[role="button"]')&&target!==renderer.domElement;
  const activeUiFocus=()=>textFocus(document.activeElement)||document.activeElement?.getAttribute('role')==='slider';
  // Explicitly starting/resuming or clicking a view leaves a focused button; return focus to the scene.
  const focusScene=()=>renderer.domElement.focus({preventScroll:true});
  renderer.domElement.tabIndex=-1;
  // Pointer steering leaves focus on its slider; release that focus before keyboard driving.
  document.addEventListener('keydown',e=>{
    if(session.state!=='running'||document.querySelector('dialog[open]')||e.ctrlKey||e.metaKey||e.altKey||activeUiFocus()||textFocus(e.target))return;
    if(!drivingCodes.has(e.code)&&!commandCodes.has(e.code))return;
    e.preventDefault();
    if(e.repeat)return;
    if(drivingCodes.has(e.code)){if(!keys.has(e.code))drivingUi.beginOperation();keys.add(e.code);return;}
    if(e.code==='Escape'){if(look.consumeEscape())return;if(expanded){closeExpanded();return;}pause();return;}
    if(['KeyZ','KeyX','KeyC'].includes(e.code)){requestGear(({KeyZ:'R',KeyX:'N',KeyC:'D'} as Record<string,Gear>)[e.code]);return;}
    if(e.code==='Digit1')setView('orbit');if(e.code==='Digit2')setView('cockpit');if(e.code==='Digit3')setView('follow');if(e.code==='KeyR')reset();
  });document.addEventListener('keyup',e=>{keys.delete(e.code);if(['KeyW','ArrowUp','KeyS','ArrowDown'].includes(e.code))controls.reset();});
  for(const name of ['throttle','brake'] as const){const el=$(`#${name}`);el.onpointerdown=e=>{if(session.state!=='running')return;el.setPointerCapture(e.pointerId);held[name].add(e.pointerId);drivingUi.beginOperation();};const end=(e:PointerEvent)=>{held[name].delete(e.pointerId);};el.onpointerup=el.onpointercancel=el.onlostpointercapture=end;}
  let startX=0;
  const pad=$('#steering-pad');
  pad.onpointerdown=e=>{if(session.state!=='running'||steeringOwner!==null)return;e.preventDefault();drivingUi.beginOperation();steeringOwner=e.pointerId;startX=e.clientX;pad.setPointerCapture(e.pointerId);};
  pad.onpointermove=e=>{if(steeringOwner===e.pointerId)dragSteer=THREE.MathUtils.clamp((startX-e.clientX)/95,-1,1);};
  const endSteering=(e:PointerEvent)=>{if(steeringOwner!==e.pointerId)return;steeringOwner=null;dragSteer=0;};
  pad.onpointerup=pad.onpointercancel=pad.onlostpointercapture=endSteering;
  function resetPose(){const start=session.mode==='practice'?{x:0,z:0,startYaw:0}: {...session.course.start,startYaw:session.course.startYaw};physics.reset(start.x,start.z,start.startYaw);car.root.position.set(start.x,0,start.z);car.root.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),start.startYaw);prevPos.copy(car.root.position);}
  function reset(firstStart=false){release();drivingUi.setFocused(true);resetPose();session.start();setView(firstStart?'cockpit':view);examUi.render();focusScene();syncGear();}
  $('#reset').onclick=()=>reset();
  $('#lights-toggle').onclick=()=>{changeSettings({headlights:!headlights});toast(headlights?'车灯已开启':'车灯已关闭');};
  $('#quality').onclick=()=>changeSettings({quality:quality?'smooth':'high'});
  $('#mirror-toggle').onclick=()=>changeSettings({mirrorsExpanded:!mirrorsExpanded});
  const names:Record<string,string>={left:'左后视镜',center:'内后视镜',right:'右后视镜'};
  document.querySelectorAll<HTMLElement>('[data-mirror]').forEach(e=>e.onclick=()=>{look.unlock();expanded=e.dataset.mirror!;$('#expanded-name').textContent=names[expanded];$('#expanded-wrap').hidden=false;});
  function closeExpanded(){expanded=null;$('#expanded-wrap').hidden=true;}
  $('#close-expanded').onclick=closeExpanded;
  $('#help').onclick=()=>{pause(`操作指南已打开，关闭后可继续${session.mode==='practice'?'练习':'考试'}。`);release();($('#help-dialog') as HTMLDialogElement).showModal();};$('#credits').onclick=()=>{pause();release();($('#credits-dialog') as HTMLDialogElement).showModal();};document.querySelectorAll<HTMLElement>('.close-dialog').forEach(e=>e.onclick=()=>e.closest('dialog')!.close());
  window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=eye.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();eye.updateProjectionMatrix();});
  applySettings(settings);
  $('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),700);
  let last=performance.now(),mirrorTime=0,frames=0,fpsTime=last;
  const forward=new THREE.Vector3(),target=new THREE.Vector3(),delta=new THREE.Vector3();
  const debug={session,requestGear,view,physics,car,mirrors,renderer,scene,camera,setView,reset,drivingUi,look,settingsStore,controls,ready:true};(window as unknown as {larria:typeof debug}).larria=debug;
  renderer.setAnimationLoop(now=>{
    const dt=Math.min((now-last)/1000,.05);last=now;
    const modal=!!document.querySelector('dialog[open]');
    steerTarget=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
    // Small keyboard-only ramp; pointer wheel remains instantaneous for narrow parking turns.
    steerCurrent+=THREE.MathUtils.clamp(steerTarget-steerCurrent,-dt*9,dt*9);
    if(modal&&session.state==='running')pause(`弹窗已打开，关闭后可继续${session.mode==='practice'?'练习':'考试'}。`);
    const intent={forward:keys.has('KeyW')||keys.has('ArrowUp'),reverse:keys.has('KeyS')||keys.has('ArrowDown'),brake:modal||held.brake.size>0||keys.has('Space'),touchThrottle:held.throttle.size>0,steer:steeringOwner!==null?dragSteer:steerCurrent};
    const resolved=session.state==='running'?controls.resolve(intent,{gear:physics.gear,speed:physics.speed},settings.realisticControls,gear=>{const changed=physics.setGear(gear);if(changed)syncGear();return changed;}):null;
    const input=resolved?.input??{throttle:0,brake:0,steer:0};
    if(resolved?.rejected)toast('车辆尚未停稳，正在制动；停稳后自动换向');
    if(session.state==='running')physics.update(dt,input,()=>{
      const q=physics.chassis.quaternion;
      if(session.mode==='exam')session.step({x:physics.chassis.position.x,z:physics.chassis.position.z,yaw:Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z)),speed:physics.speed,throttle:input.throttle>0});
      if(session.state==='result'){release();examUi.render();return false;}
    });
    car.root.position.set(physics.chassis.position.x,physics.chassis.position.y-.65,physics.chassis.position.z);car.root.quaternion.set(physics.chassis.quaternion.x,physics.chassis.quaternion.y,physics.chassis.quaternion.z,physics.chassis.quaternion.w);
    examUi.updateStatus();
    car.update(session.state==='running'?physics.speed:0,physics.steering,input.brake,input.throttle,physics.gear,dt);
    delta.copy(car.root.position).sub(prevPos);prevPos.copy(car.root.position);
    eye.position.copy(car.root.localToWorld(car.profile.eye.clone()));eye.quaternion.copy(car.root.quaternion);eye.updateMatrixWorld();
    if(view==='orbit'){if(session.mode!=='practice'||orbit.maxDistance<=16){camera.position.add(delta);orbit.target.add(delta);}orbit.update();}
    else if(view==='cockpit'){camera.position.copy(eye.position);camera.quaternion.copy(eye.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch,look.yaw,0,'YXZ')));}
    else{target.copy(car.root.localToWorld(new THREE.Vector3(0,2.6,6.7)));camera.position.lerp(target,1-Math.exp(-dt*5));forward.copy(car.root.localToWorld(new THREE.Vector3(0,.7,-2)));camera.lookAt(forward);}
    sun.position.copy(car.root.position).add(new THREE.Vector3(-16,24,-18));sun.target.position.copy(car.root.position);
    renderer.shadowMap.autoUpdate=true;
    renderer.setRenderTarget(null);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.clear();renderer.render(scene,camera);
    renderer.shadowMap.autoUpdate=false;
    if(now-mirrorTime>(quality?50:100)){mirrors.update(renderer,scene,eye);mirrorTime=now;}
    renderer.setRenderTarget(null);if(view!=='cockpit'&&mirrorsExpanded)mirrors.draw(renderer,expanded);
    $('#speed').textContent=Math.round(Math.abs(physics.speed)*3.6).toString().padStart(2,'0');$('#drive-state').textContent=resolved?.switching?'正在刹停 · 停稳后换向':Math.abs(physics.speed)<.15?(settings.realisticControls?'车辆静止 · 踩下油门出发':'车辆静止 · W 前进 / S 倒车'):input.brake?'正在制动':physics.gear==='R'?'倒车中 · 注意后方':'行驶中 · 保持专注';
    $('#steering-svg').style.transform=`rotate(${-physics.steering*12*180/Math.PI}deg)`;$('#steer-value').textContent=`${Math.round(physics.steering*180/Math.PI)}°`;$('#steering-pad').setAttribute('aria-valuenow',String(Math.round(physics.steering/VEHICLE.steeringLock*100)));
    $('#throttle').classList.toggle('pressed',input.throttle>0);$('#brake').classList.toggle('pressed',input.brake>0);
    (debug as {view:string}).view=view;frames++;if(now-fpsTime>1000){$('#fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;frames=0;fpsTime=now;}
  });
}
init().catch(err=>{console.error(err);$('#loading').innerHTML='<h2>场景未能加载</h2><p>请检查 WebGL 支持和本地资源，然后刷新重试。</p><pre></pre>';$('#loading pre').textContent=String(err);});
