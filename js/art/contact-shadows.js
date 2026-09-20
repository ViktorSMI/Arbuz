import * as THREE from 'three';

/** One bounded draw for soft contact shadows. Supplements, not replaces, sun shadows. */
export function createContactShadows(scene, heightAt, capacity = 96) {
  const geometry=new THREE.PlaneGeometry(1,1);
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    vertexShader:`varying vec2 vContactUv;
      void main(){vContactUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vContactUv;
      void main(){float r=length((vContactUv-.5)*2.0);float a=pow(max(0.0,1.0-r*r),3.0)*.24;
      if(a<.002)discard;gl_FragColor=vec4(.025,.033,.025,a);}`,
  });
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name='orchard-contact-shadows';
  mesh.frustumCulled=false;mesh.count=0;mesh.renderOrder=1;scene.add(mesh);
  const transform=new THREE.Object3D(),normal=new THREE.Vector3(),axis=new THREE.Vector3(0,0,1);
  return {
    update(player,enemies,npcs,boss) {
      let count=0;
      const add=(x,z,y,radius)=>{
        if(count>=capacity||![x,z,y,radius].every(Number.isFinite))return;
        if(Math.hypot(x-player.pos.x,z-player.pos.z)>65)return;
        const ground=heightAt(x,z),altitude=Math.max(0,y-ground);
        if(altitude>4)return;
        const dx=heightAt(x+.25,z)-heightAt(x-.25,z),dz=heightAt(x,z+.25)-heightAt(x,z-.25);
        normal.set(-dx*2,1,-dz*2).normalize();transform.quaternion.setFromUnitVectors(axis,normal);
        transform.position.set(x,ground+.038,z);transform.scale.set(radius*2.2/(1+altitude*.25),radius*1.65/(1+altitude*.25),1);
        transform.updateMatrix();mesh.setMatrixAt(count++,transform.matrix);
      };
      add(player.pos.x,player.pos.z,player.pos.y,.83);
      for(const e of enemies)if(e.alive)add(e.x,e.z,e.y,e.type.r*1.1);
      for(const n of npcs)if(n.alive)add(n.x,n.z,n.y,.65);
      if(boss?.alive)add(boss.x,boss.z,boss.y,2.8);
      mesh.count=count;mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){mesh.dispose();geometry.dispose();material.dispose();mesh.removeFromParent();},
    mesh,
  };
}
