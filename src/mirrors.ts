import * as THREE from 'three';
import type { VehicleViewProfile } from './vehicle-view-profile';

// Horizontally mirrored rear cameras: useful driving views, NOT planar/convex optics.
// The center camera is deliberately behind the cabin, as specified by the model adapter.
export class MirrorSystem {
  /** Controls floating previews only; physical surfaces continue updating. */
  enabled = true;
  entries: {name:string;camera:THREE.PerspectiveCamera;target:THREE.WebGLRenderTarget;preview:THREE.Scene;previewCamera:THREE.OrthographicCamera;surface:THREE.Mesh;position:THREE.Vector3;direction:THREE.Vector3}[] = [];
  constructor(private root: THREE.Object3D, profile: VehicleViewProfile) {
    for (const binding of profile.mirrors) {
      const target = new THREE.WebGLRenderTarget(Math.round(320 * binding.aspect), 320, {type:THREE.HalfFloatType});
      const material = new THREE.ShaderMaterial({
        uniforms:{map:{value:target.texture}},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vec2(1.0-vUv.x,vUv.y));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
        side:THREE.DoubleSide, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1,
      });
      const surface = new THREE.Mesh(binding.geometry, material);
      surface.name = `mirror-surface-${binding.name}`;
      surface.visible = false;
      root.add(surface);
      const preview = new THREE.Scene();
      preview.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
      const previewCamera = new THREE.OrthographicCamera(-1,1,1,-1,.01,5); previewCamera.position.z = 1;
      const camera = new THREE.PerspectiveCamera(binding.fov,binding.aspect,.05,180);
      this.entries.push({name:binding.name,camera,target,preview,previewCamera,surface,position:binding.cameraPosition.clone(),direction:binding.direction.clone()});
    }
  }
  showSurfaces(visible: boolean) { this.entries.forEach(e => e.surface.visible = visible); }
  update(renderer:THREE.WebGLRenderer,scene:THREE.Scene,_eye?:THREE.PerspectiveCamera) {
    scene.updateMatrixWorld(true);
    const visibility = this.entries.map(e => e.surface.visible);
    const target = renderer.getRenderTarget(), viewport = renderer.getViewport(new THREE.Vector4()), scissor = renderer.getScissor(new THREE.Vector4()), scissorTest = renderer.getScissorTest();
    this.entries.forEach(e => e.surface.visible = false);
    try {
      renderer.setScissorTest(false);
      for (const e of this.entries) {
        e.camera.position.copy(this.root.localToWorld(e.position.clone()));
        const direction = e.direction.clone().transformDirection(this.root.matrixWorld);
        e.camera.up.set(0,1,0).transformDirection(this.root.matrixWorld);
        e.camera.lookAt(e.camera.position.clone().add(direction));
        renderer.setRenderTarget(e.target); renderer.clear(); renderer.render(scene,e.camera);
      }
    } finally {
      this.entries.forEach((e,i) => e.surface.visible = visibility[i]);
      renderer.setRenderTarget(target); renderer.setViewport(viewport); renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
    }
  }
  draw(renderer:THREE.WebGLRenderer,expanded:string|null) {
    if (!this.enabled) return;
    const viewport=renderer.getViewport(new THREE.Vector4()), scissor=renderer.getScissor(new THREE.Vector4()), scissorTest=renderer.getScissorTest();
    const canvas=renderer.domElement.getBoundingClientRect(), size=renderer.getSize(new THREE.Vector2());
    const drawRect=(element:HTMLElement|null,e:typeof this.entries[number])=>{
      if (!element || !element.getClientRects().length) return;
      const rect=element.getBoundingClientRect(); if (!rect.width || !rect.height) return;
      const x=(rect.left-canvas.left)*size.x/canvas.width, y=(canvas.bottom-rect.bottom)*size.y/canvas.height, w=rect.width*size.x/canvas.width, h=rect.height*size.y/canvas.height;
      renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.clearDepth();renderer.render(e.preview,e.previewCamera);
    };
    try {
      renderer.setScissorTest(true);
      for(const e of this.entries){drawRect(document.getElementById(`mirror-${e.name}`),e);if(expanded===e.name)drawRect(document.getElementById('mirror-expanded'),e);}
    } finally {renderer.setScissorTest(scissorTest);renderer.setViewport(viewport);renderer.setScissor(scissor);}
  }
  dispose() {
    for (const e of this.entries) {
      e.surface.removeFromParent(); e.surface.geometry.dispose(); (e.surface.material as THREE.Material).dispose(); e.target.dispose();
      e.preview.traverse(o => { if(o instanceof THREE.Mesh)o.geometry.dispose(); });
    }
    this.entries.length=0;
  }
}
