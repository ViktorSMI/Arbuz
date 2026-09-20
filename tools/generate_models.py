from __future__ import annotations

import math
from pathlib import Path
from typing import Iterable

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'models'
OUT.mkdir(parents=True, exist_ok=True)


def mat(name: str, color: str, roughness: float = .75, metallic: float = 0.0, emissive: str | None = None, double: bool = False):
    rgb = trimesh.visual.color.hex_to_rgba(color)
    ef = trimesh.visual.color.hex_to_rgba(emissive)[:3] / 255.0 if emissive else None
    return PBRMaterial(
        name=name,
        baseColorFactor=rgb,
        roughnessFactor=roughness,
        metallicFactor=metallic,
        emissiveFactor=ef,
        doubleSided=double,
    )

MATS = {
    'rind': mat('rind', '#6f9764', .86),
    'rind_dark': mat('rind_dark', '#315443', .9),
    'bark': mat('bark', '#80644c', .96),
    'bark_light': mat('bark_light', '#b59a73', .94),
    'leaf': mat('leaf', '#8fae69', .82, double=True),
    'leaf_dark': mat('leaf_dark', '#4f744f', .9, double=True),
    'cloth': mat('cloth', '#a95e54', .96, double=True),
    'cloth_pale': mat('cloth_pale', '#d1b89e', .98, double=True),
    'bronze': mat('bronze', '#b08c52', .48, .55),
    'iron': mat('iron', '#536166', .35, .72),
    'steel': mat('steel', '#c7d0c9', .26, .82),
    'bone': mat('bone', '#d8cfaa', .88),
    'eye': mat('eye', '#ddc977', .24, .05, '#9e8a43'),
    'stone': mat('stone', '#a7a598', .98),
    'stone_dark': mat('stone_dark', '#6f736e', .98),
    'moss': mat('moss', '#657a4f', .98),
    'pumpkin': mat('pumpkin', '#a96837', .9),
    'cactus': mat('cactus', '#628459', .92),
    'mushroom': mat('mushroom', '#98554d', .82),
    'mushroom_gill': mat('mushroom_gill', '#d8caa9', .94),
    'carrot': mat('carrot', '#bd6d39', .9),
    'aubergine': mat('aubergine', '#5d486b', .8),
    'fur': mat('fur', '#8b7c75', .98),
    'feather': mat('feather', '#73878a', .88, double=True),
    'chitin': mat('chitin', '#8f9b72', .6, .15),
}


def apply(mesh: trimesh.Trimesh, material: PBRMaterial, name: str):
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    mesh.metadata['name'] = name
    return mesh


def translate(mesh: trimesh.Trimesh, xyz):
    mesh.apply_translation(xyz)
    return mesh


def scale(mesh: trimesh.Trimesh, xyz):
    mesh.apply_scale(xyz)
    return mesh


def rotate(mesh: trimesh.Trimesh, axis, angle):
    mesh.apply_transform(trimesh.transformations.rotation_matrix(angle, axis))
    return mesh


def lobe_sphere(scale_xyz=(1, 1, 1), lobes=10, depth=.06, material=MATS['rind'], name='body', count=(28, 20), taper=0.0, bend=0.0):
    mesh = trimesh.creation.uv_sphere(radius=1.0, count=count)
    v = mesh.vertices.copy()
    r = np.linalg.norm(v, axis=1)
    theta = np.arccos(np.clip(v[:, 2] / np.maximum(r, 1e-8), -1, 1))
    phi = np.arctan2(v[:, 1], v[:, 0])
    rib = 1 + depth * np.cos(phi * lobes + np.cos(theta) * .23) * np.sin(theta)
    v[:, 0] *= rib * (1 - taper * np.cos(theta))
    v[:, 1] *= rib * (1 - taper * np.cos(theta))
    v[:, 0] += bend * (1 - np.cos(theta) ** 2)
    mesh.vertices = v
    mesh.apply_scale(scale_xyz)
    mesh.fix_normals()
    return apply(mesh, material, name)


def ellipsoid(scale_xyz=(1, 1, 1), material=MATS['stone'], name='mesh', subdivisions=2):
    mesh = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1)
    mesh.apply_scale(scale_xyz)
    mesh.fix_normals()
    return apply(mesh, material, name)


