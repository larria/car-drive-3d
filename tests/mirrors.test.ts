import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { extractMirrorGeometry, type VehicleViewProfile } from '../src/vehicle-view-profile';
import { MirrorSystem } from '../src/mirrors';

function fixture(indexed: boolean) {
  const parent=new THREE.Group(); parent.position.set(9,3,-8);parent.rotation.set(.1,.7,.2);parent.scale.set(1.2,1.4,.8);
  const root=new THREE.Group();root.position.set(2,1,3);parent.add(root);
  const nested=new THREE.Group();nested.position.set(.2,.4,-.6);nested.rotation.y=.2;root.add(nested);
  let geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.3,0,0,.3,0,0,.1,.2,0,-.2,.16,0],3));geometry.setIndex([0,1,2,0,2,3]);
  if(!indexed)geometry=geometry.toNonIndexed();
  const mesh=new THREE.Mesh(geometry);nested.add(mesh);
  const extracted=extractMirrorGeometry(root,mesh,new THREE.Box3(new THREE.Vector3(-1,-1,-1),new THREE.Vector3(1,1,1)),new THREE.Vector3(0,0,1));
  return {parent,root,nested,mesh,...extracted};
}
function rendererStub() {
  let target:unknown=null, scissorTest=true;
  const viewport=new THREE.Vector4(3,4,123,321),scissor=new THREE.Vector4(4,5,99,88);
  return {getRenderTarget:()=>target,setRenderTarget:vi.fn(t=>target=t),getViewport:(v:THREE.Vector4)=>v.copy(viewport),setViewport:vi.fn(),getScissor:(v:THREE.Vector4)=>v.copy(scissor),setScissor:vi.fn(),getScissorTest:()=>scissorTest,setScissorTest:vi.fn(v=>scissorTest=v),clear:vi.fn(),render:vi.fn()};
}
describe('model-bound mirrors',()=>{
  it.each([true,false])('preserves actual nonrectangular topology under nested transforms (indexed=%s)',indexed=>{
    const {root,mesh,geometry}=fixture(indexed);expect(geometry.attributes.position.count).toBe(6);
    const matrix=root.matrixWorld.clone().invert().multiply(mesh.matrixWorld);
    const actual=new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,0);
    const expected=new THREE.Vector3(-.3,0,0).applyMatrix4(matrix);
    expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
    for(const value of geometry.attributes.uv.array)expect(value).toBeGreaterThanOrEqual(0);
    for(const value of geometry.attributes.uv.array)expect(value).toBeLessThanOrEqual(1);
    expect(mesh.geometry.attributes.position.count).toBe(indexed?4:6);
  });
  it('requires explicit matching geometry instead of a silent Ferrari/rectangle fallback',()=>{
    const {root,mesh}=fixture(true);
    expect(()=>extractMirrorGeometry(root,mesh,new THREE.Box3(new THREE.Vector3(9,9,9),new THREE.Vector3(10,10,10)),new THREE.Vector3(0,0,1))).toThrow('explicit view-profile');
  });
  it.each([new THREE.Vector3(-.5,1.3,.3),new THREE.Vector3(.6,2,-1)])('supports alternate vehicle eye %s and transforms',eye=>{
    const {root,parent,geometry,aspect}=fixture(true);
    const profile:VehicleViewProfile={id:'different-car',eye,mirrors:[{name:'left',geometry,aspect,cameraPosition:new THREE.Vector3(-2,1,-.8),direction:new THREE.Vector3(.1,0,1),fov:42}]};
    const mirrors=new MirrorSystem(root,profile),scene=new THREE.Scene();scene.add(parent);
    const renderer=rendererStub();mirrors.enabled=false;mirrors.showSurfaces(true);mirrors.update(renderer as unknown as THREE.WebGLRenderer,scene);
    expect(renderer.render).toHaveBeenCalledTimes(1);expect(mirrors.entries[0].surface.visible).toBe(true);
    expect(mirrors.entries[0].camera.position.distanceTo(root.localToWorld(profile.mirrors[0].cameraPosition.clone()))).toBeLessThan(1e-6);
    expect(root.worldToLocal(root.localToWorld(eye.clone())).distanceTo(eye)).toBeLessThan(1e-6);
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);expect(renderer.setScissorTest).toHaveBeenLastCalledWith(true);
    mirrors.showSurfaces(false);mirrors.update(renderer as unknown as THREE.WebGLRenderer,scene);expect(renderer.render).toHaveBeenCalledTimes(2);expect(mirrors.entries[0].surface.visible).toBe(false);
    mirrors.dispose();expect(root.getObjectByName('mirror-surface-left')).toBeUndefined();
  });
  it('restores surface and renderer state when offscreen rendering throws',()=>{
    const {root,parent,geometry,aspect}=fixture(true);const scene=new THREE.Scene();scene.add(parent);
    const mirrors=new MirrorSystem(root,{id:'test',eye:new THREE.Vector3(),mirrors:[{name:'center',geometry,aspect,cameraPosition:new THREE.Vector3(),direction:new THREE.Vector3(0,0,1),fov:50}]});
    const renderer=rendererStub();renderer.render.mockImplementation(()=>{throw new Error('render failed')});mirrors.showSurfaces(true);
    expect(()=>mirrors.update(renderer as unknown as THREE.WebGLRenderer,scene)).toThrow('render failed');
    expect(mirrors.entries[0].surface.visible).toBe(true);expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(null);
  });
});
