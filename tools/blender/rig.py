# A character's rig in Blender: its parts as meshes on a 2D skeleton, the walk keyed from the pipeline's gait with the
# coat and the arms following through, rendered as the frames the sprite build assembles.
#
# Run by `npm run asset -- rig <recipe>`, which prepares <recipe dir>/rig/ (rig.json and each set's parts):
#   blender -b --factory-startup --python tools/blender/rig.py -- <rig dir> <frames dir> [--render-only]
#
# One skeleton carries every set of parts (an outfit seen from one side), so the walk is animated once for all of them.
# The skeleton faces right; a set seen from the left is drawn mirrored to face right and its frames mirrored back.
# The .blend saved in the rig dir is the file to open to change the walk by hand; --render-only renders it as it is,
# without building it again. Frames 0 to M - 1 are the idle loop, a breath standing; then one cycle of the walk, and
# one of the jog and of the run where the rig has them (markers "idle", "walk", "jog" and "run").

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
    # the head tucks its neck under the collar: drawn behind the torso, the ponytail behind the head
    ('ponytail', 'ponytail', 'head', 'tie', 'root', False), ('head', 'head', 'torso', 'neck', 'neck', False),
    ('torso', 'torso', None, None, 'hip', False),
    ('armUpper', 'upperArm', 'torso', 'shoulder', 'shoulder', False), ('armLower', 'forearm', 'armUpper', 'elbow', 'elbow', False),
]
BY = {r[0]: r for r in RIG}
FAR_DARK = 0.62           # the far arm and leg, in the shadow of her body
COAT_CHAIN = 3
PONY_CHAIN = 3
PONY_TRAIL = -6.0         # degrees: walking, the ponytail trails out behind her
PONY_GAIN = 7.0           # degrees: how far each step's bounce swings it
# each gait: how much the torso pitches with each step, how far the coat flies out, how far the ponytail trails and
# swings, how far the forearms trail the upper arms (a jog holds the arms firm, a run pumps them), and how much of the
# spring's lag behind her step the chest shows, on a spring of how many bounces a cycle
GAITS = {
    'walk': {'pitch': 0.7, 'coat': 1.0, 'trail': 1.0, 'swing': 1.0, 'lag': 0.07, 'bust': 0.5, 'freq': 2.2},
    'jog': {'pitch': 0.8, 'coat': 1.5, 'trail': 3.0, 'swing': 1.6, 'lag': 0.0, 'bust': 0.3, 'freq': 1.9},
    'run': {'pitch': 1.0, 'coat': 1.8, 'trail': 4.0, 'swing': 1.8, 'lag': 0.0, 'bust': 0.25, 'freq': 1.8},
}
BUST_DAMP = 0.3


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
    # the chest: a bone riding on the torso where the bust is, which a spring moves up and down a little behind her step
    if 'bust' in parts.get('torso', {}).get('joints', {}):
        b0 = world(parts, pos, 'torso', 'bust')
        bone('bust', b0, (b0[0], b0[1] - 40), 'torso')
    # the ponytail: a chain from where it is tied at the back of the head to its tip, riding on the head
    if 'ponytail' in parts:
        root, tip = pos['ponytail'], world(parts, pos, 'ponytail', 'tip')
        prev = 'head'
        for k in range(PONY_CHAIN):
            a = (root[0] + (tip[0] - root[0]) * k / PONY_CHAIN, root[1] + (tip[1] - root[1]) * k / PONY_CHAIN)
            b = (root[0] + (tip[0] - root[0]) * (k + 1) / PONY_CHAIN, root[1] + (tip[1] - root[1]) * (k + 1) / PONY_CHAIN)
            prev = bone(f'pony{k + 1}', a, b, prev).name
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
    return arm


