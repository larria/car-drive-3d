import { boundsOf, type CourseDefinition, type Point, type Segment } from './course-definition';

/** Metres; faithful to scene-1-s-curve and scene-loader's 48-step generator. */
export function sCurve() {
  const radius=7.5, width=3.5, half=width/2;
  const o1={x:7.5,z:8};
  const arc=(o:Point,r:number,a:number,b:number)=>Array.from({length:49},(_,i)=>{
    const angle=(a+(b-a)*i/48)*Math.PI/180;
    return {x:o.x+r*Math.cos(angle),z:o.z+r*Math.sin(angle)};
  });
  const first=arc(o1,radius,180,315), join=first[48];
  const o2={x:2*join.x-o1.x,z:2*join.z-o1.z};
  const a2=Math.atan2(join.z-o2.z,join.x-o2.x)*180/Math.PI;
  const paired=(r1:number,r2:number)=>[...arc(o1,r1,180,315),...arc(o2,r2,a2,a2-135).slice(1)];
  const center=paired(radius,radius), sideA=paired(radius-half,radius+half), sideB=paired(radius+half,radius-half);
  const extend=(start:boolean,length:number)=>{
    const p=start?center[0]:center[center.length-1], q=start?center[1]:center[center.length-2];
    const dx=start?q.x-p.x:p.x-q.x, dz=start?q.z-p.z:p.z-q.z, norm=Math.hypot(dx,dz);
    const ux=dx/norm, uz=dz/norm, sign=start?-1:1;
    const end={x:p.x+sign*ux*length,z:p.z+sign*uz*length};
    const a={x:end.x-uz*half,z:end.z+ux*half}, b={x:end.x+uz*half,z:end.z-ux*half};
    if(start){center.unshift(end);sideA.unshift(a);sideB.unshift(b);}
    else{center.push(end);sideA.push(a);sideB.push(b);}
  };
  extend(true,2);extend(false,3);
  const walls=(side:Point[]):Segment[]=>side.slice(1).map((p,i)=>[side[i],p]);
  const polygon=[...sideA,...sideB.slice().reverse()];
  const course:CourseDefinition={id:'s-curve',name:'曲线行驶',number:'02',label:'S CURVE',
    description:'在连续弯道中感受方向，先右转，再左转。',dimensions:'中心半径 7.5 m · 道路宽 3.5 m · 连续双弧',
    width,start:{x:0,z:9.5},startYaw:0,startMark:[{x:-1.75,z:9.5},{x:1.75,z:9.5}],
    polygon,boundaries:[...walls(sideA),...walls(sideB)],center,
    // Independent reference finish, deliberately NOT snapped to the chord extension.
    finish:[{x:23.8566,z:-5.6066},{x:27.3566,z:-5.6066}],
    bounds:boundsOf(polygon),rules:{noReverse:true,noStopAfterGo:true},passReason:'车辆顺利通过曲线行驶'};
  return {...course,sideA,sideB,o1,o2};
}
export const S_CURVE=sCurve();
