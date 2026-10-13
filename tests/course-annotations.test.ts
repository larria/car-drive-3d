import { describe, expect, it } from 'vitest';
import { parallelParking } from '../src/courses/parallel-parking';
import { reverseGarage } from '../src/courses/reverse-garage';
import { getCourseAnnotations } from '../src/course-annotations';
import { isParkingBaySegment } from '../src/parking-feedback';

describe('shared parking paint layout', () => {
  for (const course of [parallelParking(), reverseGarage()]) {
    it(`${course.id} keeps backed label rectangles clear of physical/control lines`, () => {
      const labels = getCourseAnnotations(course);
      const segments = [...course.penaltyLines.map(line => line.segment), course.startMark, course.finish,
        ...(course.reverseControlLines?.map(line => line.segment) ?? [])];
      for (const label of labels) {
        const left=label.position.x-label.width/2-.08,right=label.position.x+label.width/2+.08;
        const top=label.position.z-label.depth/2-.08,bottom=label.position.z+label.depth/2+.08;
        for (const [a,b] of segments) {
          const intersects = a.x===b.x
            ? a.x>=left && a.x<=right && Math.max(a.z,b.z)>=top && Math.min(a.z,b.z)<=bottom
            : a.z>=top && a.z<=bottom && Math.max(a.x,b.x)>=left && Math.min(a.x,b.x)<=right;
          expect(intersects, label.text).toBe(false);
        }
      }
      for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
        expect(Math.abs(labels[i].position.x-labels[j].position.x)>(labels[i].width+labels[j].width)/2+.08
          || Math.abs(labels[i].position.z-labels[j].position.z)>(labels[i].depth+labels[j].depth)/2+.08).toBe(true);
      }
    });
    it(`${course.id} selects only the three solid bay edges`, () => {
      expect(course.penaltyLines.filter(line=>isParkingBaySegment(line.segment,course.parkZone))).toHaveLength(3);
      expect(isParkingBaySegment(course.startMark,course.parkZone)).toBe(false);
      expect(isParkingBaySegment(course.finish,course.parkZone)).toBe(false);
    });
  }
  it('retains both explicit simulation-control descriptions',()=>{
    expect(getCourseAnnotations(reverseGarage()).filter(a=>a.role==='control').map(a=>a.text))
      .toEqual(['右模拟控制线','左模拟控制线']);
  });
});
