import * as THREE from 'three';

// Mirrored rear cameras provide useful driving views without claiming convex-mirror optics.
export class MirrorSystem {
  enabled=true;
  entries:{name:string;camera:THREE.PerspectiveCamera;target:THREE.WebGLRenderTarget;preview:THREE.Scene;previewCamera:THREE.OrthographicCamera;surface:THREE.Mesh;position:THREE.Vector3;direction:THREE.Vector3}[]=[];
  constructor(private root:THREE.Object3D){
    const configs=[{name:'left',pos:[-1.12,.86,-.60],dir:[-.15,-.09,1],w:.24,h:.13,angle:.35,fov:55},{name:'center',pos:[.035,1.105,-.26],dir:[0,-.02,1],w:.28,h:.088,angle:-.32,fov:60},{name:'right',pos:[1.12,.86,-.60],dir:[.15,-.09,1],w:.24,h:.13,angle:-.5,fov:55}];
    for(const c of configs){
      const target=new THREE.WebGLRenderTarget(640,320,{type:THREE.HalfFloatType});
      const material=new THREE.ShaderMaterial({uniforms:{map:{value:target.texture}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D map;varying vec2 vUv;void main(){gl_FragColor=texture2D(map,vec2(1.0-vUv.x,vUv.y));\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',side:THREE.DoubleSide});
      const surface=new THREE.Mesh(new THREE.PlaneGeometry(c.w,c.h),material);surface.position.fromArray(c.pos);surface.rotation.y=c.angle;surface.visible=false;root.add(surface);
      const preview=new THREE.Scene();preview.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
      const previewCamera=new THREE.OrthographicCamera(-1,1,1,-1,.01,5);previewCamera.position.z=1;
      const camera=new THREE.PerspectiveCamera(c.fov,2,.05,180);
      this.entries.push({name:c.name,camera,target,preview,previewCamera,surface,position:new THREE.Vector3().fromArray(c.pos),direction:new THREE.Vector3().fromArray(c.dir)});
    }
  }
  update(renderer:THREE.WebGLRenderer,scene:THREE.Scene,_eye:THREE.PerspectiveCamera){
    if(!this.enabled)return;
    scene.updateMatrixWorld(true);
    this.entries.forEach(e=>e.surface.visible=false);
    for(const e of this.entries){
      // Center camera is placed at the back window; side cameras retain the body edge.
      const position=e.name==='center'?new THREE.Vector3(0,1.04,1.6):e.position.clone();
      e.camera.position.copy(this.root.localToWorld(position));
      const direction=e.direction.clone().transformDirection(this.root.matrixWorld);
      e.camera.up.set(0,1,0).transformDirection(this.root.matrixWorld);
      e.camera.lookAt(e.camera.position.clone().add(direction));
      renderer.setRenderTarget(e.target);renderer.clear();renderer.render(scene,e.camera);
    }
    this.entries.forEach(e=>e.surface.visible=false);renderer.setRenderTarget(null);
  }
  draw(renderer:THREE.WebGLRenderer,expanded:string|null){
    if(!this.enabled)return;
    renderer.setScissorTest(true);
    for(const e of this.entries){
      const rect=document.getElementById(`mirror-${e.name}`)!.getBoundingClientRect();
      if(rect.width===0)continue;
      renderer.setViewport(rect.left,innerHeight-rect.bottom,rect.width,rect.height);renderer.setScissor(rect.left,innerHeight-rect.bottom,rect.width,rect.height);renderer.clearDepth();renderer.render(e.preview,e.previewCamera);
      if(expanded===e.name){
        const big=document.getElementById('mirror-expanded')!.getBoundingClientRect();renderer.setViewport(big.left,innerHeight-big.bottom,big.width,big.height);renderer.setScissor(big.left,innerHeight-big.bottom,big.width,big.height);renderer.clearDepth();renderer.render(e.preview,e.previewCamera);
      }
    }
    renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);
  }
}
