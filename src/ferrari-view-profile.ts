import * as THREE from 'three';
import { extractMirrorGeometry, type VehicleViewProfile, type MirrorName } from './vehicle-view-profile';

/** Adapter for the bundled Draco Ferrari only. Chrome contains all three mirrors.
 * Chrome welded components: center 68, left/right 92 triangles each (both facings).
 * Glass components are windows/lights, NOT the mirrors. Select the +Z-facing half.
 * Bounds measured by tests/analyze-mirrors.mjs after decoding the actual asset.
 */
export function ferrariViewProfile(root: THREE.Object3D): VehicleViewProfile {
  const chrome = root.getObjectByName('chrome');
  if (!(chrome instanceof THREE.Mesh)) throw new Error('Ferrari view profile requires the bundled chrome mesh');
  const configs: { name: MirrorName; min: number[]; max: number[]; camera: number[]; direction: number[]; fov: number }[] = [
    { name: 'left', min: [-1.119,.804,-.466], max: [-.944,.918,-.378], camera: [-1.032,.861,-.421], direction: [-.15,-.09,1], fov: 55 },
    { name: 'center', min: [-.128,1.062,-.303], max: [.114,1.121,-.268], camera: [0,1.04,1.6], direction: [0,-.02,1], fov: 60 },
    { name: 'right', min: [.944,.804,-.466], max: [1.119,.918,-.378], camera: [1.032,.861,-.421], direction: [.15,-.09,1], fov: 55 },
  ];
  return {
    id: 'bundled-ferrari', eye: new THREE.Vector3(-.34,1.02,.22),
    mirrors: configs.map(c => ({ name: c.name,
      ...extractMirrorGeometry(root, chrome, new THREE.Box3(new THREE.Vector3().fromArray(c.min), new THREE.Vector3().fromArray(c.max)), new THREE.Vector3(0,0,1)),
      cameraPosition: new THREE.Vector3().fromArray(c.camera), direction: new THREE.Vector3().fromArray(c.direction), fov: c.fov,
    })),
  };
}
