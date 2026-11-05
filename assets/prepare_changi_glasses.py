"""창이: 창이(school-player-meshy.glb) 모형에 검은 뿔테 안경을 씌운다.

Blender --background --python assets/prepare_changi_glasses.py
먼저 `assets/prepare_school_meshy.py`로 public/school-player-meshy.glb를 만든 뒤 실행한다(같은 파일에 안경을 더해 다시 저장).
이미 안경이 있으면 지우고 다시 만들어서 여러 번 실행해도 겹치지 않는다. 현이(prepare_hyeoni.py)는 몸 모형만 쓰므로 안경이 따라가지 않는다.
숫자(미터)는 창이 모형을 잰 값이다: 눈높이 z≈1.15, 두 눈의 가운데 x≈.04, 눈 사이 약 .25 m, 머리 가로 폭 약 ±.33.
"""
import json
import math
from pathlib import Path
import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT/'public/school-player-meshy.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(PATH))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name == 'SchoolUniform')
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH' and obj is not body:
        bpy.data.objects.remove(obj, do_unlink=True)

CENTER_X, EYE_Z, EYE_GAP = .037, 1.15, .122
# 눈 앞 얼굴 면의 y(앞쪽이 -y): 눈 자리 주변 점들 가운데 가장 앞쪽.
points = [body.matrix_world@v.co for v in body.data.vertices]
face_front = min(p.y for p in points if abs(abs(p.x-CENTER_X)-EYE_GAP) < .05 and abs(p.z-EYE_Z) < .05)
print('FACE_FRONT_Y', round(face_front, 3), flush=True)

FRAME_Y = face_front-.035       # 얼굴 면에서 살짝 띄운다
RIM_RADIUS, RIM_TUBE = .098, .0105
EAR_X = .335                    # 관자놀이 쪽 다리 끝(머리 폭)

material = bpy.data.materials.new('changi glasses')
material.use_nodes = True
bsdf = material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (.012, .012, .016, 1)
bsdf.inputs['Roughness'].default_value = .4
bsdf.inputs['Metallic'].default_value = 0

bm = bmesh.new()


def tube(a, b, radius, sides=6):
    """a에서 b까지 이어지는 가는 막대."""
    a, b = Vector(a), Vector(b)
    length = (b-a).length
    result = bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=radius, depth=length)
    verts = result['verts']
    rotation = (b-a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a+b)/2)@rotation, verts=verts)


# 둥근 테 두 개: 앞에서 보면 원, 점 개수를 줄여 가볍게(고리 20 × 단면 6)
for side in (-1, 1):
    cx = CENTER_X+side*EYE_GAP
    ring = [(cx+math.cos(2*math.pi*i/20)*RIM_RADIUS, FRAME_Y, EYE_Z+math.sin(2*math.pi*i/20)*RIM_RADIUS*.92) for i in range(20)]
    for i in range(20):
        tube(ring[i], ring[(i+1) % 20], RIM_TUBE)
    # 다리: 테 바깥쪽 위에서 관자놀이를 따라 귀 쪽으로
    start = (cx+side*RIM_RADIUS, FRAME_Y+.005, EYE_Z+.03)
    mid = (CENTER_X+side*(EAR_X-.03), FRAME_Y+.17, EYE_Z+.035)
    end = (CENTER_X+side*EAR_X, FRAME_Y+.34, EYE_Z+.0)
    tube(start, mid, .008)
    tube(mid, end, .008)
# 코다리(두 테를 잇는 다리)
tube((CENTER_X-EYE_GAP+RIM_RADIUS*.9, FRAME_Y, EYE_Z+.025), (CENTER_X+EYE_GAP-RIM_RADIUS*.9, FRAME_Y, EYE_Z+.025), .009)

mesh = bpy.data.meshes.new('changi glasses')
bm.to_mesh(mesh)
bm.free()
glasses = bpy.data.objects.new('changi glasses', mesh)
bpy.context.collection.objects.link(glasses)
glasses.data.materials.append(material)
for polygon in glasses.data.polygons:
    polygon.use_smooth = True
for bone in rig.data.bones:
    glasses.vertex_groups.new(name=bone.name)
glasses.vertex_groups['mixamorig:Head'].add(list(range(len(glasses.data.vertices))), 1.0, 'REPLACE')
glasses.parent = rig
armature = glasses.modifiers.new('Armature', 'ARMATURE')
armature.object = rig

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(PATH), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_skins=True, export_animations=True,
    export_animation_mode='ACTIONS', export_force_sampling=True,
    export_image_format='JPEG', export_jpeg_quality=90)
body.data.calc_loop_triangles()
glasses.data.calc_loop_triangles()
print('CHANGI_GLASSES', json.dumps({'bytes': PATH.stat().st_size, 'glassesTriangles': len(glasses.data.loop_triangles),
    'bodyTriangles': len(body.data.loop_triangles), 'faceFrontY': round(face_front, 3)}), flush=True)
