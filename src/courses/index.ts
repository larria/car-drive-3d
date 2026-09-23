import { RIGHT_ANGLE } from './right-angle';
import { S_CURVE } from './s-curve';
import type { CourseDefinition } from './course-definition';
export const COURSES: readonly CourseDefinition[] = [RIGHT_ANGLE,S_CURVE];
export function getCourse(id:string):CourseDefinition { return COURSES.find(course=>course.id===id) ?? RIGHT_ANGLE; }