def box(extents, material, name, position=(0, 0, 0), rotation=None):
    mesh = trimesh.creation.box(extents=extents)
    if rotation:
        axis, angle = rotation
        rotate(mesh, axis, angle)
    translate(mesh, position)
    return apply(mesh, material, name)


def cylinder(radius, height, material, name, position=(0, 0, 0), axis=(0, 1, 0), sections=12):
    mesh = trimesh.creation.cylinder(radius=radius, height=height, sections=sections)
    # trimesh cylinders are aligned to Z; rotate to target axis.
    target = np.array(axis, dtype=float)
    target /= np.linalg.norm(target)
    mesh.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], target))
    translate(mesh, position)
    return apply(mesh, material, name)


def segment(a, b, radius, material, name, sections=10):
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    direction = b - a
    mesh = trimesh.creation.cylinder(radius=radius, height=float(np.linalg.norm(direction)), sections=sections)
    mesh.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], direction))
    mesh.apply_translation((a + b) * .5)
    return apply(mesh, material, name)


def tapered_segment(a, b, r0, r1, material, name, sections=10):
    a = np.asarray(a, dtype=float); b = np.asarray(b, dtype=float)
    direction = b - a
    h = float(np.linalg.norm(direction))
    angles = np.linspace(0, math.tau, sections, endpoint=False)
    verts = []
    for z, r in [(-h/2, r0), (h/2, r1)]:
        verts += [[math.cos(t)*r, math.sin(t)*r, z] for t in angles]
    faces = []
    bottom_center = len(verts); verts.append([0, 0, -h/2])
    top_center = len(verts); verts.append([0, 0, h/2])
    for i in range(sections):
        n = (i + 1) % sections
        faces.extend([[i, n, sections+i], [n, sections+n, sections+i]])
        faces.append([bottom_center, n, i])
        faces.append([top_center, sections+i, sections+n])
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)
    mesh.apply_transform(trimesh.geometry.align_vectors([0, 0, 1], direction))
    mesh.apply_translation((a + b) * .5)
    return apply(mesh, material, name)


def leaf_mesh(length=1.0, width=.32, bend=.15, material=MATS['leaf'], name='leaf'):
    rows = 8
    verts = []
    faces = []
    for i in range(rows + 1):
        t = i / rows
        w = math.sin(math.pi * t) ** .72 * width
        z = bend * t * t
        verts.extend([[-w, t*length, z], [0, t*length, z + .035], [w, t*length, z]])
        if i < rows:
            a = i*3
            faces += [[a, a+3, a+1], [a+1, a+3, a+4], [a+1, a+4, a+2], [a+2, a+4, a+5]]
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=False)
    mesh.fix_normals()
    return apply(mesh, material, name)


def seed_mesh(length=1.0, width=.3, thickness=.08, material=MATS['bronze'], name='seed'):
    rings = 18
    verts = []
    faces = []
    for side in [-1, 1]:
        z = side * thickness * .5
        verts.append([0, 0, z])
        for i in range(1, rings):
            t = i / rings
            y = t * length
            w = math.sin(math.pi*t) ** .82 * width * (1 - .08*t)
            bulge = side * (thickness*.5 + math.sin(math.pi*t)*thickness*.45)
            verts.extend([[-w, y, bulge], [w, y, bulge]])
        verts.append([0, length, z])
    side_count = 2 + (rings-1)*2
    for s in range(2):
        off = s*side_count
        flip = s == 1
        for i in range(rings-1):
            if i == 0:
                tri = [off, off+1, off+2]
                faces.append(tri[::-1] if flip else tri)
            else:
                a = off + 1 + (i-1)*2
                b = off + 1 + i*2
                tris = [[a, b, a+1], [a+1, b, b+1]]
                faces += [t[::-1] for t in tris] if flip else tris
        last = off + side_count - 1
        a = off + 1 + (rings-2)*2
        tri = [a, last, a+1]
        faces.append(tri[::-1] if flip else tri)
    # rim
    front = 0; back = side_count
    outline_f = [front] + [1+i for i in range(side_count-2)] + [side_count-1]
    outline_b = [back] + [back+1+i for i in range(side_count-2)] + [back+side_count-1]
    # Use paired left/right perimeter strips.
    perimeter_f = [front]
    perimeter_b = [back]
    for i in range(rings-1):
        perimeter_f.append(1+i*2)
        perimeter_b.append(back+1+i*2)
    perimeter_f.append(side_count-1)
    perimeter_b.append(back+side_count-1)
    for i in reversed(range(rings-1)):
        perimeter_f.append(2+i*2)
        perimeter_b.append(back+2+i*2)
    for i in range(len(perimeter_f)):
        n=(i+1)%len(perimeter_f)
        faces += [[perimeter_f[i], perimeter_f[n], perimeter_b[i]], [perimeter_f[n], perimeter_b[n], perimeter_b[i]]]
    mesh = trimesh.Trimesh(vertices=np.asarray(verts), faces=np.asarray(faces), process=True)
    mesh.fix_normals()
    return apply(mesh, material, name)


