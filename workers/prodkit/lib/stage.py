import bpy, bmesh, math
from mathutils import Vector, Matrix, Euler
from .core import kf, link
from .mats import NB, new, finish, principled


def world(preset, sun_dir=None, color=None, strength=None):
    w = bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    try:
        w.use_nodes = True
    except Exception:
        pass
    b = NB(w.node_tree)
    out = b("ShaderNodeOutputWorld")
    if preset == "sky":
        z = b("ShaderNodeMath", b("ShaderNodeSeparateXYZ", b("ShaderNodeTexCoord").outputs["Generated"]).outputs[2], 0.5, 0.5, operation="MULTIPLY_ADD")
        g = b.ramp(z, [(0.0, (0.32, 0.3, 0.28)), (0.5, (0.8, 0.8, 0.8)), (0.53, (0.42, 0.6, 0.88)), (0.75, (0.16, 0.36, 0.78)), (1.0, (0.08, 0.2, 0.55))])
        bg = b("ShaderNodeBackground", g, i_Strength=1.0 if strength is None else strength)
    elif preset == "sunset":
        sky = b("ShaderNodeTexSky", sky_type="MULTIPLE_SCATTERING", sun_elevation=math.radians(3), sun_disc=False)
        bg = b("ShaderNodeBackground", sky, i_Strength=0.25 if strength is None else strength)
    else:
        col, st = {"studio": ((0.42, 0.43, 0.45), 0.25), "dark": ((0.006, 0.007, 0.011), 1.0),
                   "white": ((1, 1, 1), 0.55), "night": ((0.004, 0.006, 0.016), 1.0)}.get(preset, ((0.42, 0.43, 0.45), 0.35))
        bg = b("ShaderNodeBackground", i_Color=color or col, i_Strength=st if strength is None else strength)
    b.set(out.inputs[0], bg)
    return w


def floor_mat(preset):
    if preset == "dark":
        return principled("floor", (0.035, 0.035, 0.038), 0.7, Specular_IOR_Level=0.25)
    if preset == "white":
        return principled("floor", (0.82, 0.82, 0.82), 0.7)
    if preset == "sky":
        m, b = new("floor")
        v = b("ShaderNodeTexCoord").outputs["Object"]
        n = b("ShaderNodeTexNoise", v, i_Scale=0.35, i_Detail=8, i_Roughness=0.65)
        n2 = b("ShaderNodeTexNoise", v, i_Scale=9, i_Detail=4)
        col = b.mix(n.outputs["Fac"], (0.2, 0.17, 0.13), (0.34, 0.3, 0.24))
        bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col, i_Roughness=0.9)
        return finish(m, b, bs, b("ShaderNodeBump", i_Strength=0.2, i_Height=n2.outputs["Fac"]))
    return principled("floor", (0.22, 0.22, 0.23), 0.5)


def cyclorama(size, az, preset, dist=None):
    s = size
    d = dist if dist is not None else 6 * s
    R, H, W, L = 3.5 * s, 25 * s, 80 * s, 60 * s
    prof = [(-L, 0.0)]
    for k in range(13):
        a = k / 12 * math.pi / 2
        prof.append((d - R + R * math.sin(a), R - R * math.cos(a)))
    prof.append((d, H))
    bm = bmesh.new()
    rows = [[bm.verts.new((x, y, z)) for (y, z) in prof] for x in (-W / 2, W / 2)]
    for j in range(len(prof) - 1):
        bm.faces.new((rows[0][j], rows[1][j], rows[1][j + 1], rows[0][j + 1]))
    me = bpy.data.meshes.new("Backdrop")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = link(bpy.data.objects.new("Backdrop", me))
    ob.rotation_euler.z = az
    me.materials.append(floor_mat(preset))
    return ob


def ground_plane(size, preset):
    bpy.ops.mesh.primitive_plane_add(size=size)
    ob = bpy.context.active_object
    ob.name = "Ground"
    ob.data.materials.append(floor_mat(preset))
    return ob


def sph(az, el, d):
    return Vector((math.sin(az) * math.cos(el) * d, -math.cos(az) * math.cos(el) * d, math.sin(el) * d))


def area(name, target, az, el, dist, size, power, color=(1, 1, 1), shape="DISK"):
    l = bpy.data.lights.new(name, "AREA")
    l.shape = shape
    l.size = size
    l.energy = power * dist * dist
    l.color = color
    ob = link(bpy.data.objects.new(name, l))
    ob.location = target + sph(az, el, dist)
    ob.rotation_euler = (-sph(az, el, 1)).to_track_quat("-Z", "Y").to_euler()
    return ob


def spot(name, target, az, el, dist, angle, power, color=(1, 1, 1), radius=0.3, blend=0.7):
    l = bpy.data.lights.new(name, "SPOT")
    l.spot_size = math.radians(angle)
    l.spot_blend = blend
    l.shadow_soft_size = radius
    l.energy = power * dist * dist
    l.color = color
    ob = link(bpy.data.objects.new(name, l))
    ob.location = target + sph(az, el, dist)
    ob.rotation_euler = (-sph(az, el, 1)).to_track_quat("-Z", "Y").to_euler()
    return ob


def sun(name, az, el, energy, angle=2.0, color=(1, 0.96, 0.9)):
    l = bpy.data.lights.new(name, "SUN")
    l.energy = energy
    l.angle = math.radians(angle)
    l.color = color
    ob = link(bpy.data.objects.new(name, l))
    ob.rotation_euler = (-sph(az, el, 1)).to_track_quat("-Z", "Y").to_euler()
    return ob, sph(az, el, 1)


