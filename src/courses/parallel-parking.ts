import { VEHICLE } from '../vehicle-config';
import { boundsOf, type ParkingCourse, type Point, type Segment } from './course-definition';

/** Reference scene 2, converted from millimetres to metres without adding walls. */
export function parallelParking(length: number = VEHICLE.length, width: number = VEHICLE.width): ParkingCourse {
  const L = 1.5 * length + 1, B1 = width + .8, B2 = 1.5 * width + .8;
  const right = B2 / 2, outside = right + B1, startZ = L / 2 + 3, finishZ = -L / 2 - 6;
  const p = (x: number, z: number): Point => ({ x, z });
  const seg = (x1: number, z1: number, x2: number, z2: number): Segment => [p(x1,z1),p(x2,z2)];
  const road = [p(-right,-15),p(right,-15),p(right,15),p(-right,15)];
  const bay = [p(right,-L/2),p(outside,-L/2),p(outside,L/2),p(right,L/2)];
  const boundaries = [
    seg(-right,-15,-right,15),seg(outside,-L/2,outside,L/2),
    seg(right,L/2,right,15),seg(right,finishZ,right,-L/2),
    seg(right,-L/2,outside,-L/2),seg(right,L/2,outside,L/2),
  ];
  return {
    id:'parallel-parking',name:'侧方位停车',number:'03',label:'PARALLEL PARKING',
    description:'倒车入库并停稳，前进出库后穿过终点线。倒车后完成入库前不得前进；出库后不得再倒车。',
    dimensions:`库长 ${L.toFixed(2)} m · 库宽 ${B1.toFixed(2)} m · 车道宽 ${B2.toFixed(2)} m · 车道长 30 m`,
    width:B2,start:p(0,startZ+.5),startYaw:0,startMark:seg(-right,startZ,right,startZ),
    polygon:road,roads:[road,bay],boundaries,penaltyLines:boundaries.map((segment,i)=>({segment,reason:i===4?'碰擦前车，考试不合格':i===5?'碰擦后车，考试不合格':'车辆越出边界线'})),
    guides:[seg(right,-L/2,right,L/2)],center:[],finish:seg(-right,finishZ,right,finishZ),
    parkZone:{minX:right,maxX:outside,minZ:-L/2,maxZ:L/2,heading:0,tolerance:Math.PI/12},
    bounds:boundsOf([...road,...bay]),requiredParks:1,notParkedReason:'未完成侧方入库，考试不合格',
    direction:'parallel',passReason:'车辆顺利通过侧方位停车',
  };
}
export const PARALLEL_PARKING = parallelParking();