def cape_mesh(width=1.15, length=1.25, material=MATS['cloth'], name='cape'):
    cols, rows = 10, 12
    verts=[]; faces=[]
    for y in range(rows+1):
        t=y/rows
        w=width*(.5+.1*t)
        for x in range(cols+1):
            u=x/cols
            px=(u-.5)*w*2
            py=-t*length
            pz=-.10*t*t + math.sin(u*math.pi*2)*.018*t
            verts.append([px,py,pz])
            if y<rows and x<cols:
                a=y*(cols+1)+x; b=a+cols+1
                faces += [[a,b,a+1],[a+1,b,b+1]]
    mesh=trimesh.Trimesh(vertices=np.asarray(verts),faces=np.asarray(faces),process=False)
    mesh.fix_normals()
    return apply(mesh,material,name)


def add(scene: trimesh.Scene, mesh: trimesh.Trimesh, node_name: str):
    scene.add_geometry(mesh, geom_name=f'{node_name}_geometry', node_name=node_name)


def export(scene: trimesh.Scene, name: str):
    path = OUT / f'{name}.glb'
    path.write_bytes(scene.export(file_type='glb'))
    print(f'{path.relative_to(ROOT)} {path.stat().st_size/1024:.1f} KiB')


def hero():
    s=trimesh.Scene()
    add(s,lobe_sphere((.73,.81,.66),10,.055,MATS['rind'],'body'),'body')
    mask=seed_mesh(.48,.20,.045,MATS['iron'],'face_mask'); rotate(mask,[1,0,0],math.pi/2); translate(mask,[0,-.23,.61]); add(s,mask,'face_mask')
    for side in [-1,1]:
        eye=ellipsoid((.09,.035,.025),MATS['eye'],f'eye_{"L" if side<0 else "R"}',2); translate(eye,[side*.23,.22,.655]); add(s,eye,f'eye_{"L" if side<0 else "R"}')
    shoulder=seed_mesh(.44,.20,.09,MATS['bone'],'shoulder_plate'); rotate(shoulder,[0,0,1],-.18); translate(shoulder,[0,-.17,.01]); add(s,shoulder,'shoulder_plate')
    add(s,tapered_segment([0,0,0],[0,-.32,0],.105,.08,MATS['bark'],'upper_arm'),'upper_arm')
    add(s,tapered_segment([0,0,0],[0,-.30,.045],.09,.065,MATS['bark'],'forearm'),'forearm')
    hand=ellipsoid((.11,.11,.10),MATS['bark_light'],'hand',2); translate(hand,[0,-.03,.03]); add(s,hand,'hand')
    add(s,tapered_segment([0,0,0],[0,-.30,0],.13,.105,MATS['bark'],'thigh'),'thigh')
    add(s,tapered_segment([0,0,0],[0,-.25,.02],.11,.075,MATS['bark'],'shin'),'shin')
    foot=ellipsoid((.18,.095,.30),MATS['bark_light'],'foot',2); translate(foot,[0,-.03,.13]); add(s,foot,'foot')
    shield=seed_mesh(.76,.31,.11,MATS['chitin'],'shield'); rotate(shield,[1,0,0],math.pi/2); translate(shield,[-.08,-.48,.04]); add(s,shield,'shield')
    blade=seed_mesh(1.18,.14,.045,MATS['steel'],'sword_blade'); translate(blade,[0,.14,0]); add(s,blade,'sword_blade')
    add(s,cylinder(.052,.38,MATS['bark'],'sword_grip',[0,-.12,0]),'sword_grip')
    guard=box([.42,.055,.095],MATS['bronze'],'sword_guard',[0,.08,0]); add(s,guard,'sword_guard')
    stem=tapered_segment([0,0,0],[.12,.33,.02],.065,.03,MATS['bark'],'stem'); add(s,stem,'stem')
    sprout=leaf_mesh(.52,.16,.12,MATS['leaf'],'sprout'); translate(sprout,[.02,.18,0]); add(s,sprout,'sprout')
    add(s,cape_mesh(),'cape')
    export(s,'hero_arbuzilla')


