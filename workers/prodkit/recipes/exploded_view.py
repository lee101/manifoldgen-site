import bpy, bmesh, math, random, time
from mathutils import Vector, Matrix
from lib.core import P, log, kf, link, collection, UserError, reset, setup_render, save_blend, render, export_glb
from lib import mats, stage, geo, props

MODES = ("explode", "assemble", "explode_assemble")
AXES = ("auto", "radial", "vertical", "forward")
DEMOS = {"camera": props.camera, "watch": props.watch, "headphones": props.headphones}
MAXP = 48


def islands(bm):
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        st, grp = [f], []
        seen.add(f.index)
        while st:
            x = st.pop()
            grp.append(x)
            for e in x.edges:
                for y in e.link_faces:
                    if y.index not in seen:
                        seen.add(y.index)
                        st.append(y)
        out.append(grp)
    return out


def from_faces(bm, faces, name, me_src):
    nb = bmesh.new()
    vmap = {}
    uvs = [(bm.loops.layers.uv[k], nb.loops.layers.uv.new(bm.loops.layers.uv[k].name)) for k in range(len(bm.loops.layers.uv))]
    for f in faces:
        vs = []
        for v in f.verts:
            if v not in vmap:
                vmap[v] = nb.verts.new(v.co)
            vs.append(vmap[v])
        try:
            nf = nb.faces.new(vs)
        except ValueError:
            continue
        nf.material_index, nf.smooth = f.material_index, f.smooth
        for lo, ln in zip(f.loops, nf.loops):
            for a, b in uvs:
                ln[b].uv = lo[a].uv
    me = bpy.data.meshes.new(name)
    nb.to_mesh(me)
    nb.free()
    for m in me_src.materials:
        me.materials.append(m)
    return link(bpy.data.objects.new(name, me))


def split(objs, axis_vec, layers, accent):
    if len(objs) > 1:
        return objs, "objects"
    ob = objs[0]
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5 * max(ob.dimensions))
    bm.faces.ensure_lookup_table()
    isl = islands(bm)
    if len(isl) > 1:
        out = [from_faces(bm, g, f"{ob.name}_{k}", ob.data) for k, g in enumerate(isl)]
        bm.free()
        bpy.data.objects.remove(ob)
        return out, "loose_parts"
    nm = len({f.material_index for f in bm.faces})
    if nm > 1:
        groups = {}
        for f in bm.faces:
            groups.setdefault(f.material_index, []).append(f)
        out = [from_faces(bm, g, f"{ob.name}_m{k}", ob.data) for k, g in groups.items()]
        bm.free()
        bpy.data.objects.remove(ob)
        return out, "material_slots"
    ds = [v.co.dot(axis_vec) for v in bm.verts]
    lo, hi = min(ds), max(ds)
    ob.data.materials.append(accent)
    ai = len(ob.data.materials) - 1
    out = []
    for k in range(layers):
        a, b = lo + (hi - lo) * k / layers, lo + (hi - lo) * (k + 1) / layers
        c = bm.copy()
        for co, nrm in (((a,), -axis_vec), ((b,), axis_vec)):
            if (k == 0 and nrm.dot(axis_vec) < 0) or (k == layers - 1 and nrm.dot(axis_vec) > 0):
                continue
            r = bmesh.ops.bisect_plane(c, geom=c.verts[:] + c.edges[:] + c.faces[:], plane_co=axis_vec * co[0], plane_no=nrm, clear_outer=True)
            edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                try:
                    for f in bmesh.ops.triangle_fill(c, use_beauty=True, edges=edges, normal=nrm)["geom"]:
                        if isinstance(f, bmesh.types.BMFace):
                            f.material_index = ai
                except Exception:
                    pass
        if len(c.faces):
            me = bpy.data.meshes.new(f"{ob.name}_L{k}")
            c.to_mesh(me)
            for m in ob.data.materials:
                me.materials.append(m)
            out.append(link(bpy.data.objects.new(me.name, me)))
        c.free()
    bm.free()
    bpy.data.objects.remove(ob)
    return out, "planar_layers"


def centroid(o):
    n = len(o.data.vertices)
    co = [0.0] * (n * 3)
    o.data.vertices.foreach_get("co", co)
    return Vector((sum(co[0::3]) / n, sum(co[1::3]) / n, sum(co[2::3]) / n)), Vector((max(co[0::3]) - min(co[0::3]), max(co[1::3]) - min(co[1::3]), max(co[2::3]) - min(co[2::3])))


