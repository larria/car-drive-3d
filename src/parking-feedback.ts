import { isParkingCourse, type ParkingCourse, type Segment } from './courses/course-definition';
import type { ExamRules, ExamResult } from './exam-rules';

export interface ParkingSuccessEvent { index: number; total: number; nextHint: string }
/** Presentation only: never feeds colour or latch state back into scoring. */
export class ParkingFeedback {
  private owner: ExamRules | null=null;
  private count=0;
  private latched=false;
  get active(){return this.latched;}
  reset(){this.owner=null;this.count=0;this.latched=false;}
  capture(rules: ExamRules, result: ExamResult | null = null): ParkingSuccessEvent | null {
    if(this.owner!==rules||rules.parkCount<this.count){this.reset();this.owner=rules;}
    if(!isParkingCourse(rules.course)||result?.passed===false){this.latched=false;this.count=rules.parkCount;return null;}
    const added=rules.parkCount>this.count;
    this.count=rules.parkCount;
    if(!rules.parkingFullyInside)this.latched=false;
    if(!added)return null;
    this.latched=rules.parkingFullyInside;
    return {index:this.count,total:rules.course.requiredParks,nextHint:rules.parkingStep?.detail??''};
  }
}

/** Only solid edges on the bay rectangle; never recolour the opening or road. */
export function isParkingBaySegment([a, b]: Segment, zone: ParkingCourse['parkZone']): boolean {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-7;
  const inside = (p: typeof a) => p.x >= zone.minX - 1e-7 && p.x <= zone.maxX + 1e-7
    && p.z >= zone.minZ - 1e-7 && p.z <= zone.maxZ + 1e-7;
  return inside(a) && inside(b) && ((near(a.x, b.x) && (near(a.x, zone.minX) || near(a.x, zone.maxX)))
    || (near(a.z, b.z) && (near(a.z, zone.minZ) || near(a.z, zone.maxZ))));
}