def resident_model(kind: str):
    s=trimesh.Scene()
    specs={
        'cactus': ((.39,.88,.36),10,.06,MATS['cactus']),
        'pumpkin': ((.67,.61,.59),10,.12,MATS['pumpkin']),
        'mushroom': ((.25,.61,.25),8,.02,MATS['mushroom_gill']),
        'carrot': ((.35,.82,.33),8,.025,MATS['carrot']),
        'eggplant': ((.49,.80,.43),8,.025,MATS['aubergine']),
    }
    scale_xyz,lobes,depth,material=specs[kind]
    body=lobe_sphere(scale_xyz,lobes,depth,material,'body',count=(24,18),taper=(-.45 if kind=='carrot' else .20 if kind=='eggplant' else 0),bend=.12 if kind=='eggplant' else 0)
    body.apply_translation([0,.30 if kind!='pumpkin' else .18,0]);add(s,body,'body')
    eye_y={'cactus':.66,'pumpkin':.32,'mushroom':.55,'carrot':.55,'eggplant':.55}[kind]
    eye_z=scale_xyz[2]*.92
    for side in [-1,1]:
        eye=ellipsoid((.075,.036,.028),MATS['eye'],f'eye_{side}',1);translate(eye,[side*.17,eye_y,eye_z]);add(s,eye,'eye_L' if side<0 else 'eye_R')
    arm=tapered_segment([0,0,0],[.10,-.30,.10],.07,.045,MATS['bark'],'arm');add(s,arm,'arm')
    leg=trimesh.util.concatenate([
        tapered_segment([0,0,0],[0,-.50,0],.10,.065,MATS['bark'],'leg'),
        translate(ellipsoid((.14,.075,.23),MATS['bark_light'],'shoe',1),[0,-.54,.10])
    ]); apply(leg,MATS['bark'],'leg'); add(s,leg,'leg')
    if kind=='cactus':
        for i in range(16):
            a=i/16*math.tau;y=.05+(i%5)*.22;r=.34*math.sqrt(max(.1,1-((y-.35)/.88)**2))
            needle=segment([math.cos(a)*r,y,math.sin(a)*r],[math.cos(a)*(r+.09),y+.025,math.sin(a)*(r+.09)],.006,MATS['bone'],f'needle{i}',6);add(s,needle,f'needle_{i}')
        for i in range(7):
            petal=leaf_mesh(.24,.065,.04,mat('petal','#e7a58e',.9,0,None,True),f'petal{i}');rotate(petal,[0,1,0],i/7*math.tau);translate(petal,[0,1.12,0]);add(s,petal,f'petal_{i}')
    elif kind=='pumpkin':
        stem=tapered_segment([0,.72,0],[.18,1.02,.02],.09,.035,MATS['bark'],'stem');add(s,stem,'stem')
        collar=trimesh.creation.annulus(r_min=.43,r_max=.54,height=.10,sections=32);translate(collar,[0,.64,0]);apply(collar,MATS['cloth_pale'],'collar');add(s,collar,'collar')
        pack=box([.68,.64,.22],MATS['cloth_pale'],'pack',[0,.25,-.54]);add(s,pack,'pack')
    elif kind=='mushroom':
        cap=lobe_sphere((.83,.28,.83),12,.04,MATS['mushroom'],'cap',count=(30,14));cap.vertices[:,1]=np.abs(cap.vertices[:,1]);translate(cap,[0,.98,0]);add(s,cap,'cap')
        gills=trimesh.creation.annulus(r_min=.18,r_max=.72,height=.04,sections=48);translate(gills,[0,.94,0]);apply(gills,MATS['mushroom_gill'],'gills');add(s,gills,'gills')
    elif kind=='carrot':
        for i in range(9):
            leaf=leaf_mesh(.55+(i%3)*.08,.07,.15,MATS['leaf'],f'top{i}');rotate(leaf,[0,1,0],i*2.4);rotate(leaf,[0,0,1],(i%3-1)*.4);translate(leaf,[0,1.02,0]);add(s,leaf,f'top_{i}')
        mantle=seed_mesh(.78,.36,.055,MATS['cloth'],'mantle');rotate(mantle,[1,0,0],math.pi/2);translate(mantle,[0,-.25,-.30]);add(s,mantle,'mantle')
    else:
        for i in range(6):
            leaf=leaf_mesh(.40,.14,.08,MATS['leaf_dark'],f'calyx{i}');rotate(leaf,[0,1,0],i/6*math.tau);rotate(leaf,[1,0,0],2.05);translate(leaf,[0,1.02,0]);add(s,leaf,f'calyx_{i}')
        stem=tapered_segment([0,.94,0],[.20,1.22,0],.07,.025,MATS['bark'],'stem');add(s,stem,'stem')
        satchel=box([.48,.38,.20],MATS['cloth_pale'],'satchel',[-.40,.20,.32]);add(s,satchel,'satchel')
    export(s,f'resident_{kind}')


