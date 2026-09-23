import * as THREE from 'three';

export type MirrorName = 'left' | 'center' | 'right';
export interface MirrorBinding {
  name: MirrorName;
  /** Exact model triangles, baked into vehicle-root coordinates; UVs are upright. */
  geometry: THREE.BufferGeometry;
  cameraPosition: THREE.Vector3;
  direction: THREE.Vector3;
  fov: number;
  aspect: number;
}
export interface VehicleViewProfile {
  id: string;
  /** Driver eye in vehicle-root coordinates, never world coordinates. */
  eye: THREE.Vector3;
  mirrors: MirrorBinding[];
}

/** Extract one facing of model triangles, preserving its actual outline and curvature.
 * Bounds and normals are tested in root space, including nested mesh transforms.
 * No source geometry is mutated; polygon offset resolves the coincident overlay.
 */
export function extractMirrorGeometry(root: THREE.Object3D, mesh: THREE.Mesh, bounds: THREE.Box3, facing: THREE.Vector3) {
  root.updateWorldMatrix(true, true);
  const matrix = root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
  const source = mesh.geometry, p = source.getAttribute('position'), index = source.index;
  const positions: number[] = [], normal = new THREE.Vector3();
  const count = index?.count ?? p.count;
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(matrix));
    if (!vertices.every(v => bounds.containsPoint(v))) continue;
    const n = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0]));
    if (n.lengthSq() < 1e-16 || n.clone().normalize().dot(facing) < .5) continue;
    normal.add(n);
    vertices.forEach(v => positions.push(v.x, v.y, v.z));
  }
  if (!positions.length) throw new Error(`No mirror triangles matched ${mesh.name}; this model needs an explicit view-profile adapter.`);
  normal.normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(normal).normalize();
  const up = normal.clone().cross(right).normalize();
  const uv: number[] = [], uvBounds = new THREE.Box2();
  for (let i = 0; i < positions.length; i += 3) {
    const v = new THREE.Vector3().fromArray(positions, i);
    const projected = new THREE.Vector2(v.dot(right), v.dot(up));
    uvBounds.expandByPoint(projected); uv.push(projected.x, projected.y);
  }
  const size = uvBounds.getSize(new THREE.Vector2());
  if (size.x < 1e-6 || size.y < 1e-6) throw new Error('Degenerate mirror UV basis');
  for (let i = 0; i < uv.length; i += 2) { uv[i] = (uv[i] - uvBounds.min.x) / size.x; uv[i + 1] = (uv[i + 1] - uvBounds.min.y) / size.y; }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return { geometry, aspect: size.x / size.y };
}
