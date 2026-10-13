import type { CourseAnnotation, CourseDefinition, Point, Segment } from './courses/course-definition';

export type PositionedCourseAnnotation = CourseAnnotation & { position: Point };
const midpoint = ([a, b]: Segment): Point => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });

/** Local course coordinates: translate the entire island, not individual labels. */
export function getCourseAnnotations(course: CourseDefinition): PositionedCourseAnnotation[] {
  const defaults: CourseAnnotation[] = [
    { role: 'start', text: 'START', anchor: midpoint(course.startMark), offset: { x: 0, z: 1.15 }, width: 2.6, depth: .6 },
    { role: 'finish', text: 'FINISH', anchor: midpoint(course.finish),
      offset: { x: course.finishExitNormal.x * 1.85, z: course.finishExitNormal.z * 1.15 }, width: 2.6, depth: .6 },
  ];
  return (course.annotations ?? defaults).map(annotation => ({ ...annotation,
    position: { x: annotation.anchor.x + annotation.offset.x, z: annotation.anchor.z + annotation.offset.z },
  }));
}
