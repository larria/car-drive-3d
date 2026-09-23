import * as THREE from 'three';
import { RIGHT_ANGLE } from './courses/right-angle';
import type { CourseDefinition, Point } from './courses/course-definition';

export type WorldWall = { x: number; y: number; z: number; sx: number; sy: number; sz: number };

/** A self-contained, metre-scale driving campus. Lighting belongs to the caller. */
export function createWorld(scene: THREE.Scene) {
  const walls: WorldWall[] = [];
  const world = new THREE.Group();
  world.name = 'LARRIA · Drive Lab';
  scene.add(world);
  scene.background = new THREE.Color('#e7e5df');
  scene.fog = new THREE.Fog('#e7e5df', 85, 245);

  let seed = 418;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const material = (color: string, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
  const concrete = material('#b4b4ab');
  const concreteLight = material('#d2d1c8');
  const charcoal = material('#303638');
  const metal = material('#525b5b', 0.5);
  const white = material('#e4e3d8');
  const yellow = material('#dab851');
  const orange = material('#db713c');
  const glass = material('#728589', 0.34);
  glass.metalness = 0.32;
  const grass = material('#909780');
  const leaves = [material('#657562'), material('#77836a'), material('#869075')];
  const bark = material('#726858');
  const mountain = material('#c5c7b9');
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  const crown = new THREE.IcosahedronGeometry(1, 1);
  const hill = new THREE.SphereGeometry(1, 16, 10);
  const cone = new THREE.CylinderGeometry(0.13, 0.34, 0.86, 12);
  const coneStripe = new THREE.CylinderGeometry(0.193, 0.237, 0.18, 12);

  // One instanced draw per geometry/material/shadow combination.
  type Batch = { geometry: THREE.BufferGeometry; material: THREE.Material; cast: boolean; matrices: THREE.Matrix4[] };
  const batches = new Map<string, Batch>();
  const transform = new THREE.Object3D();
  function instance(geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
    sx = 1, sy = 1, sz = 1, rotation = 0, cast = true) {
    const key = `${geometry.uuid}/${mat.uuid}/${cast}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material: mat, cast, matrices: [] };
      batches.set(key, batch);
    }
    transform.position.set(x, y, z);
    transform.rotation.set(0, rotation, 0);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    batch.matrices.push(transform.matrix.clone());
  }
  const block = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, cast = true) =>
    instance(box, mat, x, y, z, sx, sy, sz, 0, cast);
  function solid(mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    block(mat, x, y, z, sx, sy, sz);
    walls.push({ x, y, z, sx, sy, sz });
  }
  function line(x: number, z: number, sx: number, sz: number, mat: THREE.Material = white) {
    block(mat, x, 0.016, z, sx, 0.012, sz, false);
  }
  function canvas(width: number, height: number) {
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    const ctx = el.getContext('2d');
    if (!ctx) throw new Error('The driving world requires a Canvas 2D context.');
    return { el, ctx };
  }
  function texture(el: HTMLCanvasElement) {
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  const asphaltCanvas = canvas(512, 512);
  asphaltCanvas.ctx.fillStyle = '#424749';
  asphaltCanvas.ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 37000; i++) {
    const value = 45 + Math.floor(random() * 55);
    asphaltCanvas.ctx.fillStyle = `rgba(${value},${value + 3},${value + 4},0.28)`;
    asphaltCanvas.ctx.fillRect(random() * 512, random() * 512, 1 + random(), 1 + random());
  }
  const asphaltTexture = texture(asphaltCanvas.el);
  asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
  asphaltTexture.repeat.set(20, 20);
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTexture, roughness: 0.98 });
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), material('#babdaf'));
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -0.08;
  terrain.receiveShadow = true;
  world.add(terrain);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = '100m asphalt test court';
  world.add(ground);
  // Continuous flush apron beyond the court, below the driving surface.
  block(concreteLight, 0, -0.13, 0, 112, 0.2, 112, false);

  // Typography is painted, not a UI overlay. Shared atlases keep numbered bays inexpensive.
  const font = '"Arial", "Helvetica Neue", "PingFang SC", sans-serif';
  function groundText(text: string, x: number, z: number, width: number, depth: number, color = '#d5d6cd') {
    const { el, ctx } = canvas(1024, 256);
    ctx.fillStyle = color;
    ctx.font = `700 190px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 139, 970);
    const mat = new THREE.MeshStandardMaterial({ map: texture(el), transparent: true, depthWrite: false,
      roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.033, z);
    mesh.receiveShadow = true;
    world.add(mesh);
  }
  // Course-owned resources are replaced without disturbing shared campus assets.
  let courseGroup = new THREE.Group();
  function setCourse(course: CourseDefinition) {
    const geometries=new Set<THREE.BufferGeometry>(), materials=new Set<THREE.Material>(), textures=new Set<THREE.Texture>();
    courseGroup.traverse(object=>{
      if(object instanceof THREE.Mesh){
        geometries.add(object.geometry);
        for(const mat of Array.isArray(object.material)?object.material:[object.material]){
          materials.add(mat);
          for(const value of Object.values(mat))if(value instanceof THREE.Texture)textures.add(value);
        }
      }
    });
    world.remove(courseGroup);
    geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());
    courseGroup=new THREE.Group();courseGroup.name=`course:${course.id}`;world.add(courseGroup);
    const road=new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(course.polygon.map(p=>new THREE.Vector2(p.x,-p.z)))),material('#525b59'));
    road.rotation.x=-Math.PI/2;road.position.y=.021;road.receiveShadow=true;courseGroup.add(road);
    const paintGeometry=new THREE.BoxGeometry(1,1,1);
    const edgeMaterial=material('#e4e3d8'), guideMaterial=material('#dab851'), markMaterial=material('#92ba9f');
    const paint=(a:Point,b:Point,mat:THREE.Material=edgeMaterial)=>{
      const dx=b.x-a.x,dz=b.z-a.z;
      const mesh=new THREE.Mesh(paintGeometry,mat);
      mesh.position.set((a.x+b.x)/2,.04,(a.z+b.z)/2);
      mesh.scale.set(Math.hypot(dx,dz),.008,.065);
      mesh.rotation.y=-Math.atan2(dz,dx);mesh.receiveShadow=true;courseGroup.add(mesh);
    };
    course.boundaries.forEach(([a,b])=>paint(a,b));
    paint(...course.startMark,markMaterial);
    const dashed=(a:Point,b:Point,step:number,dash:number,mat:THREE.Material)=>{
      const length=Math.hypot(b.x-a.x,b.z-a.z);
      const at=(d:number)=>({x:a.x+(b.x-a.x)*d/length,z:a.z+(b.z-a.z)*d/length});
      for(let d=0;d<length;d+=step)paint(at(d),at(Math.min(d+dash,length)),mat);
    };
    dashed(...course.finish,.45,.24,markMaterial);
    // Carry dash phase across sampled segments instead of restarting every chord.
    let distance=0;
    for(let i=1;i<course.center.length;i++){
      const a=course.center[i-1],b=course.center[i],length=Math.hypot(b.x-a.x,b.z-a.z);
      for(let d=0;d<length;){
        const phase=(distance+d)%1.2, span=Math.min(length-d,(phase<.45?.45:1.2)-phase);
        if(span<1e-8){d+=1e-7;continue;}
        if(phase<.45)paint({x:a.x+(b.x-a.x)*d/length,z:a.z+(b.z-a.z)*d/length},{x:a.x+(b.x-a.x)*(d+span)/length,z:a.z+(b.z-a.z)*(d+span)/length},guideMaterial);
        d+=span;
      }
      distance+=length;
    }
    // Reparent each freshly painted label so its canvas texture is course-owned.
    const label=(text:string,x:number,z:number,w:number,h:number)=>{groundText(text,x,z,w,h);courseGroup.add(world.children[world.children.length-1]);};
    label(`${course.label} / ${course.number}`,(course.bounds.minX+course.bounds.maxX)/2,course.bounds.minZ-2.5,8,1);
    label('START',course.start.x,course.start.z+2.5,2.6,.6);
    const [f1,f2]=course.finish;label('FINISH',(f1.x+f2.x)/2+3,(f1.z+f2.z)/2,2.6,.6);
    world.updateMatrixWorld(true);
  }
  groundText('LARRIA', -9, -6, 10, 2.3);
  setCourse(RIGHT_ANGLE);

  function tree(x: number, z: number, scale = 1) {
    instance(cylinder, bark, x, 1.9 * scale, z, 0.19 * scale, 3.8 * scale, 0.19 * scale);
    instance(crown, leaves[Math.floor(random() * leaves.length)], x, 4.5 * scale, z, 2.1 * scale, 2.5 * scale, 2 * scale, random() * 6);
    instance(crown, leaves[1], x + 0.85 * scale, 4.25 * scale, z + 0.35, 1.45 * scale, 1.8 * scale, 1.4 * scale);
  }
  for (const side of [-1, 1]) {
    for (let z = -43; z <= 43; z += 14) {
      const x = side * 56;
      solid(concreteLight, x, 0.32, z, 4.6, 0.64, 5.5);
      block(grass, x, 0.66, z, 4.2, 0.05, 5.1, false);
      tree(x, z, 0.85 + random() * 0.25);
    }
    for (let z = -42; z <= 42; z += 28) {
      const x = side * 48.6;
      // Tall poles are real obstacles, deliberately tucked against the perimeter.
      solid(metal, x, 3.8, z, 0.18, 7.6, 0.18);
      block(metal, x - side * 0.6, 7.58, z, 1.4, 0.14, 0.16);
      block(charcoal, x - side * 1.15, 7.5, z, 0.75, 0.12, 0.36);
      block(white, x - side * 1.15, 7.429, z, 0.6, 0.015, 0.25, false);
    }
  }

  function building(x: number, z: number, width: number, depth: number, height: number) {
    solid(concreteLight, x, height / 2, z, width, height, depth);
    block(charcoal, x, height + 0.15, z, width + 0.6, 0.3, depth + 0.6);
    const front = z + depth / 2 + 0.025;
    block(glass, x, height * 0.52, front, width - 1.1, height * 0.66, 0.06);
    for (let px = x - width / 2 + 1; px < x + width / 2; px += 2.8) block(metal, px, height * 0.52, front + 0.05, 0.065, height * 0.67, 0.1);
    block(concreteLight, x, height * 0.53, front + 0.08, width, 0.16, 0.17);
    block(concrete, x, 0.12, front + 1.6, width + 3, 0.24, 3.5);
    for (let px = x - width / 2 + 2; px < x + width / 2; px += 5) block(metal, px, height + 0.5, z - 1, 1.8, 0.7, 2.1);
  }
  building(-26, -66, 31, 13, 8.2);
  building(22, -72, 24, 16, 11.5);
  building(-77, -23, 19, 32, 14);
  building(78, -7, 22, 27, 10);
  building(69, 41, 19, 18, 6.5);
  // Architectural canopy on the main lab, well beyond the driving boundary.
  block(charcoal, -26, 4.1, -56.7, 33, 0.24, 5.5);
  for (const x of [-41, -11]) solid(metal, x, 2, -55, 0.2, 4, 0.2);
  const signCanvas = canvas(1024, 256);
  signCanvas.ctx.fillStyle = '#303638';
  signCanvas.ctx.fillRect(0, 0, 1024, 256);
  signCanvas.ctx.fillStyle = '#e8e6db';
  signCanvas.ctx.font = `600 106px ${font}`;
  signCanvas.ctx.fillText('LARRIA', 48, 128);
  signCanvas.ctx.fillStyle = '#d3b665';
  signCanvas.ctx.font = `400 36px ${font}`;
  signCanvas.ctx.fillText('D R I V E   L A B', 52, 193);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshStandardMaterial({ map: texture(signCanvas.el), roughness: 0.9 }));
  sign.position.set(-26, 6.4, -59.41);
  sign.castShadow = true;
  world.add(sign);

  // Drain covers and construction joints add scale without noisy street furniture.
  for (const side of [-1, 1]) {
    for (let z = -40; z <= 40; z += 10) {
      line(side * 46.4, z, 0.55, 1.4, charcoal);
      for (let i = 0; i < 6; i++) line(side * 46.4, z - 0.55 + i * 0.22, 0.44, 0.035, metal);
    }
  }
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2;
    const radius = 95 + random() * 35;
    tree(Math.cos(angle) * radius, Math.sin(angle) * radius, 0.9 + random() * 0.7);
  }
  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * Math.PI * 2;
    const distance = 190 + random() * 35;
    instance(hill, mountain, Math.cos(angle) * distance, -6, Math.sin(angle) * distance,
      35 + random() * 38, 16 + random() * 23, 30 + random() * 28, random() * 3, false);
  }

  for (const batch of batches.values()) {
    const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = batch.cast;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    world.add(mesh);
  }
  world.updateMatrixWorld(true);
  return { walls, setCourse };
}