def stage(preset, center, size, cam_az, key_side=-1, floor=True):
    t = Vector(center)
    bpy.context.scene.view_settings.exposure = 0.0
    objs = []
    if preset == "sky":
        s, sd = sun("Sun", cam_az + key_side * math.radians(50), math.radians(32), 4.5, 1.5)
        world("sky", sd)
        objs.append(s)
        if floor:
            objs.append(ground_plane(400 * max(1, size / 4), preset))
    else:
        world(preset)
        if floor:
            objs.append(cyclorama(size, cam_az, preset))
        k = key_side
        if preset == "studio":
            objs += [area("Key", t, cam_az + k * math.radians(45), math.radians(48), 3 * size, 2.2 * size, 14, (1, 0.95, 0.9)),
                     area("Fill", t, cam_az - k * math.radians(60), math.radians(18), 3.5 * size, 3 * size, 4, (0.92, 0.96, 1)),
                     area("Rim", t, cam_az + k * math.radians(145), math.radians(50), 3 * size, 1.5 * size, 22)]
        elif preset == "dark":
            objs += [spot("Key", t, cam_az + k * math.radians(55), math.radians(45), 3 * size, 38, 55, (1, 0.88, 0.75), 0.25 * size),
                     area("Fill", t, cam_az - k * math.radians(50), math.radians(12), 4 * size, 2 * size, 1.5, (0.6, 0.75, 1)),
                     spot("Rim", t, cam_az - k * math.radians(140), math.radians(50), 3 * size, 30, 70, (0.55, 0.72, 1), 0.2 * size),
                     spot("Rim2", t, cam_az + k * math.radians(135), math.radians(45), 3 * size, 30, 40, (1, 0.8, 0.6), 0.2 * size)]
        else:
            objs += [area("Key", t, cam_az + k * math.radians(40), math.radians(50), 3 * size, 4 * size, 16),
                     area("Fill", t, cam_az - k * math.radians(70), math.radians(25), 3.5 * size, 4 * size, 7),
                     area("Top", t, 0, math.radians(89), 3 * size, 4 * size, 8)]
    return objs


def fit_distance(pts, target, az, el, lens, w, h, margin=1.08):
    f = -sph(az, el, 1)
    r = f.cross(Vector((0, 0, 1))).normalized()
    u = r.cross(f)
    big = 18.0 / lens
    tx, ty = (big, big * h / w) if w >= h else (big * w / h, big)
    tx /= margin
    ty /= margin
    D = 0.0
    for p in pts:
        q = Vector(p) - target
        x, y, z = q.dot(r), q.dot(u), q.dot(f)
        D = max(D, abs(x) / tx - z, abs(y) / ty - z)
    return D, r, u, f


def center_target(pts, target, az, el, lens, w, h, margin=1.08):
    t = Vector(target)
    for _ in range(3):
        D, r, u, f = fit_distance(pts, t, az, el, lens, w, h, margin)
        cam = t - f * D
        xs, ys = [], []
        for p in pts:
            q = Vector(p) - cam
            z = q.dot(f)
            xs.append(q.dot(r) / max(z, 1e-3))
            ys.append(q.dot(u) / max(z, 1e-3))
        dx, dy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
        dist = (t - cam).length
        t = t + r * dx * dist + u * dy * dist
    return t


def camera_rig(ctx, pts, az0, az1, el, lens=40, dolly=(1.0, 0.95), margin=1.08, target=None, center=True, fstop=None, frame_range=None):
    w, h = ctx.w, ctx.h
    t = Vector(target) if target is not None else sum((Vector(p) for p in pts), Vector()) / len(pts)
    if center:
        t = center_target(pts, t, (az0 + az1) / 2, el, lens, w, h, margin)
    D = max(fit_distance(pts, t, a, el, lens, w, h, margin)[0] for a in (az0, (az0 + az1) / 2, az1))
    D = max(D, 0.5)
    tgt = link(bpy.data.objects.new("CamTarget", None))
    tgt.location = t
    rig = link(bpy.data.objects.new("CamRig", None))
    rig.location = t
    cd = bpy.data.cameras.new("Camera")
    cd.lens = lens
    cd.sensor_fit = "AUTO"
    cd.clip_start = max(0.01, D * 0.01)
    cd.clip_end = max(500, D * 50)
    if fstop:
        cd.dof.use_dof = True
        cd.dof.focus_object = tgt
        cd.dof.aperture_fstop = fstop
    cam = link(bpy.data.objects.new("Camera", cd))
    cam.parent = rig
    tc = cam.constraints.new("TRACK_TO")
    tc.target = tgt
    tc.track_axis, tc.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    f0, f1 = frame_range or (1, ctx.frames)
    for f, a, dl in ((f0, az0, dolly[0]), (f1, az1, dolly[1])):
        rig.rotation_euler.z = a
        kf(rig, "rotation_euler", f, index=2)
        cam.location = sph(0, el, D * dl)
        kf(cam, "location", f)
    bpy.context.scene.camera = cam
    ctx.stats["cam_distance"] = round(D, 2)
    return cam, rig, tgt, D


def shake(tgt, f0, frames, amp, seed=1, decay=0.82):
    import random
    rnd = random.Random(seed)
    base = tgt.location.copy()
    kf(tgt, "location", f0 - 1, "LINEAR")
    a = amp
    for f in range(f0, f0 + frames):
        tgt.location = base + Vector((rnd.uniform(-1, 1), rnd.uniform(-1, 1), rnd.uniform(-1, 1))) * a
        kf(tgt, "location", f, "LINEAR")
        a *= decay
    tgt.location = base
    kf(tgt, "location", f0 + frames, "BEZIER")


def bbox(objs):
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in objs:
        if o.type not in ("MESH", "CURVE", "FONT"):
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def corners(lo, hi):
    return [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
