# A character's rig in Blender: its parts as meshes on a 2D skeleton, the walk keyed from the pipeline's gait with the
# coat and the arms following through, rendered as the frames the sprite build assembles.
#
# Run by `npm run asset -- rig <recipe>`, which prepares <recipe dir>/rig/ (rig.json and each set's parts):
#   blender -b --factory-startup --python tools/blender/rig.py -- <rig dir> <frames dir> [--render-only]
#
# One skeleton carries every set of parts (an outfit seen from one side), so the walk is animated once for all of them.
# The skeleton faces right; a set seen from the left is drawn mirrored to face right and its frames mirrored back.
# The .blend saved in the rig dir is the file to open to change the walk by hand; --render-only renders it as it is,
# without building it again. Frame 0 is the stance, frames 1 to N one cycle of the walk.

import bpy
import json
import math
import os
import sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
RIG_DIR, OUT_DIR = argv[0], argv[1]
RENDER_ONLY = '--render-only' in argv
R = json.load(open(os.path.join(RIG_DIR, 'rig.json')))
BLEND = os.path.join(RIG_DIR, R.get('blend', 'rig.blend'))

PX = 0.01                 # Blender units per part pixel
CANVAS = (1600, 2000)     # the frame, in part pixels, with the hip at HIP
HIP = (800, 900)
PERCENT = R.get('percent', 50)

# the pieces, back to front: name, part, parent piece, the parent's joint it hangs from, its own pivot joint, far side
RIG = [
    ('armFarUpper', 'upperArm', 'torso', 'shoulder', 'shoulder', True), ('armFarLower', 'forearm', 'armFarUpper', 'elbow', 'elbow', True),
    ('coat', 'coat', 'torso', 'hip', 'waist', False),
    ('legFarUpper', 'thigh', 'torso', 'hip', 'hip', True), ('legFarLower', 'shin', 'legFarUpper', 'knee', 'knee', True), ('footFar', 'foot', 'legFarLower', 'ankle', 'ankle', True),
    ('legUpper', 'thigh', 'torso', 'hip', 'hip', False), ('legLower', 'shin', 'legUpper', 'knee', 'knee', False), ('foot', 'foot', 'legLower', 'ankle', 'ankle', False),
    ('torso', 'torso', None, None, 'hip', False), ('head', 'head', 'torso', 'neck', 'neck', False),
    ('armUpper', 'upperArm', 'torso', 'shoulder', 'shoulder', False), ('armLower', 'forearm', 'armUpper', 'elbow', 'elbow', False),
]
BY = {r[0]: r for r in RIG}
FAR_DARK = 0.62           # the far arm and leg, in the shadow of her body
COAT_CHAIN = 3


def to3(p, depth=0.0):
    """A point in part pixels (y down, the hip at 0, 0) as a Blender point in the XZ plane, the camera looking along +Y."""
    return Vector((p[0] * PX, depth, -p[1] * PX))


def smooth(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a))) if b != a else float(x >= b)
    return t * t * (3 - 2 * t)


def layout(parts, far):
    """Where each piece's pivot is with every angle at 0: hung from its parent's joint, the far limbs a little behind."""
    pos = {}

    def place(name):
        if name in pos:
            return pos[name]
        _, part, parent, attach, pivot, is_far = BY[name]
        if parent is None:
            pos[name] = (0.0, 0.0)
        else:
            pp = parts[BY[parent][1]]
            px, py = place(parent)
            j, pv = pp['joints'][attach], pp['joints'][BY[parent][4]]
            at = (px + j[0] - pv[0], py + j[1] - pv[1])
            if is_far and parent == 'torso':
                at = (at[0] + far[0], at[1] + far[1])
            pos[name] = at
        return pos[name]

    for name, part, *_ in RIG:
        if part in parts:
            place(name)
    return pos


def world(parts, pos, name, joint):
    """A joint of a piece, in part pixels, with the piece at rest."""
    _, part, _, _, pivot, _ = BY[name]
    p, j, pv = pos[name], parts[part]['joints'][joint], parts[part]['joints'][pivot]
    return (p[0] + j[0] - pv[0], p[1] + j[1] - pv[1])


def coat_bones(parts, pos):
    """The coat's two chains, front and back, from the waist to the hem: their joints, in part pixels."""
    c = parts['coat']
    w, h = c['size']
    waist = pos['coat']
    top_y, hem_y = waist[1], waist[1] + (h - c['joints']['waist'][1])
    chains = {}
    for side, dx in (('F', 0.22 * w), ('B', -0.22 * w)):
        pts = [(waist[0] + dx * (k / COAT_CHAIN) ** 0.5, top_y + (hem_y - top_y) * k / COAT_CHAIN) for k in range(COAT_CHAIN + 1)]
        chains[side] = pts
    return chains


