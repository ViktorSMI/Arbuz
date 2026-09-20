import * as THREE from 'three';
import { landStyle } from './palette.js';

const glslNoise = `
float orchardHash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float orchardNoise(vec2 p) {
  vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(orchardHash(i),orchardHash(i+vec2(1,0)),f.x),
             mix(orchardHash(i+vec2(0,1)),orchardHash(i+vec2(1,1)),f.x),f.y);
}
float orchardFbm(vec2 p) { return orchardNoise(p)*.57 + orchardNoise(p*2.03+7.4)*.28 + orchardNoise(p*4.13-3.2)*.15; }
`;

const soilUniforms = {
  uSoil: { value: new THREE.Color('#a59170') }, uMoss: { value: new THREE.Color('#5e7444') },
  uStone: { value: new THREE.Color('#989d91') }, uVegetation: { value: 1 },
};
export function setGroundPalette(index) {
  const style=landStyle(index);
  soilUniforms.uSoil.value.set(style.ground).lerp(new THREE.Color('#b7a184'),.60);
  soilUniforms.uMoss.value.set(style.foliage).lerp(new THREE.Color('#b9bf75'),.16);
  soilUniforms.uStone.value.set(style.stone);
  soilUniforms.uVegetation.value=index===1||index===4?.23:index===5?.12:1;
}

export function terrainShader(mat) {
  mat.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,soilUniforms);
    shader.vertexShader='varying vec3 vGroundPosition; varying float vGroundSlope;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vGroundPosition=(modelMatrix*vec4(position,1.0)).xyz; vGroundSlope=1.0-normal.y;
    `);
    shader.fragmentShader=`varying vec3 vGroundPosition; varying float vGroundSlope;
      uniform vec3 uSoil,uMoss,uStone; uniform float uVegetation;\n${glslNoise}\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      float patches=orchardFbm(vGroundPosition.xz*.12);
      float road=abs(vGroundPosition.x-(vGroundPosition.z*.88+sin(vGroundPosition.z*.022)*10.0))/1.33;
      float verge=smoothstep(1.3,3.7+patches,road);
      float vegetation=verge*(.48+.52*smoothstep(.3,.7,patches))*uVegetation;
      vec3 ground=mix(uSoil,uMoss,vegetation);
      ground=mix(ground,uStone,smoothstep(.12,.36,vGroundSlope));
      vec3 fine=texture2D(map,vGroundPosition.xz*.23).rgb;
      vec3 broad=texture2D(map,mat2(.8,.6,-.6,.8)*vGroundPosition.xz*.057).rgb;
      diffuseColor.rgb=ground*(.74+fine.g*.65)*(.88+broad.g*.36);
    `);
  };
  mat.customProgramCacheKey=()=> 'orchard-terrain-2';
}

export function createSkyMaterial(time) {
  return new THREE.ShaderMaterial({
    side:THREE.BackSide,depthWrite:false,
    uniforms:{uTop:{value:new THREE.Color('#668895')},uBot:{value:new THREE.Color('#afbeae')},uHor:{value:new THREE.Color('#afbeae')},
      uTime:time,uSun:{value:new THREE.Vector3(.3,.6,.6).normalize()},uNight:{value:0}},
    vertexShader:'varying vec3 vDir; void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 uTop,uBot,uHor,uSun;uniform float uTime,uNight;varying vec3 vDir;${glslNoise}
      void main(){
        vec3 d=normalize(vDir);float h=d.y;
        vec3 c=mix(uHor,uTop,smoothstep(-.03,.85,h));
        vec2 p=d.xz/max(.18,h+.22)*2.4+vec2(uTime*.008,0.0);
        float n=orchardFbm(p), high=orchardFbm(p*2.0+19.0);
        float cloud=smoothstep(.50,.72,n+high*.15)*smoothstep(.02,.25,h);
        vec3 cloudColor=mix(uHor*.82,vec3(.87,.88,.81),smoothstep(.52,.83,n));
        c=mix(c,cloudColor,cloud*.70);
        float sun=max(0.0,dot(d,uSun));
        c+=vec3(1.0,.70,.32)*pow(sun,42.0)*.23*(1.0-cloud)*(1.0-uNight);
        c+=vec3(2.3,1.8,.9)*smoothstep(.99955,.99983,sun)*(1.0-cloud)*(1.0-uNight);
        c=mix(c,uBot,smoothstep(.0,.28,-h));
        c=mix(c,c*vec3(.32,.43,.67),uNight*.74);
        float star=step(.9986,orchardHash(floor(d.xz/max(.08,h)*400.0)))*smoothstep(.12,.4,h);
        c+=star*uNight*.5;
        gl_FragColor=vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