def enemy_models():
    s=trimesh.Scene()
    body=lobe_sphere((.58,.40,.76),8,.07,MATS['chitin'],'body',count=(24,16));translate(body,[0,.05,-.10]);add(s,body,'body')
    head=ellipsoid((.29,.24,.30),MATS['iron'],'head',2);translate(head,[0,.08,.65]);add(s,head,'head')
    shell=seed_mesh(.92,.35,.10,MATS['chitin'],'shell');rotate(shell,[1,0,0],math.pi/2);translate(shell,[0,.25,-.42]);add(s,shell,'shell')
    leg=tapered_segment([0,0,0],[.42,-.42,.18],.055,.018,MATS['iron'],'leg',sections=8);add(s,leg,'leg')
    export(s,'enemy_insect')

    s=trimesh.Scene()
    body=ellipsoid((.40,.36,.70),MATS['fur'],'body',2);translate(body,[0,.02,-.06]);add(s,body,'body')
    head=ellipsoid((.30,.28,.33),MATS['fur'],'head',2);translate(head,[0,.18,.60]);add(s,head,'head')
    muzzle=ellipsoid((.18,.14,.28),MATS['cloth_pale'],'muzzle',1);translate(muzzle,[0,.08,.84]);add(s,muzzle,'muzzle')
    ear=ellipsoid((.12,.23,.065),MATS['fur'],'ear',1);translate(ear,[0,.35,.49]);add(s,ear,'ear')
    paw=trimesh.util.concatenate([tapered_segment([0,0,0],[0,-.38,.06],.12,.07,MATS['fur'],'paw'),translate(ellipsoid((.11,.06,.18),MATS['bone'],'pawfoot',1),[0,-.42,.14])]);apply(paw,MATS['fur'],'paw');add(s,paw,'paw')
    tail=tapered_segment([0,0,0],[.25,.30,-.82],.055,.015,MATS['cloth_pale'],'tail',sections=10);add(s,tail,'tail')
    export(s,'enemy_quadruped')

    s=trimesh.Scene()
    body=ellipsoid((.32,.42,.58),MATS['feather'],'body',2);add(s,body,'body')
    head=ellipsoid((.23,.26,.25),MATS['feather'],'head',2);translate(head,[0,.25,.42]);add(s,head,'head')
    beak=trimesh.creation.cone(.12,.42,sections=8);rotate(beak,[1,0,0],math.pi/2);translate(beak,[0,.22,.72]);apply(beak,MATS['bone'],'beak');add(s,beak,'beak')
    wing=leaf_mesh(1.05,.30,.13,MATS['feather'],'wing');rotate(wing,[0,0,1],-1.25);add(s,wing,'wing')
    foot=tapered_segment([0,0,0],[0,-.30,.10],.028,.014,MATS['bronze'],'foot',7);add(s,foot,'foot')
    export(s,'enemy_bird')

    s=trimesh.Scene()
    torso=box([.72,.98,.48],MATS['cloth_pale'],'torso',[0,0,0]);add(s,torso,'torso')
    head=ellipsoid((.22,.27,.20),MATS['bone'],'head',2);translate(head,[0,.78,0]);add(s,head,'head')
    helmet=ellipsoid((.27,.16,.25),MATS['iron'],'helmet',1);translate(helmet,[0,.96,0]);add(s,helmet,'helmet')
    armor=box([.62,.55,.18],MATS['iron'],'armor',[0,.15,.26]);add(s,armor,'armor')
    boot=box([.25,.18,.42],MATS['iron'],'boot',[0,-.33,.13]);add(s,boot,'boot')
    gauntlet=ellipsoid((.10,.12,.09),MATS['iron'],'gauntlet',1);add(s,gauntlet,'gauntlet')
    export(s,'enemy_humanoid')


