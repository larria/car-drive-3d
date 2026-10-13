import { VEHICLE } from '../vehicle-config';
import { boundsOf, type ParkingCourse, type Point, type Segment } from './course-definition';

/** Reference scene 3: the unused D parameter is not a boundary or rule. */
export function reverseGarage(length: number = VEHICLE.length): ParkingCourse {
  const L = length + .7, halfBay = 2.3 / 2, halfRoad = 6.7 / 2, bottom = halfRoad + L;
  const p = (x: number, z: number): Point => ({ x, z });
  const seg = (x1: number, z1: number, x2: number, z2: number): Segment => [p(x1,z1),p(x2,z2)];
  const road = [p(-11,-halfRoad),p(11,-halfRoad),p(11,halfRoad),p(-11,halfRoad)];
  const bay = [p(-halfBay,halfRoad),p(halfBay,halfRoad),p(halfBay,bottom),p(-halfBay,bottom)];
  const boundaries = [
    seg(-11,-halfRoad,11,-halfRoad),seg(-11,halfRoad,-halfBay,halfRoad),
    seg(halfBay,halfRoad,11,halfRoad),seg(-halfBay,halfRoad,-halfBay,bottom),
    seg(halfBay,halfRoad,halfBay,bottom),seg(-halfBay,bottom,halfBay,bottom),
  ];
  return {
    id:'reverse-garage',name:'倒车入库',number:'04',label:'REVERSE GARAGE',
    description:'按前进→倒车→前进→倒车→前进完成两次整车入库停稳。每次倒车前两前轮须越过对应模拟控制线，再向右驶过终点；控制线为模拟布局，非官方标定。',
    dimensions:`库长 ${L.toFixed(2)} m · 库宽 2.30 m · 车道宽 6.70 m · 车道长 22 m`,
    width:6.7,start:p(-7.5,0),startYaw:-Math.PI/2,startMark:seg(-8,-halfRoad,-8,halfRoad),
    polygon:road,roads:[road,bay],boundaries,penaltyLines:boundaries.map((segment,i)=>({segment,kind:'marking',reason:i===5?'碰擦库底，考试不合格':i>=3?'碰擦库侧边，考试不合格':'车辆越出边界线'})),
    guides:[seg(-halfBay,halfRoad,halfBay,halfRoad),seg(-11,0,11,0)],center:[],finish:seg(9,-halfRoad,9,halfRoad),finishExitNormal:p(1,0),
    parkZone:{minX:-halfBay,maxX:halfBay,minZ:halfRoad,maxZ:bottom,heading:0,tolerance:Math.PI/12},
    bounds:boundsOf([...road,...bay]),totalLimit:210,requiredParks:2,notParkedReason:'未完成两次入库，考试不合格',
    reverseControlLines:[
      {segment:seg(5,-halfRoad,5,halfRoad),normal:p(1,0),label:'右模拟控制线'},
      {segment:seg(-5,-halfRoad,-5,halfRoad),normal:p(-1,0),label:'左模拟控制线'},
    ],
    annotations:[
      {role:'start',text:'START',anchor:p(-8,-halfRoad),offset:p(0,-1.15),width:2.6,depth:.6,leader:true},
      {role:'finish',text:'FINISH',anchor:p(9,-halfRoad),offset:p(0,-1.15),width:2.6,depth:.6,leader:true},
      {role:'control',text:'右模拟控制线',anchor:p(5,-halfRoad),offset:p(0,-1.15),width:3.2,depth:.6,leader:true},
      {role:'control',text:'左模拟控制线',anchor:p(-5,-halfRoad),offset:p(0,-1.15),width:3.2,depth:.6,leader:true},
      {role:'parking',text:'倒车入库',anchor:p(0,bottom),offset:p(0,1.15),width:3,depth:.6,leader:true},
    ],
    direction:'strict',passReason:'车辆顺利通过倒车入库',
  };
}
export const REVERSE_GARAGE = reverseGarage();