def build_armature(parts, pos):
    """The skeleton, from one set's parts at rest. Legs and the coat hang from the hips, not the torso, so a lean of the
    torso leaves them where they are; the head and arms ride on the torso."""
    arm_data = bpy.data.armatures.new('rig')
    arm = bpy.data.objects.new('rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = to3(head), to3(tail)
        if (b.tail - b.head).length < 1e-4:
            b.tail = b.head + Vector((0, 0, -0.1))
        b.align_roll(Vector((0, -1, 0)))
        if parent:
            b.parent = eb[parent]
            b.use_connect = False
        return b

    bone('hips', (0, 0), (0, -40))
    tail = {
        'torso': lambda: world(parts, pos, 'torso', 'neck'),
        'head': lambda: (pos['head'][0], pos['head'][1] - parts['head']['joints']['neck'][1]),
        'legUpper': lambda: world(parts, pos, 'legUpper', 'knee'), 'legFarUpper': lambda: world(parts, pos, 'legFarUpper', 'knee'),
        'legLower': lambda: world(parts, pos, 'legLower', 'ankle'), 'legFarLower': lambda: world(parts, pos, 'legFarLower', 'ankle'),
        'foot': lambda: world(parts, pos, 'foot', 'toe'), 'footFar': lambda: world(parts, pos, 'footFar', 'toe'),
        'armUpper': lambda: world(parts, pos, 'armUpper', 'elbow'), 'armFarUpper': lambda: world(parts, pos, 'armFarUpper', 'elbow'),
        'armLower': lambda: (pos['armLower'][0], pos['armLower'][1] + parts['forearm']['size'][1] - parts['forearm']['joints']['elbow'][1]),
        'armFarLower': lambda: (pos['armFarLower'][0], pos['armFarLower'][1] + parts['forearm']['size'][1] - parts['forearm']['joints']['elbow'][1]),
    }
    parent_of = {'torso': 'hips', 'head': 'torso', 'armUpper': 'torso', 'armFarUpper': 'torso', 'armLower': 'armUpper', 'armFarLower': 'armFarUpper',
                 'legUpper': 'hips', 'legFarUpper': 'hips', 'legLower': 'legUpper', 'legFarLower': 'legFarUpper', 'foot': 'legLower', 'footFar': 'legFarLower'}
    for name in ['torso', 'head', 'armUpper', 'armLower', 'armFarUpper', 'armFarLower', 'legUpper', 'legLower', 'foot', 'legFarUpper', 'legFarLower', 'footFar']:
        if BY[name][1] in parts:
            bone(name, pos[name], tail[name](), parent_of[name])
    for side, pts in coat_bones(parts, pos).items():
        prev = 'hips'
        for k in range(COAT_CHAIN):
            prev = bone(f'coat{side}{k + 1}', pts[k], pts[k + 1], prev).name
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def weights(name, part, x, y):
    """How a vertex of a piece (in the piece's own pixels) follows the bones: rigid in the middle of a limb, blending into
    the next bone across a joint, so knees, elbows and ankles bend instead of breaking."""
    j, (w, h) = part['joints'], part['size']
    far = 'Far' if 'Far' in name else ''
    up, low, foot = f'leg{far}Upper', f'leg{far}Lower', f'foot{far}'
    aup, alow = f'arm{far}Upper', f'arm{far}Lower'
    if name in ('legUpper', 'legFarUpper'):
        k, band = j['knee'][1], 0.1 * h
        s = smooth(k - band, k + 0.5 * band, y)
        return {up: 1 - s, low: s}
    if name in ('legLower', 'legFarLower'):
        k, a, band = j['knee'][1], j['ankle'][1], 0.08 * h
        s = smooth(k - 0.5 * band, k + band, y)
        t = smooth(a - band, a + 0.4 * band, y)
        return {up: 1 - s, low: s * (1 - t), foot: s * t}
    if name in ('foot', 'footFar'):
        a, lap = j['ankle'][1], max(4.0, 0.25 * h)
        s = smooth(a - lap, a + 0.2 * lap, y)
        return {low: 1 - s, foot: s}
    if name in ('armUpper', 'armFarUpper'):
        e, band = j['elbow'][1], 0.12 * h
        s = smooth(e - band, e + 0.5 * band, y)
        return {aup: 1 - s, alow: s}
    if name in ('armLower', 'armFarLower'):
        e, band = j['elbow'][1], 0.12 * h
        s = smooth(e - 0.5 * band, e + band, y)
        return {aup: 1 - s, alow: s}
    if name == 'coat':
        top = j['waist'][1]
        t = (y - top) / max(1.0, h - top)
        cx = j['waist'][0]
        f = smooth(cx - 0.12 * w, cx + 0.12 * w, x)
        pin = 1 - smooth(0.0, 0.1, t)
        w1 = 1 - smooth(0.2, 0.45, t)
        w3 = smooth(0.55, 0.8, t)
        w2 = max(0.0, 1 - w1 - w3)
        out = {'hips': pin}
        for k, wk in ((1, w1), (2, w2), (3, w3)):
            out[f'coatF{k}'] = (1 - pin) * wk * f
            out[f'coatB{k}'] = (1 - pin) * wk * (1 - f)
        return out
    return {name: 1.0}


def material(name, image_path, dark):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(image_path, check_existing=True)
    tex.interpolation = 'Linear'
    tex.extension = 'CLIP'
    mul = nt.nodes.new('ShaderNodeMix')
    mul.data_type = 'RGBA'
    mul.blend_type = 'MULTIPLY'
    mul.inputs['Factor'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], mul.inputs['A'])
    mul.inputs['B'].default_value = (dark, dark, dark, 1.0)
    em = nt.nodes.new('ShaderNodeEmission')
    nt.links.new(mul.outputs['Result'], em.inputs['Color'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(tex.outputs['Alpha'], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def build_set(s, arm, far):
    """One set's parts as meshes on the skeleton, in their own collection, drawn back to front."""
    parts, name = s['parts'], s['name']
    pos = layout(parts, far)
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    order = [r[0] for r in RIG if r[1] in parts]
    if s.get('coatFront'):
        order.remove('coat')
        order.insert(order.index('foot') + 1, 'coat')
    for i, piece in enumerate(order):
        part = parts[BY[piece][1]]
        w, h = part['size']
        pv = part['joints'][BY[piece][4]]
        x0, y0 = pos[piece][0] - pv[0], pos[piece][1] - pv[1]
        cols, rows = max(2, round(w / 40)), max(2, round(h / 40))
        verts, faces, uvs = [], [], []
        for r in range(rows + 1):
            for c in range(cols + 1):
                verts.append(to3((x0 + w * c / cols, y0 + h * r / rows), -i * 0.002))
        for r in range(rows):
            for c in range(cols):
                a = r * (cols + 1) + c
                faces.append((a, a + cols + 1, a + cols + 2, a + 1))
        me = bpy.data.meshes.new(f'{name}.{piece}')
        me.from_pydata([tuple(v) for v in verts], [], faces)
        uv = me.uv_layers.new(name='uv')
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                r, c = divmod(vi, cols + 1)
                uv.data[li].uv = (c / cols, 1 - r / rows)
        ob = bpy.data.objects.new(f'{name}.{piece}', me)
        col.objects.link(ob)
        groups = {}
        for vi in range(len(verts)):
            r, c = divmod(vi, cols + 1)
            for bone_name, wt in weights(piece, part, w * c / cols, h * r / rows).items():
                if wt <= 1e-4:
                    continue
                if bone_name not in groups:
                    groups[bone_name] = ob.vertex_groups.new(name=bone_name)
                groups[bone_name].add([vi], wt, 'REPLACE')
        mod = ob.modifiers.new('rig', 'ARMATURE')
        mod.object = arm
        ob.parent = arm
        me.materials.append(material(f'{name}.{piece}', os.path.join(RIG_DIR, name, f'{BY[piece][1]}.png'), FAR_DARK if BY[piece][5] else 1.0))
    return col


def spring_chain(target, n, omega, zeta, cycles=6, sub=64):
    """A chain of springs, each following the one before it, driven by a looping target: the coat's sway and drag.
    Returns each link's angle at the cycle's samples, once the motion has settled into a loop."""
    N = len(target)
    links = [[0.0, 0.0] for _ in range(n)]
    dt = 1.0 / (N * sub)
    out = [[0.0] * N for _ in range(n)]
    for cyc in range(cycles):
        for k in range(N):
            for s in range(sub):
                u = (k + s / sub)
                a, b = target[int(u) % N], target[(int(u) + 1) % N]
                goal = a + (b - a) * (u - int(u))
                for i in range(n):
                    x, v = links[i]
                    acc = omega * omega * (goal - x) - 2 * zeta * omega * v
                    v += acc * dt
                    x += v * dt
                    links[i] = [x, v]
                    goal = x
            if cyc == cycles - 1:
                for i in range(n):
                    out[i][k] = links[i][0]
    return out


def animate(arm):
    """The stance at frame 0 and one cycle of the walk at frames 1 to N, with follow-through the gait leaves out."""
    walk, idle = R['walk']['frames'], R['idle']
    N = len(walk)
    deg = math.radians
    # the coat: its front pushed forward by whichever leg leads, its back dragged by the trailing one, each a chain of
    # springs so the hem lags behind the hips
    lead = [max(f['thighAbs'], f['thighAbsFar'], 0.0) for f in walk]
    trail = [min(f['thighAbs'], f['thighAbsFar'], 0.0) for f in walk]
    front = spring_chain([0.55 * a + 1.5 for a in lead], COAT_CHAIN, omega=2 * math.pi * 2.4, zeta=0.5)
    back = spring_chain([0.5 * a - 2.0 for a in trail], COAT_CHAIN, omega=2 * math.pi * 2.0, zeta=0.45)
    # the forearms trail the upper arms a little
    lag = max(1, round(N * 0.07))

    def key(frame, angles):
        for name, a in angles.items():
            pb = arm.pose.bones.get(name)
            if pb is None:
                continue
            pb.rotation_euler = (0.0, 0.0, deg(a))
            pb.keyframe_insert('rotation_euler', frame=frame)

    rest = {pb.name: 0.0 for pb in arm.pose.bones}
    key(0, {**rest, **{k: v for k, v in idle.items() if k in rest}})
    for k, f in enumerate(walk):
        p = k / N
        pitch = 0.7 * math.sin(4 * math.pi * (p - 0.1))
        a = {n: f[n] for n in ('legUpper', 'legLower', 'foot', 'legFarUpper', 'legFarLower', 'footFar', 'armUpper', 'armFarUpper')}
        a['torso'] = f['torso'] + pitch
        a['head'] = f['head'] - pitch
        for up, low in (('armUpper', 'armLower'), ('armFarUpper', 'armFarLower')):
            a[low] = f[low] + (walk[(k - lag) % N][up] - f[up])
        for i in range(COAT_CHAIN):
            a[f'coatF{i + 1}'] = front[i][k] - (front[i - 1][k] if i else 0.0)
            a[f'coatB{i + 1}'] = back[i][k] - (back[i - 1][k] if i else 0.0)
        key(k + 1, {**rest, **a})
    for fc in arm.animation_data.action.fcurves if arm.animation_data and arm.animation_data.action and hasattr(arm.animation_data.action, 'fcurves') else []:
        for kp in fc.keyframe_points:
            kp.interpolation = 'CONSTANT'
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = 0, N
    scn.timeline_markers.new('stance', frame=0)
    scn.timeline_markers.new('walk', frame=1)


def setup_render():
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scn.cycles.device = 'GPU'
    except Exception:
        scn.cycles.device = 'CPU'
    scn.cycles.samples = 16
    scn.cycles.use_denoising = False
    scn.cycles.pixel_filter_type = 'BOX'
    scn.cycles.filter_width = 1.0
    scn.view_settings.view_transform = 'Standard'
    scn.view_settings.look = 'None'
    scn.render.film_transparent = True
    scn.render.resolution_x, scn.render.resolution_y = CANVAS
    scn.render.resolution_percentage = PERCENT
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    cam = bpy.data.cameras.new('camera')
    cam.type = 'ORTHO'
    cam.ortho_scale = max(CANVAS) * PX
    co = bpy.data.objects.new('camera', cam)
    scn.collection.objects.link(co)
    # the hip lands at HIP in the frame
    cx, cy = CANVAS[0] / 2 - HIP[0], CANVAS[1] / 2 - HIP[1]
    co.location = (cx * PX, -20.0, -cy * PX)
    co.rotation_euler = (math.radians(90), 0, 0)
    scn.camera = co


def render_sets():
    scn = bpy.context.scene
    sets = [c for c in bpy.data.collections if c.name in [s['name'] for s in R['sets']]]
    for col in sets:
        for other in sets:
            other.hide_render = other is not col
        os.makedirs(os.path.join(OUT_DIR, col.name), exist_ok=True)
        for f in range(scn.frame_start, scn.frame_end + 1):
            scn.frame_set(f)
            scn.render.filepath = os.path.join(OUT_DIR, col.name, f'{f:02d}.png')
            bpy.ops.render.render(write_still=True)
        print(f'rendered {col.name}: {scn.frame_end - scn.frame_start + 1} frames', flush=True)


if RENDER_ONLY:
    bpy.ops.wm.open_mainfile(filepath=BLEND)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    first = R['sets'][0]
    arm = build_armature(first['parts'], layout(first['parts'], R['far']))
    for s in R['sets']:
        build_set(s, arm, R['far'])
    animate(arm)
    setup_render()
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)
    try:
        bpy.ops.file.make_paths_relative()
        bpy.ops.wm.save_mainfile()
    except Exception as e:
        print('paths stay absolute:', e)
render_sets()