def tree_model():
    s=trimesh.Scene()
    trunk_parts=[]
    trunk_parts.append(tapered_segment([0,0,0],[.18,2.2,.05],.46,.30,MATS['bark'],'trunk0',12))
    trunk_parts.append(tapered_segment([.18,2.2,.05],[-.25,4.7,.08],.31,.12,MATS['bark'],'trunk1',12))
    trunk_parts.append(tapered_segment([-.25,4.7,.08],[-.10,6.5,.12],.14,.035,MATS['bark'],'trunk2',10))
    trunk=trimesh.util.concatenate(trunk_parts);apply(trunk,MATS['bark'],'trunk');add(s,trunk,'trunk')
    branch_specs=[([.0,2.8,0],[-1.7,4.5,.4]),([-.15,3.7,0],[1.8,5.0,-.25]),([-.1,4.8,0],[-1.2,6.1,-.2]),([-.1,5.2,0],[1.0,6.3,.35])]
    for i,(a,b) in enumerate(branch_specs): add(s,tapered_segment(a,b,.16,.025,MATS['bark'],f'branch{i}',9),f'branch_{i}')
    rng=np.random.default_rng(7271)
    for i in range(90):
        angle=i*2.399963;y=1-2*(i+.5)/90;r=math.sqrt(max(0,1-y*y));shell=.55+rng.random()*.45
        centre=np.array([math.cos(angle)*r*2.0*shell,4.9+y*1.45*shell,math.sin(angle)*r*1.8*shell])
        lf=leaf_mesh(.52+rng.random()*.23,.13+rng.random()*.05,.10,MATS['leaf'],'leaf')
        rotate(lf,[0,1,0],angle+rng.random());rotate(lf,[1,0,0],-.5+rng.random());translate(lf,centre);add(s,lf,f'leaf_{i}')
    for i in range(8):
        moss=ellipsoid((.18,.08,.14),MATS['moss'],f'moss{i}',1);translate(moss,[(-.25+i*.07),.45+i*.32,.39]);add(s,moss,f'moss_{i}')
    export(s,'prop_orchard_tree')


def memory_arch_model():
    s=trimesh.Scene()
    for side in [-1,1]:
        for i in range(4):
            block=box([1.05,.84,1.15],MATS['stone'],f'pillar_{side}_{i}',[side*2.0,.44+i*.86,0],([0,1,0],(i%2*.05-.025)));add(s,block,f'pillar_{"L" if side<0 else "R"}_{i}')
        add(s,box([1.5,.28,1.5],MATS['stone_dark'],'base',[side*2,.14,0]),f'base_{side}')
    for i in range(11):
        a=i/10*math.pi
        x=math.cos(a)*2.05;y=3.72+math.sin(a)*2.05
        block=box([.78,.74,1.08],MATS['stone'],f'arch{i}',[x,y,0],([0,0,1],a-math.pi/2));add(s,block,f'arch_{i}')
    seal=trimesh.creation.annulus(r_min=.38,r_max=.49,height=.075,sections=36);rotate(seal,[1,0,0],math.pi/2);translate(seal,[0,5.45,.60]);apply(seal,MATS['bronze'],'seal');add(s,seal,'seal')
    seed=seed_mesh(.62,.19,.045,MATS['eye'],'memory_seed');rotate(seed,[1,0,0],math.pi/2);translate(seed,[0,5.12,.64]);add(s,seed,'memory_seed')
    export(s,'prop_memory_arch')


