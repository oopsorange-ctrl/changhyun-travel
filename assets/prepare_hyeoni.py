"""현이: 창이(school-player-meshy.glb) 모형에 검은 긴 머리(어깨 아래)와 무릎 길이 주름치마(맨다리)를 더해 여학생 모형을 만든다.

Blender --background --python assets/prepare_hyeoni.py
먼저 `assets/prepare_school_meshy.py`로 public/school-player-meshy.glb를 만든 뒤 실행한다.
같은 관절·걷기(Idle/Walk)를 쓰고, 머리카락은 머리 관절에, 치마는 엉덩이 관절에 붙인다(다리에는 조금만 따라 움직임).
숫자(미터)는 창이 모형을 잰 값이다: 키 1.7 m, 머리는 z 1.0~1.7, 허리 z≈.6, 무릎 z≈.27.
"""
import json
import math
from pathlib import Path
import bmesh
import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'public/school-player-meshy.glb'
OUTPUT = ROOT/'public/school-hyeoni.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(SOURCE))
rig = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and o.name == 'SchoolUniform')
# Blender가 관절 표시용으로 만든 구는 내보내지 않는다.
for obj in list(bpy.context.scene.objects):
    if obj.type == 'MESH' and obj is not body:
        bpy.data.objects.remove(obj, do_unlink=True)


# 머리카락과 치마가 늘린 면 수만큼 몸 면을 덜어 내 모바일 예산(25,000)에 맞춘다.
body.data.calc_loop_triangles()
bpy.context.view_layer.objects.active = body
decimate = body.modifiers.new('mobile budget', 'DECIMATE')
decimate.ratio = 19500/len(body.data.loop_triangles)
decimate.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier=decimate.name)


