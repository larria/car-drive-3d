import { COURSES } from './courses';
import type { CourseDefinition } from './courses/course-definition';

/** Translate the unchanged metre-scale exam drawings, never their rules or coordinates. */
export const PRACTICE_ISLANDS: readonly { course: CourseDefinition; x: number; z: number }[] = [
  { course: COURSES[0], x: -26, z: 19 },
  { course: COURSES[1], x: 8, z: 19 },
  { course: COURSES[2], x: -36, z: -16 },
  { course: COURSES[3], x: 20, z: -22 },
];
export const practiceBounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
export function islandBounds(island: (typeof PRACTICE_ISLANDS)[number]) {
  const b = island.course.bounds;
  return { minX: b.minX + island.x, maxX: b.maxX + island.x, minZ: b.minZ + island.z, maxZ: b.maxZ + island.z };
}