def trellis_model():
    s=trimesh.Scene()
    add(s,tapered_segment([-1.2,0,0],[-1.1,2.8,0],.13,.08,MATS['bark'],'post'), 'post_L')
    add(s,tapered_segment([1.2,0,0],[1.1,2.8,0],.13,.08,MATS['bark'],'post'), 'post_R')
    for i in range(3): add(s,segment([-1.25,.85+i*.75,0],[1.25,.85+i*.75,0],.065,MATS['bark'],f'bar{i}',8),f'bar_{i}')
    vine=tapered_segment([-.95,0,.12],[.72,2.5,.13],.035,.012,MATS['leaf_dark'],'vine',8);add(s,vine,'vine')
    for i in range(8):
        lf=leaf_mesh(.42,.14,.08,MATS['leaf'],'vine_leaf');rotate(lf,[0,0,1],(-1 if i%2 else 1)*.8);translate(lf,[-.72+i*.2,.45+i*.25,.15]);add(s,lf,f'leaf_{i}')
    export(s,'prop_trellis')


def rocks_model():
    s=trimesh.Scene();rng=np.random.default_rng(112)
    for i in range(7):
        mesh=ellipsoid((.42+rng.random()*.72,.30+rng.random()*.45,.40+rng.random()*.70),MATS['stone'],'rock',1)
        rotate(mesh,[1,0,0],rng.random());rotate(mesh,[0,1,0],rng.random()*math.tau)
        translate(mesh,[(rng.random()-.5)*2.1,.25+i*.05,(rng.random()-.5)*1.6]);add(s,mesh,f'rock_{i}')
    for i in range(5):
        moss=ellipsoid((.18+rng.random()*.18,.05,.15+rng.random()*.16),MATS['moss'],'moss',1);translate(moss,[(rng.random()-.5)*1.4,.62,(rng.random()-.5)*1.1]);add(s,moss,f'moss_{i}')
    export(s,'prop_rock_cluster')


def shrine_model():
    s=trimesh.Scene()
    add(s,box([2.8,.28,1.5],MATS['stone_dark'],'base',[0,.14,0]),'base')
    for side in [-1,1]: add(s,tapered_segment([side*1.05,.22,-.45],[side*.62,1.75,-.35],.08,.045,MATS['iron'],'frame',8),f'frame_{side}')
    altar=box([.82,.62,.72],MATS['stone'],'altar',[0,.58,0]);add(s,altar,'altar')
    seed=seed_mesh(.72,.20,.07,MATS['bronze'],'seed');translate(seed,[0,.95,.38]);add(s,seed,'seed')
    ringmesh=trimesh.creation.annulus(r_min=.38,r_max=.44,height=.05,sections=32);rotate(ringmesh,[1,0,0],math.pi/2);translate(ringmesh,[0,1.45,0]);apply(ringmesh,MATS['eye'],'halo');add(s,ringmesh,'halo')
    export(s,'prop_seed_shrine')


def fallen_log_model():
    s=trimesh.Scene()
    log=tapered_segment([-1.3,.35,0],[1.35,.42,.15],.34,.25,MATS['bark'],'log',12);add(s,log,'log')
    for i in range(6):
        stump=tapered_segment([-.9+i*.34,.42,.02],[-1.0+i*.38,.9,(i%2-.5)*.3],.07,.012,MATS['bark'],'branch',8);add(s,stump,f'branch_{i}')
    for i in range(9):
        moss=ellipsoid((.18,.05,.13),MATS['moss'],'moss',1);translate(moss,[-1.0+i*.24,.68,.05+math.sin(i)*.15]);add(s,moss,f'moss_{i}')
    export(s,'prop_fallen_log')


if __name__ == '__main__':
    hero()
    for name in ['cactus','pumpkin','mushroom','carrot','eggplant']:
        resident_model(name)
    enemy_models()
    tree_model()
    memory_arch_model()
    trellis_model()
    rocks_model()
    shrine_model()
    fallen_log_model()
