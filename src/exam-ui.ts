import { RIGHT_ANGLE as course } from './courses/right-angle';
import { VEHICLE } from './vehicle-config';
import type { ExamSession } from './exam-session';
export function courseDiagram(){
 const project=(p:{x:number;z:number})=>`${70+p.x*15},${100+p.z*15}`;
 return `<svg class="course-diagram" viewBox="0 0 310 310" role="img" aria-label="直角道路俯视示意：从下方起步，右转后向右驶出。道路宽${course.width.toFixed(3)}米"><defs><pattern id="road-hatch" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 8L8 0" stroke="currentColor" opacity=".05"/></pattern></defs><polygon points="${course.polygon.map(project).join(' ')}" fill="#d5ded6"/><polygon points="${course.polygon.map(project).join(' ')}" fill="url(#road-hatch)"/>${course.boundaries.map(([a,b])=>`<line x1="${70+a.x*15}" y1="${100+a.z*15}" x2="${70+b.x*15}" y2="${100+b.z*15}" stroke="currentColor" stroke-width="2"/>`).join('')}<path d="M70 245V74H226" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 6"/><path d="M217 68L226 74L217 80" fill="none" stroke="currentColor" stroke-width="2"/><rect x="60" y="222" width="20" height="40" rx="5" fill="#267447"/><text x="105" y="255">起点 ↑</text><text x="233" y="80">终点</text><text x="104" y="160">12 m</text><text x="134" y="30">10 m</text></svg>`;
}
export class ExamUi {
 readonly overlay=document.createElement('section');
 readonly hud=document.createElement('section');
 constructor(private session:ExamSession, private action:(name:string)=>void){
  this.overlay.id='exam-overlay';this.overlay.setAttribute('aria-label','考试流程');
  this.hud.id='exam-hud';
  document.querySelector('#app')!.append(this.overlay,this.hud);
  for(const el of [this.overlay,this.hud])el.addEventListener('click',e=>{const button=(e.target as HTMLElement).closest<HTMLButtonElement>('[data-exam]');if(button&&!button.disabled)this.action(button.dataset.exam!);});
  this.render();
 }
 render(){
  const s=this.session;document.body.dataset.exam=s.state;
  this.overlay.hidden=s.state==='running';this.hud.hidden=!s.active;
  this.hud.innerHTML=`<div><span class="eyebrow">ASSESSMENT / 01</span><strong>直角转弯 <span>${s.state==='paused'?'已暂停':'考试中'}</span></strong></div><div class="exam-actions"><button data-exam="pause">暂停</button><button data-exam="retry">重试</button><button data-exam="exit">退出</button></div>`;
  const btn=(action:string,label:string,primary=false)=>`<button class="${primary?'exam-primary':'exam-secondary'}" data-exam="${action}">${label}</button>`;
  if(s.state==='projects')this.overlay.innerHTML=`<div class="project-page"><div class="exam-eyebrow">LARRIA / DRIVING ACADEMY</div><div class="project-heading"><div><h1>把每一个转弯，<br>练成从容。</h1><p>从驾驶座出发，感受车身与道路的距离。<br>选择练习项目，开始你的科目二模拟考试。</p></div><span class="season-note">科目二 · 场地驾驶<br>CHAPTER 01 — PRECISION</span></div><div class="project-grid"><button class="project-feature" data-exam="select"><div><span class="card-number">01 / 已开放</span><h2>直角转弯</h2><p>把握转向时机，一次顺畅通过。</p><span class="project-link">查看考前说明 <b>↗</b></span></div>${courseDiagram()}</button><div class="upcoming-grid">${[['02','曲线行驶','在连续弯道中感受方向'],['03','侧方位停车','掌握车位与车身的距离'],['04','倒车入库','建立后视镜中的空间感'],['05','自由练习','自由探索，熟悉驾驶操作']].map(([n,title,desc])=>`<button class="project-placeholder" disabled><span class="card-number">${n} / 待开放</span><h3>${title}</h3><p>${desc}</p><span>敬请期待</span></button>`).join('')}</div></div><div class="project-bottom">真实 3D 座舱 · 实时后视镜 · 支持键盘与触控<span>练习模拟，不代替正规驾驶培训</span></div></div>`;
  if(s.state==='briefing')this.overlay.innerHTML=`<div class="briefing-page"><div class="exam-eyebrow">BEFORE YOU DRIVE / 01</div><h1>直角转弯</h1><p class="exam-lead">看清规则，再从容出发。</p><div class="briefing-grid"><div class="diagram-panel">${courseDiagram()}<p>道路宽 ${course.width.toFixed(3)} m · 入口 12 m · 出口 10 m</p></div><div><h2>一次转弯，三条准则。</h2><ol class="exam-rules"><li><b>保持向前</b><span>实际倒退即判失败，挂入 R 档本身不判罚。</span></li><li><b>起步后不要停车</b><span>按下油门即开始；松油门可以滑行，但不能停下。</span></li><li><b>车身不越边界</b><span>不含后视镜的车身越界即失败；穿过绿色终点线即通过。</span></li></ol><p class="vehicle-spec">Ferrari 458 Italia · 当前模拟配置<br>车身 ${VEHICLE.length.toFixed(2)} × ${VEHICLE.width.toFixed(2)} m · 轴距 ${VEHICLE.wheelbase.toFixed(3)} m<br><small>模型配套物理参数，非厂家标定数据。</small></p></div></div><div class="briefing-controls"><span><kbd>W</kbd> 油门　<kbd>S</kbd> 刹车　<kbd>A</kbd><kbd>D</kbd> 转向<br><kbd>Z</kbd> R 档　<kbd>X</kbd> N 档　<kbd>C</kbd> D 档</span><span>默认驾驶座舱 · 移动鼠标即可转头<br>需要查看帮助或离开窗口时，考试会暂停。</span></div><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('start','准备好了，开始考试 →',true)}</div></div>`;
  if(s.state==='paused')this.overlay.innerHTML=`<div class="result-card"><div class="result-symbol">Ⅱ</div><div class="exam-eyebrow">TAKE A BREATH</div><h1>考试已暂停</h1><p>${s.pauseReason}</p><p class="result-detail">车辆与考试判定已冻结，不会因暂停被判停车。<br>继续后请及时保持油门，或在车速仍高于停车阈值时滑行。</p><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('resume','继续考试 →',true)}</div></div>`;
  if(s.state==='result')this.overlay.innerHTML=`<div class="result-card ${s.result?.passed?'passed':'failed'}"><div class="result-symbol">${s.result?.passed?'✓':'×'}</div><div class="exam-eyebrow">RIGHT ANGLE / RESULT</div><h1>${s.result?.passed?'考试通过':'未通过考试'}</h1><p class="result-reason">${s.result?.reason}</p><p class="result-detail">${s.result?.passed?'每一次准确的判断，都让下一次出发更从容。':'调整节奏，观察车身与边线的位置，再试一次。'}<br>考试已结束，车辆保持冻结。</p><div class="exam-bottom-actions">${btn('exit','返回项目')}${btn('retry','重新考试 →',true)}</div></div>`;
  if(s.state!=='running')requestAnimationFrame(()=>this.overlay.querySelector<HTMLButtonElement>('.exam-primary, [data-exam="select"]')?.focus({preventScroll:true}));
 }
}
