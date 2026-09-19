from pathlib import Path

def edit(file,old,new):
 p=Path(file);s=p.read_text();assert s.count(old)==1,(file,old[:80]);p.write_text(s.replace(old,new))

edit('js/art/geometry.js', 'export function leaf(parent, mat, length = 1, width = .4, bend = .25) {', 'export function leaf(parent, mat, length = 1, width = .4, bend = .25, segments = 12) {')
edit('js/art/geometry.js', '  const n = 12;', '  const n = Math.max(2, Math.min(24, segments | 0));')
edit('js/world.js', 'leaf(template,grassMat,.65+i*.16,.026+i*.007,.13)', 'leaf(template,grassMat,.65+i*.16,.026+i*.007,.13,2)')
edit('tests/art.test.mjs', "import { disposeRig } from '../js/art/geometry.js';", "import { disposeRig, leaf } from '../js/art/geometry.js';")
p=Path('tests/art.test.mjs');p.write_text(p.read_text()+'''
test('grass uses eight triangles per blade while character leaves keep their detail',()=>{
  const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial();
  const grass=leaf(root,mat,1,.04,.1,2),detail=leaf(root,mat,1,.2,.1);
  assert.equal(grass.geometry.index.count/3,8);
  assert.equal(detail.geometry.index.count/3,48);
  finiteRig(root);disposeRig(root);
});
''')
print('Grass tessellation reduced from 144 to 24 triangles per tuft; character geometry unchanged')