def merge_small(parts, size):
    info = [(o, *centroid(o)) for o in parts]
    big = [x for x in info if x[2].length >= 0.06 * size]
    small = [x for x in info if x[2].length < 0.06 * size]
    if not big:
        big, small = info, []
    groups = {id(b[0]): [b[0]] for b in big}
    for o, c, _ in small:
        tgt = min(big, key=lambda b: (b[1] - c).length)
        groups[id(tgt[0])].append(o)
    while len(groups) > MAXP:
        keys = sorted(groups, key=lambda k: sum(len(o.data.polygons) for o in groups[k]))
        a = keys[0]
        ca = centroid(groups[a][0])[0]
        b = min((k for k in groups if k != a), key=lambda k: (centroid(groups[k][0])[0] - ca).length)
        groups[b] += groups.pop(a)
    out = []
    for k, g in enumerate(groups.values()):
        out.append(geo.join(g, f"Part_{k:02d}") if len(g) > 1 else g[0])
    return out


def run(ctx):
    p = ctx.p
    t = time.time()
    mode = p.e("mode", "explode_assemble", MODES)
    axis = p.e("axis", "auto", AXES)
    spread = p.f("spread", 1.0, 0.2, 3.0)
    stagger = p.f("stagger", 0.5, 0.0, 1.0)
    turntable = p.b("turntable", True)
    spin = p.f("turntable_degrees", 90, 0, 720)
    guides = p.d.get("guides", "auto")
    layers = p.i("layers", 5, 2, 10)
    demo = p.e("demo", "camera", DEMOS)
    reset()
    scn = ctx.scene()
    models = ctx.model_paths()
    designed = False
    if models:
        objs = []
        for mp in models[:8]:
            objs += geo.import_model(mp, ctx.blog)
        geo.normalize(objs, 3.0, ground=False)
        ax0 = Vector((0, 0, 1)) if axis in ("vertical", "auto", "radial") else Vector((0, -1, 0))
        parts, strategy = split(objs, ax0, layers, mats.principled("cut_face", (0.9, 0.35, 0.05), 0.4))
        parts = merge_small(parts, 3.0)
        cfg = {}
        subject = "model"
    else:
        parts, cfg = DEMOS[demo]()
        geo.normalize(parts, 3.0, ground=False)
        strategy, subject = "designed", demo
        designed = axis == "auto"
    if axis == "auto":
        axis = cfg.get("axis", "radial") if not designed else "designed"
    if len(parts) < 2:
        raise UserError("could not split model into parts")
    for o in parts:
        geo.decimate(o, max(2000, 300000 // len(parts)))
    lo, hi = geo.bounds(parts)
    size = max(hi - lo)
    lift = size * 0.75
    prod = link(bpy.data.objects.new("Product", None))
    prod.location = (0, 0, lift)
    info = []
    for o in parts:
        c, dim = centroid(o)
        o.data.transform(Matrix.Translation(-c))
        o.location = c
        o.parent = prod
        info.append((o, c, dim))
    ctr = (lo + hi) / 2
    R = max((c - ctr).length for _, c, _ in info) or 1.0
    order = sorted(range(len(info)), key=lambda i: -(info[i][1] - ctr).length)
    n = len(info)
    offs = [None] * n
    fwd = Vector((0, -1, 0))
    if axis in ("vertical", "forward"):
        av = Vector((0, 0, 1)) if axis == "vertical" else fwd
        rank = sorted(range(n), key=lambda i: info[i][1].dot(av))
        gap = size * 0.16 * spread
        for r, i in enumerate(rank):
            offs[i] = av * ((info[i][1] - ctr).dot(av) * 0.6 * spread + (r - (n - 1) / 2) * gap)
        order = sorted(range(n), key=lambda i: -abs(offs[i].length))
    elif axis == "designed":
        for i, (o, c, _) in enumerate(info):
            offs[i] = Vector(o.get("dir", (0, 0, 0))) * size * 0.32 * spread
    else:
        for i, (o, c, dim) in enumerate(info):
            d = c - ctr
            if d.length < 0.05 * size:
                d = Vector((0, 0, 1)) * (0.3 * size)
            offs[i] = d * 0.9 * spread + d.normalized() * size * 0.12 * spread
    F = ctx.frames
    seg = {"explode": [(0.12, 0.62, 0, 1)], "assemble": [(0.15, 0.7, 1, 0)], "explode_assemble": [(0.08, 0.42, 0, 1), (0.6, 0.94, 1, 0)]}[mode]
    stg = stagger * 0.45
    for rk, i in enumerate(order):
        o, c, _ = info[i]
        delay = stg * rk / max(1, n - 1)
        for (a, b, s0, s1) in seg:
            span = (b - a) * (1 - stg)
            d0 = a + (b - a - span) * (delay / stg if stg else 0) if s1 > s0 else a + (b - a - span) * ((stg - delay) / stg if stg else 0)
            f0, f1 = 1 + round(d0 * (F - 1)), 1 + round((d0 + span) * (F - 1))
            for f, s in ((f0, s0), (max(f1, f0 + 1), s1)):
                o.location = c + offs[i] * s
                kf(o, "location", f, "BEZIER")
        o.location = c + offs[i] * seg[0][2]
    ctx.stats.update(parts=n, split=strategy, subject=subject, axis=axis, mode=mode)
    log(f"parts {n} ({strategy}) {time.time() - t:.1f}s")
    guides = P(p.d).b("guides", n <= 20) if guides != "auto" else n <= 20
    ctx.stats["guides"] = guides
    if guides:
        gm = mats.principled("guide", (0.9, 0.9, 0.92), 0.5, Emission_Color=(0.9, 0.9, 1.0), Emission_Strength=0.6)
        gcol = collection("Guides")
        for i, (o, c, _) in enumerate(info):
            if offs[i].length < 0.08 * size:
                continue
            cu = bpy.data.curves.new(f"guide_{o.name}", "CURVE")
            cu.dimensions = "3D"
            cu.bevel_depth = size * 0.0025
            sp = cu.splines.new("POLY")
            sp.points.add(1)
            sp.points[0].co = (*c, 1)
            sp.points[1].co = (*c, 1)
            g = bpy.data.objects.new(cu.name, cu)
            gcol.objects.link(g)
            g.parent = prod
            cu.materials.append(gm)
            h = g.modifiers.new("hook", "HOOK")
            h.object = o
            h.vertex_indices_set([1])
            h.matrix_inverse = Matrix.Translation(c).inverted()
            g.visible_shadow = False
    if turntable and spin > 0:
        prod.rotation_euler.z = -math.radians(spin) / 2
        kf(prod, "rotation_euler", 1, "LINEAR", index=2)
        prod.rotation_euler.z = math.radians(spin) / 2
        kf(prod, "rotation_euler", F, "LINEAR", index=2)
    angs = [0]
    if turntable and spin > 0:
        angs = [math.radians(a) for a in range(-int(spin / 2), int(spin / 2) + 1, max(10, int(spin / 8)))] or [0]

    def cloud(states):
        out = []
        for i, (o, c, dim) in enumerate(info):
            for s in states:
                q = c + offs[i] * s
                for dx in (-0.5, 0.5):
                    for dy in (-0.5, 0.5):
                        for dz in (-0.5, 0.5):
                            out.append(q + Vector((dx * dim.x, dy * dim.y, dz * dim.z)))
        return [Matrix.Rotation(a, 3, "Z") @ q + prod.location for a in angs for q in out]
    pts = cloud((0, 1))
    zmin = min(q.z for q in pts)
    if zmin < size * 0.15:
        prod.location.z += size * 0.15 - zmin
        pts = cloud((0, 1))
    el = math.radians(30 if axis != "vertical" and subject != "watch" else 38)
    az = math.radians(-32)
    cam, rig, tgt, D = stage.camera_rig(ctx, pts, az - math.radians(4), az + math.radians(4), el, lens=50, dolly=(1.0, 1.0), margin=1.08, fstop=8)
    rest = cloud((0,))
    t_rest = stage.center_target(rest, tgt.location, az, el, 50, ctx.w, ctx.h, 1.25)
    d_rest = max(stage.fit_distance(rest, t_rest, az, el, 50, ctx.w, ctx.h, 1.25)[0], D * 0.45)
    t_exp = tgt.location.copy()
    cam.animation_data_clear()
    keys = []
    for (a, b, s0, s1) in seg:
        keys += [(1 + round(a * (F - 1)), s0), (1 + round(min(1, b + 0.04) * (F - 1)), s1)]
    for f, s in keys:
        cam.location = stage.sph(0, el, d_rest + (D - d_rest) * s)
        kf(cam, "location", f)
        tgt.location = t_rest.lerp(t_exp, s)
        kf(tgt, "location", f)
    ext = max(max(q.x for q in pts) - min(q.x for q in pts), max(q.z for q in pts))
    stage.stage(ctx.background, tgt.location, max(size, ext * 0.8), az)
    setup_render(ctx, "CYCLES", motion_blur=True, transparent_bounces=8)
    peak = seg[0][1] if mode != "assemble" else seg[0][0]
    ctx.poster_frame = 1 + int(min(0.98, peak + 0.06) * (F - 1))
    save_blend(ctx)
    render(ctx)
    return export_glb(ctx, [o for o, _, _ in info] + [prod])
