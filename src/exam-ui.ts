import type { CourseDefinition } from './courses/course-definition';
import { RIGHT_ANGLE } from './courses/right-angle';
import { VEHICLE } from './vehicle-config';
import type { ExamSession } from './exam-session';
export function courseDiagram(course:CourseDefinition=RIGHT_ANGLE){
 const b=course.bounds, scale=Math.min(250/(b.maxX-b.minX),240/(b.maxZ-b.minZ));
 const x=(v:number)=>30+(v-b.minX)*scale, z=(v:number)=>30+(v-b.minZ)*scale;
 const project=(p:{x:number;z:number})=>`${x(p.x)},${z(p.z)}`;
 const line=([a,b]:CourseDefinition['finish'],color='currentColor',width=2)=>`<line x1="${x(a.x)}" y1="${z(a.z)}" x2="${x(b.x)}" y2="${z(b.z)}" stroke="${color}" stroke-width="${width}"/>`;
 return `<svg class="course-diagram" viewBox="0 0 310 310" role="img" aria-label="${course.name}道路俯视示意。${course.description} ${course.dimensions}"><polygon points="${course.polygon.map(project).join(' ')}" fill="#d5ded6"/>${course.boundaries.map(edge=>line(edge)).join('')}<polyline points="${course.center.map(project).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="5 6"/>${line(course.startMark,'#267447',3)}${line(course.finish,'#267447',3)}<rect x="${x(course.start.x)-5}" y="${z(course.start.z)-9}" width="10" height="18" rx="3" fill="#267447"/><text x="${x(course.start.x)+14}" y="${z(course.start.z)+6}">起点 ↑</text><text x="${x(course.finish[1].x)-25}" y="${z(course.finish[1].z)-12}">终点</text></svg>`;
}
export class ExamUi {
 readonly overlay=document.createElement('section');
 readonly hud=document.createElement('section');
 private focusFrame=0;
 constructor(private session:ExamSession, private action:(name:string)=>void){
  this.overlay.id='exam-overlay';this.overlay.setAttribute('aria-label','考试流程');
  this.hud.id='exam-hud';
  document.querySelector('#app')!.append(this.overlay,this.hud);
  for(const el of [this.overlay,this.hud])el.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-exam]');if(button&&!button.disabled)this.action(button.dataset.exam!);});
  const upcoming=document.createElement('dialog');
  upcoming.id='upcoming-dialog';upcoming.setAttribute('aria-labelledby','upcoming-title');
  upcoming.innerHTML='<div class="exam-eyebrow">COMING SOON</div><h2 id="upcoming-title"></h2><p>敬请期待。</p><p>这一项练习正在准备中。<br>现在可以先体验直角转弯和曲线行驶。</p><form method="dialog"><button class="exam-primary">返回项目</button></form>';
  document.querySelector('#app')!.append(upcoming);
  this.overlay.addEventListener('click',e=>{
   const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-upcoming]');
   if(!button)return;
   upcoming.querySelector('h2')!.textContent=button.dataset.upcoming!;
   upcoming.showModal();
  });
  this.render();
 }
 render(){
  cancelAnimationFrame(this.focusFrame);
  const s=this.session, course=s.course;document.body.dataset.exam=s.state;
  this.overlay.hidden=s.state==='running';this.hud.hidden=!s.active;
  this.hud.innerHTML=`<div><span class="eyebrow">ASSESSMENT / ${course.number}</span><strong>${course.name} <span>${s.state==='paused'?'已暂停':'考试中'}</span></strong></div><div class="exam-actions"><button data-exam="pause">暂停</button><button data-exam="retry">重试</button><button data-exam="exit">退出</button></div>`;
  const btn=(action:string,label:string,primary=false)=>`<button class="${primary?'exam-primary':'exam-secondary'}" data-exam="${action}">${label}</button>`;
  if(s.state==='projects')this.overlay.innerHTML=`<div class="project-page"><div class="exam-eyebrow">LARRIA / DRIVING ACADEMY</div><div class="project-heading"><div><h1>把每一个转弯，<br>练成从容。</h1><p>从驾驶座出发，感受车身与道路的距离。<br>选择练习项目，开始你的科目二模拟考试。</p></div><span class="season-note">科目二 · 场地驾驶<br>CHAPTER 01 — PRECISION</span></div><div class="project-grid"><button class="project-feature" data-exam="select"><div><span class="card-number">01 / 已开放</span><h2>直角转弯</h2><p>把握转向时机，一次顺畅通过。</p><span class="project-link">查看考前说明 <b>↗</b></span></div>${courseDiagram()}</button><div class="upcoming-grid">${`<button class="project-placeholder project-available" data-exam="select:s-curve"><span class="card-number">02 / 已开放</span><h3>曲线行驶</h3><p>在连续弯道中感受方向</p><span>查看考前说明 ↗</span></button>`}${[['03','侧方位停车','掌握车位与车身的距离'],['04','倒车入库','建立后视镜中的空间感'],['05','自由练习','自由探索，熟悉驾驶操作']].map(([n,title,desc])=>`<button class="project-placeholder" ${n==='05'?'disabled':`data-upcoming="${title}" aria-haspopup="dialog"`}><span class="card-number">${n} / 待开放</span><h3>${title}</h3><p>${desc}</p><span>敬请期待</span></button>`).join('')}</div></div><div class="project-bottom">真实 3D 座舱 · 实时后视镜 · 支持键盘与触控<span>练习模拟，不代替正规驾驶培训</span></div></div>`;
  if(s.state==='briefing')this.overlay.innerHTML=`<div class="briefing-page"><div class="exam-eyebrow">BEFORE YOU DRIVE / ${course.number}</div><h1>${course.name}</h1><p class="exam-lead">看清规则，再从容出发。</p><div class="briefing-grid"><div class="diagram-panel">${courseDiagram(course)}<p>${course.dimensions}</p></div><div><h2>${course.id==='s-curve'?'连续转弯，同样从容。':'一次转弯，三条准则。'}</h2><p>${course.description}</p><ol class="exam-rules"><li><b>保持向前</b><span>实际倒退即判失败，挂入 R 档本身不判罚。</span></li><li><b>起步后不要停车</b><span>按下油门即开始；松油门可以滑行，但不能停下。</span></li><li><b>车身不越边界</b><span>不含后视镜的车身越界即失败；穿过绿色终点线即通过。</span></li></ol><p class="vehicle-spec">Ferrari 458 Italia · 当前模拟配置<br>车身 ${VEHICLE.length.toFixed(2)} × ${VEHICLE.width.toFixed(2)} m · 轴距 ${VEHICLE.wheelbase.toFixed(3)} m<br><small>模型配套物理参数，非厂家标定数据。</small></p></div></div><div class="briefing-controls"><span><kbd>W</kbd> 油门　<kbd>S</kbd> 刹车　<kbd>A</kbd><kbd>D</kbd> 转向<br><kbd>Z</kbd> R 档　<kbd>X</kbd> N 档　<kbd>C</kbd> D 档</span><span>默认驾驶座舱 · 移动鼠标即可转头<br>需要查看帮助或离开窗口时，考试会暂停。</span></div><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('start','准备好了，开始考试 →',true)}</div></div>`;
  if(s.state==='paused')this.overlay.innerHTML=`<div class="result-card"><div class="result-symbol">Ⅱ</div><div class="exam-eyebrow">TAKE A BREATH</div><h1>考试已暂停</h1><p>${s.pauseReason}</p><p class="result-detail">车辆与考试判定已冻结，不会因暂停被判停车。<br>继续后请及时保持油门，或在车速仍高于停车阈值时滑行。</p><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('resume','继续考试 →',true)}</div></div>`;
  if(s.state==='result')this.overlay.innerHTML=`<div class="result-card ${s.result?.passed?'passed':'failed'}"><div class="result-symbol">${s.result?.passed?'✓':'×'}</div><div class="exam-eyebrow">${course.label} / RESULT · ${course.name}</div><h1>${s.result?.passed?'考试通过':'未通过考试'}</h1><p class="result-reason">${s.result?.reason}</p><p class="result-detail">${s.result?.passed?'每一次准确的判断，都让下一次出发更从容。':'调整节奏，观察车身与边线的位置，再试一次。'}<br>考试已结束，车辆保持冻结。</p><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('retry','重新考试 →',true)}</div></div>`;
  if(s.state!=='running')this.focusFrame=requestAnimationFrame(()=>this.overlay.querySelector<HTMLButtonElement>('.exam-primary, [data-exam="select"]')?.focus({preventScroll:true}));
 }
}
