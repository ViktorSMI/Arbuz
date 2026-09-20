from pathlib import Path
import hashlib

def patch(name, base, edits, expected):
    p=Path(name);data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()==base, name+' base mismatch'
    lines=data.decode().splitlines(keepends=True)
    for start,count,replacement in reversed(edits): lines[start:start+count]=replacement.splitlines(keepends=True)
    data=''.join(lines).encode()
    assert hashlib.sha256(data).hexdigest()==expected, name+' output mismatch'
    p.write_bytes(data)

patch('js/art/botany.js','b672ae9d42b8d1e9fbb798df5f754ee2750d2fde95308a86e913449558df38ec',[(89, 1, '/** Instanced ferns, small flowers and path gravel share three draws. */\n'), (126, 0, "    // MeshStandardMaterial has no default vertex colour. Supply white before\n    // multiplying the authored material and per-instance colour in the shader.\n    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(\n      new Float32Array(mesh.geometry.attributes.position.count*3).fill(1),3));\n")],'856ead3aaa1faa00933ffa590c49ca3558d62de38ead01ae3fe100370942d6c3')

patch('js/art/inhabitants.js','49a64d76f86554e4137595702f334937565034311fa5b3e2350dde7a555f5801',[(24, 1, '  const geometry=new THREE.LatheGeometry(points,40), top=[], underside=[];\n  const indices=geometry.index.array, quads=points.length-1;\n  for(let q=0;q<40*quads;q++) {\n    const target=q%quads<6?top:underside;\n    for(let k=0;k<6;k++)target.push(indices[q*6+k]);\n  }\n  geometry.setIndex([...top,...underside]);geometry.clearGroups();\n  geometry.addGroup(0,top.length,0);geometry.addGroup(top.length,underside.length,1);\n  return geometry;\n'), (52, 3, "    const leg=pivot(hip,`resident-leg${side}`,[s*(index===2?.14:.18),-.18,0]);root.userData[`leg${side}`]=leg;\n    link(leg,material('bark'),[0,0,0],[0,-.51,0],.09,.065);\n    part(leg,material('bark','#c6b28c'),[0,-.55,.1],[.14,.075,.23]);\n"), (76, 1, "    sculpt(hip,capGeometry(),[material('mushroom'),material('bone','#f0e0bb')],[0,.98,0]);\n")],'d70ffa97e4d9ffbf4cca5fa66fb08a2e299b7b10f26ec6539f2d7fe99ba54825')

patch('tests/refinement.test.mjs','c66a3544dbfbc18eca0b95d869aaa94687a70c69d4a5132efc9ca95e28539ba6',[(1, 0, "import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\n"), (8, 1, "import { createTree, createGroundcover } from '../js/art/botany.js';\n"), (76, 0, "\ntest('instanced understory always supplies neutral vertex colours',()=>{\n  const cover=createGroundcover(0,randomSeed(19),()=>0,()=>5,mergeGeometries,{value:0},'low');\n  assert.equal(cover.children.length,3);\n  for(const mesh of cover.children){\n    assert(mesh.count>0);assert.equal(mesh.geometry.attributes.color.count,mesh.geometry.attributes.position.count);\n    assert(Array.from(mesh.geometry.attributes.color.array).every(v=>v===1));\n  }\n  disposeRig(cover);\n});\ntest('NPC upper leg pivots are embedded in their body rather than detached',()=>{\n  for(const name of RESIDENT_NAMES){\n    const rig=createResident(name);rig.updateMatrixWorld(true);\n    for(const side of ['L','R']){\n      const point=rig.userData[`leg${side}`].getWorldPosition(new THREE.Vector3());\n      rig.userData.body.worldToLocal(point);assert(point.length()<1,name+' '+side);\n    }\n    disposeRig(rig);\n  }\n});\n")],'1ca9576c9e4d6fde149d4147ba0669229ff1dc50ed95babdb5d77c84208fa953')
