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
from mathutils import Matrix, Vector

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
decimate.ratio = 18600/len(body.data.loop_triangles)
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
# 창이의 원래 머리카락 부분(머리색 그림 자리에 있는 꼭짓점)을 찾아 둔다. 뒤에서 안쪽으로 줄여 머리카락이 덜 부풀어 보이게 한다.
hair_votes = np.zeros(len(body.data.vertices)); loop_counts = np.zeros(len(body.data.vertices))
for loop in body.data.loops:
    texel_u, texel_v = uv_layer[loop.index].uv
    hair_votes[loop.vertex_index] += brown_hair[int(min(max(texel_v, 0), 1)*(height-1)), int(min(max(texel_u, 0), 1)*(width-1))]
    loop_counts[loop.vertex_index] += 1
original_hair_vertex = hair_votes/np.maximum(loop_counts, 1) > .6
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


# ---- 긴 생머리: 가운데 가르마, 정수리는 머리 모양을 따라 살짝 갸름하게 덮고, 머리결이 위에서 아래로 곧게 흘러 어깨 아래(z≈.74)에서 끝난다.
# 앞머리(뱅)는 이마를 덮고, 얼굴 양옆으로 머리카락이 내려온다. 얼굴(눈·볼·코)은 가리지 않는다.
# 창이의 삐죽한 앞머리가 비치지 않게 윗머리를 완전히 덮는다(앞머리 끝 z≈1.235).
HAIR_CENTER = (.015, 0.0)
rx_table = [(1.712, .04), (1.695, .11), (1.665, .20), (1.62, .29), (1.56, .345), (1.50, .385), (1.44, .40), (1.35, .40), (1.25, .395), (1.17, .36), (1.08, .315), (.98, .29), (.86, .275), (.74, .26)]
ry_table = [(1.712, .04), (1.695, .11), (1.665, .20), (1.62, .285), (1.56, .325), (1.50, .365), (1.44, .385), (1.35, .39), (1.25, .385), (1.17, .35), (1.08, .31), (.98, .28), (.86, .26), (.74, .24)]
steps_around, steps_down = 64, 18
RIDGES = 46  # 머리결이 되는 골의 수
hair_rings = []
hair_levels = []
for i in range(steps_down+1):
    t = i/steps_down
    ring = []
    for j in range(steps_around+1):
        phi = 2*math.pi*j/steps_around  # 0=정면(-Y), 양옆 90도, 뒤 180도
        d = min(phi, 2*math.pi-phi)  # 정면에서 벌어진 각
        # 끝이 곧게 이어지되 가닥마다 길이가 조금씩 달라 자연스럽게 떨어진다
        long_bottom = .74+.03*math.sin(phi*9+.6)+.018*math.sin(phi*23+2.1)
        bang_bottom = 1.205+.05*smooth(1-d/math.radians(26))
        bottom = lerp(bang_bottom, long_bottom, smooth((d-math.radians(33))/math.radians(14)))
        z = lerp(1.712, bottom, t)
        rx, ry = profile(rx_table, z), profile(ry_table, z)
        # 얼굴 옆 머리카락은 목·어깨 앞을 지나므로 아래로 갈수록 몸 쪽으로 모은다
        front_pull = (1-smooth((d-math.radians(40))/math.radians(70)))*smooth((1.2-z)/.25)
        rx *= 1-.2*front_pull
        ry *= 1-.12*front_pull
        # 머리결: 가르마(정면 위)에서 갈라져 아래로 흐르는 얕은 골. 정수리에서는 옅고 아래로 갈수록 뚜렷하다
        strand = 1+(.008+.03*smooth((1.45-z)/.45))*(.6*math.sin(phi*RIDGES)+.4*math.sin(phi*17+1))
        rx *= strand
        ry *= strand
        ring.append((HAIR_CENTER[0]+rx*math.sin(phi), HAIR_CENTER[1]-ry*math.cos(phi), z))
    hair_rings.append(ring)
# 은은한 갈색이 도는 검정과 부드러운 윤기. 너무 새까맣게 뭉치지 않게 한다.
hair_material = flat_material('hyeoni hair', (.045, .034, .032), .38)


def hair_weights(x, y, z):
    head = smooth((z-.86)/.18)
    return [('mixamorig:Head', head), ('mixamorig:Spine2', 1-head)]


hair = shell('hyeoni long hair', hair_rings, hair_material, .03, hair_weights)

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

# ---- 머리 크기: 얼굴과 머리카락을 목(z≈1.0)을 중심으로 줄여 머리통이 작아 보이게 한다.
# 몸 모형의 머리 부분과 머리카락을 같은 식으로 줄이므로 앞머리가 얼굴을 덮는 관계는 그대로다. 목 아래(z<.95)는 그대로 두고 z .95~1.07에서 서서히 줄인다.
HEAD_SCALE = Vector((.9, .9, .9))
HEAD_PIVOT = Vector((.04, -.03, 1.0))
# 창이의 원래 머리카락(z 1.15 위)을 머리 가운데 쪽으로 12% 줄인다. 얼굴 부분은 그대로라 눈·코·입은 변하지 않는다.
for vertex in body.data.vertices:
    if original_hair_vertex[vertex.index] and vertex.co.z > 1.15:
        pull = 1-.12*smooth((vertex.co.z-1.15)/.1)
        vertex.co.x = .02+(vertex.co.x-.02)*pull
        vertex.co.y = -.01+(vertex.co.y+.01)*pull
for target in (body, hair):
    for vertex in target.data.vertices:
        w = smooth((vertex.co.z-.95)/.12)
        offset = vertex.co-HEAD_PIVOT
        vertex.co = HEAD_PIVOT+Vector((offset.x*(1-(1-HEAD_SCALE.x)*w), offset.y*(1-(1-HEAD_SCALE.y)*w), offset.z*(1-(1-HEAD_SCALE.z)*w)))
    target.data.update()

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format='GLB', use_selection=True,
    export_yup=True, export_apply=False, export_skins=True, export_animations=True,
    export_animation_mode='ACTIONS', export_force_sampling=True,
    export_image_format='JPEG', export_jpeg_quality=90)
triangles = sum(len(o.data.loop_triangles) if (o.data.calc_loop_triangles() or True) else 0
                for o in bpy.context.scene.objects if o.type == 'MESH')
print('HYEONI', json.dumps({'bytes': OUTPUT.stat().st_size, 'triangles': triangles,
    'hairTriangles': len(hair.data.polygons)*2, 'skirtTriangles': len(skirt.data.polygons)*2}), flush=True)
