import {expect,it} from 'vitest';
import {PRACTICE_ISLANDS,islandBounds,practiceBounds} from '../src/practice-layout';
import {COURSES} from '../src/courses';

it('unchanged four exam definitions sit on disjoint original-scale practice islands inside asphalt',()=>{
 const snapshots=COURSES.map(course=>JSON.stringify(course));
 expect(PRACTICE_ISLANDS.map(item=>[item.course.id,item.x,item.z])).toEqual([
  ['right-angle',-26,19],['s-curve',8,19],['parallel-parking',-36,-16],['reverse-garage',20,-22],
 ]);
 const bounds=PRACTICE_ISLANDS.map(islandBounds);
 bounds.forEach((b,i)=>{
  expect(b.minX).toBeGreaterThan(practiceBounds.minX);expect(b.maxX).toBeLessThan(practiceBounds.maxX);
  expect(b.minZ).toBeGreaterThan(practiceBounds.minZ);expect(b.maxZ).toBeLessThan(practiceBounds.maxZ);
  for(let j=i+1;j<bounds.length;j++){
   const other=bounds[j];
   expect(b.maxX<other.minX||other.maxX<b.minX||b.maxZ<other.minZ||other.maxZ<b.minZ).toBe(true);
  }
 });
 expect(COURSES.map(course=>JSON.stringify(course))).toEqual(snapshots);
});