# 색 그림(텍스처) 고치기: 머리카락을 검은색으로, 바지를 없애고 맨다리(살색)로 칠한다. 이 그림은 현이 파일에만 들어간다.
colors = body.data.materials[0].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].links[0].from_node.image
width, height = colors.size
pixels = np.empty(len(colors.pixels), dtype=np.float32)
colors.pixels.foreach_get(pixels)
image = pixels.reshape((height, width, 4))
uv_layer = body.data.uv_layers.active.data
weights_by_vertex = [{body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in body.data.vertices]
r, g, b = image[..., 0].copy(), image[..., 1].copy(), image[..., 2].copy()
lum = .3*r+.59*g+.11*b
brown_hair = (lum < .25) & (r > g*1.25)
for channel in range(3):
    image[..., channel][brown_hair] = lum[brown_hair]*.3+.004
leg_groups = ('playerLegL', 'playerLegR', 'mixamorig:LeftLeg', 'mixamorig:RightLeg', 'playerFootL', 'playerFootR')
body.data.calc_loop_triangles()
skin_samples, leg_triangles = [], []
for triangle in body.data.loop_triangles:
    verts = [body.data.vertices[i] for i in triangle.vertices]
    mean_z = sum(v.co.z for v in verts)/3
    head_weight = min(sum(weights_by_vertex[v.index].get('mixamorig:Head', 0) for v in [vert]) for vert in verts)
    if head_weight > .9 and 1.05 < mean_z < 1.25 and sum(v.co.y for v in verts)/3 < -.25:
        u, w = np.mean([uv_layer[loop].uv for loop in triangle.loops], axis=0)
        skin_samples.append(image[int(w*(height-1)), int(u*(width-1)), :3].copy())
    leg_weight = max(sum(weights_by_vertex[v.index].get(name, 0) for name in leg_groups) for v in verts)
    if leg_weight > .5 and .105 < mean_z < .5:
        leg_triangles.append(triangle)
skin = np.median(np.array(skin_samples), axis=0)
leg_region = np.zeros((height, width), dtype=bool)
for triangle in leg_triangles:
    a, b_uv, c = [np.array(uv_layer[loop].uv)*(width-1, height-1) for loop in triangle.loops]
    low = np.maximum(0, np.floor(np.minimum(np.minimum(a, b_uv), c)).astype(int)-2)
    high = np.minimum((width-1, height-1), np.ceil(np.maximum(np.maximum(a, b_uv), c)).astype(int)+2)
    xx, yy = np.meshgrid(np.arange(low[0], high[0]+1), np.arange(low[1], high[1]+1))
    ab, ac = b_uv-a, c-a
    determinant = ab[0]*ac[1]-ab[1]*ac[0]
    if abs(determinant) < 1e-8:
        continue
    u = ((xx-a[0])*ac[1]-(yy-a[1])*ac[0])/determinant
    v = (ab[0]*(yy-a[1])-ab[1]*(xx-a[0]))/determinant
    leg_region[low[1]:high[1]+1, low[0]:high[0]+1] |= (u >= -.1) & (v >= -.1) & (u+v <= 1.1)
for channel in range(3):
    image[..., channel][leg_region] = skin[channel]
colors.pixels.foreach_set(pixels.reshape(-1) if pixels.base is None else pixels)
colors.update()
colors.pack()
print('LEG_PIXELS', int(leg_region.sum()), 'skin', skin.tolist(), flush=True)


def flat_material(name, color, roughness=.8):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    return material


def smooth(t):
    t = max(0, min(1, t))
    return t*t*(3-2*t)


def lerp(a, b, t):
    return a+(b-a)*t


def profile(table, z):
    """[(z, value)] 표를 위에서 아래로 훑어 z에서의 값을 이어 붙인다."""
    if z >= table[0][0]:
        return table[0][1]
    for (z0, v0), (z1, v1) in zip(table, table[1:]):
        if z1 <= z <= z0:
            return lerp(v1, v0, (z-z1)/(z0-z1))
    return table[-1][1]


def shell(name, rings, material, thickness, weights):
    """rings: 위에서 아래로 내려가는 고리 목록(각 고리는 같은 개수의 (x,y,z) 점). 열린 곡면을 두께 있게 만든다."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    grid = [[bm.verts.new(point) for point in ring] for ring in rings]
    for r in range(len(grid)-1):
        for c in range(len(grid[r])-1):
            bm.faces.new((grid[r][c], grid[r][c+1], grid[r+1][c+1], grid[r+1][c]))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bpy.context.view_layer.objects.active = obj
    if thickness:
        modifier = obj.modifiers.new('thickness', 'SOLIDIFY')
        modifier.thickness = thickness
        modifier.offset = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    for bone in rig.data.bones:
        obj.vertex_groups.new(name=bone.name)
    for vertex in obj.data.vertices:
        for bone_name, weight in weights(vertex.co.x, vertex.co.y, vertex.co.z):
            if weight > 0:
                obj.vertex_groups[bone_name].add([vertex.index], weight, 'REPLACE')
    obj.parent = rig
    armature = obj.modifiers.new('Armature', 'ARMATURE')
    armature.object = rig
    return obj


# ---- 긴 머리: 머리 뒤와 옆을 덮고 어깨 아래(z≈.80)까지 내려온다. 얼굴 앞(정면 약 130도)은 비워 둔다.
HAIR_CENTER = (.04, 0.0)
rx_table = [(1.58, .22), (1.52, .33), (1.45, .405), (1.35, .43), (1.25, .425), (1.15, .39), (1.00, .335), (.90, .285), (.80, .255)]
ry_table = [(1.58, .21), (1.52, .32), (1.45, .39), (1.35, .415), (1.25, .41), (1.15, .38), (1.00, .31), (.90, .25), (.80, .215)]
steps_around, steps_down = 48, 16
front_gap = math.radians(65)  # 정면에서 좌우로 비워 두는 각
hair_rings = []
for i in range(steps_down+1):
    t = i/steps_down
    ring = []
    for j in range(steps_around+1):
        phi = lerp(front_gap, 2*math.pi-front_gap, j/steps_around)  # 0=정면(-Y), 양옆 90도, 뒤 180도
        # 아래 끝이 물결치듯 불규칙하게 (가닥 느낌)
        bottom = .80+.035*math.sin(phi*11)+.02*math.sin(phi*5+1)
        z = lerp(1.58, bottom, t)
        rx, ry = profile(rx_table, z), profile(ry_table, z)
        # 정면에 가까운 쪽(관자놀이·귀 옆)은 얼굴에 붙게 안쪽으로 모은다.
        side = smooth((phi-front_gap)/.6)
        rx *= lerp(.88, 1, side)
        ry *= lerp(.88, 1, side)
        ring.append((HAIR_CENTER[0]+rx*math.sin(phi), HAIR_CENTER[1]-ry*math.cos(phi)*1.0, z))
    hair_rings.append(ring)
hair_material = flat_material('hyeoni hair', (.011, .011, .013), .5)


def hair_weights(x, y, z):
    head = smooth((z-.86)/.18)
    return [('mixamorig:Head', head), ('mixamorig:Spine2', 1-head)]


hair = shell('hyeoni long hair', hair_rings, hair_material, .035, hair_weights)

# ---- 무릎 길이 주름치마: 허리(z≈.60)에서 무릎 바로 위(z≈.30)까지 퍼진다.
skirt_center = (.05, -.045)
skirt_rings = []
rows = 8
for i in range(rows+1):
    t = i/rows
    z = lerp(.60, .30, t)
    flare = smooth(t)
    rx = lerp(.17, .30, flare)
    ry = lerp(.13, .245, flare)
    ring = []
    for j in range(64+1):
        phi = 2*math.pi*j/64
        pleat = 1+.055*flare*math.sin(phi*16)  # 주름
        ring.append((skirt_center[0]+rx*pleat*math.sin(phi), skirt_center[1]-ry*pleat*math.cos(phi), z))
    skirt_rings.append(ring)
skirt_material = flat_material('hyeoni skirt', (.014, .014, .02), .85)


def skirt_weights(x, y, z):
    follow = max(0, min(1, (.46-z)/.18))*.4
    leg = 'playerLegL' if x > skirt_center[0] else 'playerLegR'
    return [(leg, follow), ('playerHips', 1-follow)]


skirt = shell('hyeoni skirt', skirt_rings, skirt_material, 0, skirt_weights)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_skins=True, export_animations=True,
    export_animation_mode='ACTIONS', export_force_sampling=True,
    export_image_format='JPEG', export_jpeg_quality=90)
triangles = sum(len(o.data.loop_triangles) if (o.data.calc_loop_triangles() or True) else 0
                for o in bpy.context.scene.objects if o.type == 'MESH')
print('HYEONI', json.dumps({'bytes': OUTPUT.stat().st_size, 'triangles': triangles,
    'hairTriangles': len(hair.data.polygons)*2, 'skirtTriangles': len(skirt.data.polygons)*2}), flush=True)
