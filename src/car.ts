import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ferrariViewProfile } from './ferrari-view-profile';

export async function loadCar() {
  const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
  const loader = new GLTFLoader().setDRACOLoader(draco);
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/ferrari.glb`);
  draco.dispose();
  const root = gltf.scene;
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x668d83, metalness: .82, roughness: .24, clearcoat: 1, clearcoatRoughness: .16 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xc6ddd9, metalness: .08, roughness: .08, transparent: true, opacity: .17, depthWrite: false, side: THREE.DoubleSide });
  const red = new THREE.MeshStandardMaterial({color:0x660b09,emissive:0xff1405,emissiveIntensity:.3,roughness:.25});
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    obj.castShadow = obj.name !== 'glass'; obj.receiveShadow = true;
    const name = obj.name.toLowerCase();
    let color=0x353b39, roughness=.55, metalness=.05;
    if (/leather|steering/.test(name)) {color=0x252b29;roughness=.8;}
    if (/interior_light/.test(name)) {color=0x9a8062;roughness=.9;}
    if (/interior_dark|carpet|carbon|grill|plastic/.test(name)) {color=0x171d1b;roughness=.8;}
    if (/tire/.test(name)) {color=0x131715;roughness=1;}
    if (/rim|metal|chrome|nuts|wheel$|centre/.test(name)) {color=0x818b87;roughness=.28;metalness=.9;}
    if (/brake/.test(name)) {color=0xa88f47;roughness=.45;metalness=.6;}
    if (/yellow/.test(name)) {color=0xd9b840;roughness=.4;}
    if (/lights|led/.test(name)) {color=0xdce9e5;roughness=.18;metalness=.4;}
    obj.material=new THREE.MeshStandardMaterial({color,roughness,metalness});
    if (obj.name === 'body') obj.material = paint;
    if (obj.name === 'glass') obj.material = glass;
    if (obj.name === 'lights_red') obj.material = red;
    if (obj.name === 'trim') obj.material = new THREE.MeshStandardMaterial({color:0x482b21,roughness:.65});
  });
  const wheelNames = ['wheel_fl','wheel_fr','wheel_rl','wheel_rr'];
  const wheels = wheelNames.map(name => {
    const wheel = root.getObjectByName(name)!;
    const pivot = new THREE.Group(); pivot.position.copy(wheel.position);
    wheel.parent!.add(pivot); pivot.add(wheel); wheel.position.set(0,0,0);
    return {pivot,wheel,base:wheel.quaternion.clone()};
  });
  const steering = root.getObjectByName('steering_wheel')!;
  const steeringBase = steering.quaternion.clone();
  const pedals: THREE.Mesh[] = [];
  for (let i=0;i<2;i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(i===0?.10:.055,.018,.16),new THREE.MeshStandardMaterial({color:0x919998,metalness:.75,roughness:.3}));
    p.position.set(-.39+i*.14,.22,-.65);p.rotation.x=.7;root.add(p);pedals.push(p);
    for(let j=0;j<4;j++){
      const rib=new THREE.Mesh(new THREE.BoxGeometry(i===0?.08:.04,.006,.009),new THREE.MeshStandardMaterial({color:0x202625}));rib.position.set(0,.012,-.055+j*.035);p.add(rib);
    }
  }
  const reverseLights = [-.62,.62].map(x=>{
    const light=new THREE.Mesh(new THREE.BoxGeometry(.11,.025,.012),new THREE.MeshStandardMaterial({color:0xd9e1d9,emissive:0xffffff,emissiveIntensity:0}));light.position.set(x,.55,2.05);root.add(light);return light;
  });
  let roll=0;
  return {root,paint,glass,profile:ferrariViewProfile(root),update(speed:number,steer:number,brake:number,throttle:number,gear:string,dt:number){
    roll-=speed*dt/.35;
    wheels.forEach(({pivot,wheel,base},i)=>{pivot.rotation.y=i<2?steer:0;wheel.quaternion.copy(base).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),roll));});
    steering.quaternion.copy(steeringBase).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-steer*12));
    pedals[0].rotation.x=.7-brake*.35;pedals[1].rotation.x=.7-throttle*.35;
    red.emissiveIntensity=brake>.05?3:.3;
    reverseLights.forEach(l=>(l.material as THREE.MeshStandardMaterial).emissiveIntensity=gear==='R'?2:0);
  }};
}