def weights(name, part, x, y, bounce=0.0):
    """How a vertex of a piece (in the piece's own pixels) follows the bones: rigid in the middle of a limb, blending into
    the next bone across a joint, so knees, elbows and ankles bend instead of breaking. `bounce` is how much of the
    torso's chest follows the chest's bone, softly around the bust, in a set whose chest moves."""
    j, (w, h) = part['joints'], part['size']
    if name == 'torso' and bounce > 0 and 'bust' in j:
        bx, by = j['bust']
        r = 0.15 * abs(j['hip'][1] - j['neck'][1])
        b = bounce * (1 - smooth(0.55 * r, 1.5 * r, math.hypot(x - bx, y - by)))
        return {'torso': 1 - b, 'bust': b}
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
    if name == 'ponytail':
        r0, tip = j['root'][1], j['tip'][1]
        t = (y - r0) / max(1.0, tip - r0)
        pin = 1 - smooth(-0.04, 0.1, t)
        w1 = 1 - smooth(0.2, 0.45, t)
        w3 = smooth(0.55, 0.8, t)
        w2 = max(0.0, 1 - w1 - w3)
        out = {'head': pin}
        for k, wk in ((1, w1), (2, w2), (3, w3)):
            out[f'pony{k}'] = (1 - pin) * wk
        return out
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
    # a chest that moves needs the bone to move it, and a finer mesh to bend smoothly around it
    bounce = s.get('bounce', 0.0) if 'bust' in arm.data.bones else 0.0
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    order = [r[0] for r in RIG if r[1] in parts]
    if s.get('coatFront'):
        order.remove('coat')
        # in front of her legs; over: in front of her torso too, as briefs over her belly
        order.insert(order.index('torso') + 1 if s.get('coatOver') else order.index('foot') + 1, 'coat')
    for i, piece in enumerate(order):
        part = parts[BY[piece][1]]
        w, h = part['size']
        pv = part['joints'][BY[piece][4]]
        x0, y0 = pos[piece][0] - pv[0], pos[piece][1] - pv[1]
        step = 16 if piece == 'torso' and bounce > 0 else 40
        cols, rows = max(2, round(w / step)), max(2, round(h / step))
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
            for bone_name, wt in weights(piece, part, w * c / cols, h * r / rows, bounce).items():
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
    """The idle loop at frames 0 to M - 1, then one cycle of each gait the rig has (the walk, the jog, the run), with
    follow-through the gaits leave out."""
    idle = R['idle']
    idle = idle if isinstance(idle, list) else [idle]
    M = len(idle)
    gaits = [(g, R[g]['frames']) for g in ('walk', 'jog', 'run') if R.get(g) and R[g].get('frames')]
    deg = math.radians

    def key(frame, angles):
        for name, a in angles.items():
            pb = arm.pose.bones.get(name)
            if pb is None:
                continue
            pb.rotation_euler = (0.0, 0.0, deg(a))
            pb.keyframe_insert('rotation_euler', frame=frame)

    rest = {pb.name: 0.0 for pb in arm.pose.bones}
    # standing: the ponytail and the coat swing gently with her breath, a little behind it
    ih = [f.get('head', 0.0) + f.get('torso', 0.0) for f in idle]
    ic = [f.get('torso', 0.0) for f in idle]
    ipony = spring_chain([2.0 * (h - sum(ih) / M) for h in ih], PONY_CHAIN, omega=2 * math.pi * 0.9, zeta=0.4) if M > 1 else None
    sway = R.get('coatSway', 1.0)
    icoat = spring_chain([sway * 1.5 * (c - sum(ic) / M) for c in ic], COAT_CHAIN, omega=2 * math.pi * 0.8, zeta=0.5) if M > 1 and sway > 0 else None
    for k, f in enumerate(idle):
        a = {n: v for n, v in f.items() if n in rest}
        for i in range(PONY_CHAIN):
            if ipony:
                a[f'pony{i + 1}'] = ipony[i][k] - (ipony[i - 1][k] if i else 0.0)
        for i in range(COAT_CHAIN):
            if icoat:
                a[f'coatF{i + 1}'] = icoat[i][k] - (icoat[i - 1][k] if i else 0.0)
                a[f'coatB{i + 1}'] = icoat[i][k] - (icoat[i - 1][k] if i else 0.0)
        key(k, {**rest, **a})
    def cycle(start, frames, pitch_k, coat_k, pony_trail, pony_gain, arm_lag):
        """One cycle of a gait keyed from frame `start`: the coat its legs push and drag, the ponytail its steps swing,
        the forearms trailing the upper arms, the torso pitching with each step."""
        n = len(frames)
        # the coat: its front pushed forward by whichever leg leads, its back dragged by the trailing one, each a chain
        # of springs so the hem lags behind the hips
        lead = [max(f['thighAbs'], f['thighAbsFar'], 0.0) for f in frames]
        trail = [min(f['thighAbs'], f['thighAbsFar'], 0.0) for f in frames]
        front = spring_chain([coat_k * (0.55 * a + 1.5) for a in lead], COAT_CHAIN, omega=2 * math.pi * 2.4, zeta=0.5)
        back = spring_chain([coat_k * (0.5 * a - 2.0) for a in trail], COAT_CHAIN, omega=2 * math.pi * 2.0, zeta=0.45)
        # the ponytail: each step's bounce swings it, the tip later than the root
        bob = [f.get('bob', 0.0) for f in frames]
        lo, hi = min(bob), max(bob)
        mid, half = (lo + hi) / 2, max(1e-6, (hi - lo) / 2)
        pony = spring_chain([pony_trail - pony_gain * (b - mid) / half for b in bob], PONY_CHAIN, omega=2 * math.pi * 1.8, zeta=0.35)
        # the forearms trail the upper arms a little
        lag = round(n * arm_lag)
        for k, f in enumerate(frames):
            p = k / n
            pitch = pitch_k * math.sin(4 * math.pi * (p - 0.1))
            a = {nm: f[nm] for nm in ('legUpper', 'legLower', 'foot', 'legFarUpper', 'legFarLower', 'footFar', 'armUpper', 'armFarUpper')}
            a['torso'] = f['torso'] + pitch
            a['head'] = f['head'] - pitch
            for up, low in (('armUpper', 'armLower'), ('armFarUpper', 'armFarLower')):
                a[low] = f[low] + (frames[(k - lag) % n][up] - f[up])
            for i in range(COAT_CHAIN):
                a[f'coatF{i + 1}'] = front[i][k] - (front[i - 1][k] if i else 0.0)
                a[f'coatB{i + 1}'] = back[i][k] - (back[i - 1][k] if i else 0.0)
            for i in range(PONY_CHAIN):
                a[f'pony{i + 1}'] = pony[i][k] - (pony[i - 1][k] if i else 0.0)
            key(start + k, {**rest, **a})

    # one after another, each gait's coat, ponytail and arms as GAITS has them: jogging and running the coat flies out
    # further, the ponytail streams back and bounces harder
    starts, at = {}, M
    for g, frames in gaits:
        k = GAITS[g]
        starts[g] = at
        cycle(at, frames, k['pitch'], k['coat'] * sway, PONY_TRAIL * k['trail'], PONY_GAIN * k['swing'], k['lag'])
        at += len(frames)
    # the chest: still standing; walking and running, on a damped spring that follows her body up and down, a little
    # late, so it settles a moment after each step lands and rises
    pb = arm.pose.bones.get('bust')
    if pb:
        def bust(start, frames, freq, gain):
            bob = [f.get('bob', 0.0) for f in frames]
            follow = spring_chain(bob, 1, omega=2 * math.pi * freq, zeta=BUST_DAMP)[0]
            for k in range(len(frames)):
                pb.location = (0.0, gain * (follow[k] - bob[k]) * PX, 0.0)
                pb.keyframe_insert('location', frame=start + k)
        for k in range(M):
            pb.location = (0.0, 0.0, 0.0)
            pb.keyframe_insert('location', frame=k)
        for g, frames in gaits:
            bust(starts[g], frames, GAITS[g]['freq'], GAITS[g]['bust'])
    for fc in arm.animation_data.action.fcurves if arm.animation_data and arm.animation_data.action and hasattr(arm.animation_data.action, 'fcurves') else []:
        for kp in fc.keyframe_points:
            kp.interpolation = 'CONSTANT'
    scn = bpy.context.scene
    scn.frame_start, scn.frame_end = 0, at - 1
    scn.timeline_markers.new('idle', frame=0)
    for g, _ in gaits:
        scn.timeline_markers.new(g, frame=starts[g])


def use_gpu():
    """Cycles on the Mac's GPU, without the optimised kernels Metal compiles in the background while it renders: that
    compile crashed Blender partway through a set. The frames are the same without them."""
    scn = bpy.context.scene
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        if hasattr(prefs, 'kernel_optimization_level'):
            prefs.kernel_optimization_level = 'OFF'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scn.cycles.device = 'GPU'
    except Exception:
        scn.cycles.device = 'CPU'


def setup_render():
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    use_gpu()
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
    use_gpu()
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
