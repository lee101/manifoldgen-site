import bpy, bmesh, math, random, time, os
from mathutils import Vector, Matrix, Euler
from lib.core import log, kf, link, collection, quiet, UserError, reset, setup_render, save_blend, render, export_glb
from lib import mats, stage, geo, fx

SUBJECTS = ("tower", "wall", "pillar", "statue", "house", "text")
MATERIALS = tuple(mats.SUBJECT_MATS)
IMPACTS = ("ball", "explosion", "quake", "slice")
DEFAULT_MAT = {"tower": "brick", "wall": "brick", "pillar": "marble", "statue": "marble", "house": "brick", "text": "concrete"}
STRENGTH = {"concrete": 1.2, "brick": 1.0, "glass": 0.6, "wood": 1.6, "marble": 1.1, "ice": 0.7}
DENSITY = {"concrete": 2400, "brick": 1900, "glass": 2500, "wood": 700, "marble": 2700, "ice": 917}


def box(bm, lo, hi):
    r = bmesh.ops.create_cube(bm, size=1.0)
    sc = Vector(hi) - Vector(lo)
    c = (Vector(hi) + Vector(lo)) / 2
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((*sc, 1)), verts=r["verts"])


def prism(bm, prof, depth):
    top = [bm.verts.new((x, -depth / 2, z)) for x, z in prof]
    bot = [bm.verts.new((x, depth / 2, z)) for x, z in prof]
    bm.faces.new(top[::-1])
    bm.faces.new(bot)
    n = len(prof)
    for i in range(n):
        bm.faces.new((top[i], top[(i + 1) % n], bot[(i + 1) % n], bot[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])


def mesh_to_bm(me, M=None):
    bm = bmesh.new()
    bm.from_mesh(me)
    if M:
        bm.transform(M)
    return bm


def builtin(kind, text):
    bm = bmesh.new()
    if kind == "tower":
        box(bm, (-0.75, -0.75, 0), (0.75, 0.75, 4.2))
        for x in (-0.6, 0.6):
            for y in (-0.6, 0.6):
                box(bm, (x - 0.15, y - 0.15, 4.2), (x + 0.15, y + 0.15, 4.55))
    elif kind == "wall":
        box(bm, (-2.6, -0.25, 0), (2.6, 0.25, 2.5))
    elif kind == "pillar":
        box(bm, (-0.65, -0.65, 0), (0.65, 0.65, 0.3))
        r = bmesh.ops.create_cone(bm, cap_ends=True, segments=40, radius1=0.45, radius2=0.4, depth=3.5)
        bmesh.ops.translate(bm, vec=(0, 0, 0.3 + 1.75), verts=r["verts"])
        box(bm, (-0.65, -0.65, 3.8), (0.65, 0.65, 4.1))
    elif kind == "statue":
        bpy.ops.mesh.primitive_monkey_add(size=1.0)
        mk = bpy.context.active_object
        mod = mk.modifiers.new("s", "SUBSURF")
        mod.levels = 2
        rm = mk.modifiers.new("r", "REMESH")
        rm.mode, rm.voxel_size, rm.adaptivity = "VOXEL", 0.02, 0.0
        dc = mk.modifiers.new("d", "DECIMATE")
        dc.ratio = 0.25
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(mk.evaluated_get(dg), depsgraph=dg)
        bpy.data.objects.remove(mk)
        lo, hi = geo.bounds([type("o", (), {"data": me, "matrix_world": Matrix()})])
        s = 1.7 / (hi.x - lo.x)
        M = Matrix.Translation((0, 0, 1.5 - lo.z * s)) @ Matrix.Diagonal((s, s, s, 1)) @ Matrix.Rotation(math.radians(-8), 4, "X")
        me.transform(M)
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        box(bm, (-0.6, -0.55, 0), (0.6, 0.55, 1.5))
    elif kind == "house":
        prism(bm, [(-1.6, 0), (1.6, 0), (1.6, 2.0), (0, 3.3), (-1.6, 2.0)], 2.6)
    else:
        cu = bpy.data.curves.new("txt", "FONT")
        cu.body = text
        cu.extrude = 0.22
        cu.size = 1.6
        cu.align_x = "CENTER"
        cu.resolution_u = 4
        ob = link(bpy.data.objects.new("txt", cu))
        dg = bpy.context.evaluated_depsgraph_get()
        me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg), depsgraph=dg)
        bpy.data.objects.remove(ob)
        bpy.data.curves.remove(cu)
        me.transform(Matrix.Rotation(math.radians(90), 4, "X"))
        tmp = type("o", (), {"data": me, "matrix_world": Matrix()})
        lo, hi = geo.bounds([tmp])
        s = min(1.0, 6.0 / max(hi.x - lo.x, 1e-3))
        me.transform(Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z)))
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def time_curve(frames, fps, hit, slowmo):
    ts = [1.0] * (frames + 2)
    if slowmo:
        a, b = hit - int(0.12 * fps), hit + 2
        c = hit + int((frames - hit) * 0.55)
        for f in range(1, frames + 2):
            if f <= a:
                v = 1.0
            elif f <= b:
                v = 1.0 + (0.16 - 1.0) * (f - a) / max(1, b - a)
            elif f <= c:
                v = 0.16
            else:
                v = 0.16 + (0.45 - 0.16) * (f - c) / max(1, frames - c)
            ts[f] = v
    T = [0.0] * (frames + 2)
    for f in range(2, frames + 2):
        T[f] = T[f - 1] + ts[f] / fps
    return ts, [t - T[hit] for t in T]


def rock(rnd, r):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    for v in bm.verts:
        v.co *= rnd.uniform(0.6, 1.25)
    bmesh.ops.scale(bm, vec=(rnd.uniform(0.6, 1.3), rnd.uniform(0.6, 1.3), rnd.uniform(0.5, 1.0)), verts=bm.verts)
    return bm


def run(ctx):
    p = ctx.p
    rnd = random.Random(ctx.seed)
    models = ctx.model_paths()
    subject = p.e("subject", "tower", SUBJECTS)
    material = p.e("material", DEFAULT_MAT[subject], MATERIALS)
    pieces = p.i("pieces", 70, 12, 160)
    impact = p.e("impact", "ball", IMPACTS)
    slowmo = p.b("slowmo", False)
    dust_amt = p.f("dust", 1.0, 0.0, 2.0)
    debris_amt = p.f("debris", 1.0, 0.0, 2.0)
    power = p.f("strength", 1.0, 0.3, 2.0)
    text = p.text("text", "BOOM", 12)
    cam_az = math.radians(-30 if impact == "ball" else -24)
    to_cam = Vector((math.sin(cam_az), -math.cos(cam_az), 0))
    t = time.time()
    reset()
    scn = ctx.scene()
    fps, frames = ctx.fps, ctx.frames
    outer, inner = mats.SUBJECT_MATS[material]
    inner_m = inner()
    proxy = None
    if models:
        objs = geo.import_model(models[0], ctx.blog)
        ob = geo.join(objs, "Subject")
        geo.normalize([ob], 3.6)
        geo.decimate(ob, 30000)
        src_mats = [m for m in ob.data.materials if m] or [outer()]
        if not ob.data.materials:
            ob.data.materials.append(src_mats[0])
        bm0 = mesh_to_bm(ob.data)
        bmesh.ops.remove_doubles(bm0, verts=bm0.verts[:], dist=1e-4 * 3.6)
        bm0.to_mesh(ob.data)
        manifold = geo.is_manifold(ob.data)
        if not manifold:
            proxy = geo.watertight_proxy(ob)
        bpy.data.objects.remove(ob)
        subject = "model"
    else:
        bm0 = builtin(subject, text)
        src_mats = [outer()]
    inner_idx = len(src_mats)
    for f in bm0.faces:
        f.material_index = min(f.material_index, inner_idx - 1)
    inside = geo.Inside(proxy or bm0)
    lo = Vector((min(v.co.x for v in bm0.verts), min(v.co.y for v in bm0.verts), min(v.co.z for v in bm0.verts)))
    hi = Vector((max(v.co.x for v in bm0.verts), max(v.co.y for v in bm0.verts), max(v.co.z for v in bm0.verts)))
    H = hi.z - lo.z
    S = max(hi - lo)
    ctr = (lo + hi) / 2
    hit = max(int(0.5 * fps), int(frames * (0.2 if not slowmo else 0.24)))
    ts, T = time_curve(frames, fps, hit, slowmo)
    bdir = Vector((1, 0, 0))
    if impact == "ball":
        hz = lo.z + H * (0.42 if subject != "wall" else 0.5)
        hp = Vector((ctr.x, ctr.y, hz))
        for k in range(200):
            q = Vector((lo.x + (hi.x - lo.x) * k / 200, ctr.y, hz))
            if inside(q):
                hp = q
                break
        focus, fr = hp, S * 0.32
    elif impact == "explosion":
        hp = Vector((ctr.x, ctr.y, lo.z + H * 0.3))
        focus, fr = hp, S * 0.4
    elif impact == "quake":
        hp = Vector((ctr.x, ctr.y, lo.z + H * 0.15))
        focus, fr = Vector((ctr.x, ctr.y, lo.z + H * 0.25)), S * 0.5
    else:
        hp = Vector((ctr.x, ctr.y, lo.z + H * 0.55))
        focus, fr = hp, S * 0.25
    n_cells = pieces if impact != "slice" else max(12, pieces // 3)
    seeds = geo.voronoi_seeds(inside, lo, hi, n_cells, focus, fr, 0.55 if impact != "quake" else 0.2, rnd)
    if len(seeds) < 4:
        raise UserError("could not seed fracture (model too thin?)")
    if impact == "slice":
        nrm = Vector((-0.45, 0.1, 1)).normalized()
        cells = []
        for side in (1, -1):
            bm = bm0.copy()
            r = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=hp, plane_no=nrm * side, clear_outer=True)
            edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                for fc in bmesh.ops.triangle_fill(bm, use_beauty=True, edges=edges, normal=nrm)["geom"]:
                    if isinstance(fc, bmesh.types.BMFace):
                        fc.material_index = inner_idx
            sd = [q for q in seeds if (q - hp).dot(nrm) * side < 0]
            if len(bm.verts) >= 4 and sd:
                cells += [(i + (0 if side > 0 else 10000), b, {j + (0 if side > 0 else 10000): a for j, a in adj.items()}) for i, b, adj in geo.fracture(bm, sd, inner_idx)]
            bm.free()
    else:
        cells = geo.fracture(bm0, seeds, inner_idx)
    bm0.free()
    if proxy:
        proxy.free()
    coll = collection("Fracture")
    all_mats = src_mats + [inner_m]
    dens = DENSITY[material]
    chunks, by_seed, adjs = [], {}, {}
    for n, (i, cb, adj) in enumerate(cells):
        ob, vol = geo.cell_object(cb, f"chunk_{n:03d}", all_mats, coll)
        dims = ob.dimensions
        vol = max(vol, dims.x * dims.y * dims.z * 0.25)
        chunks.append((ob, vol * dens))
        by_seed[i], adjs[i] = ob, adj
    log(f"fracture {len(chunks)} pieces {time.time() - t:.1f}s")
    ctx.stats.update(pieces=len(chunks), subject=subject, material=material, impact=impact, slowmo=slowmo)

    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.5))
    gcol = bpy.context.active_object
    gcol.name = "GroundCollider"
    gcol.scale = (200, 200, 1)
    gcol.hide_render = True
    gcol.display_type = "WIRE"
    bpy.ops.rigidbody.world_add()
    rbw = scn.rigidbody_world
    rbw.point_cache.frame_start, rbw.point_cache.frame_end = 1, frames
    rbw.substeps_per_frame = 12
    rbw.solver_iterations = 24
    if slowmo:
        for f in range(1, frames + 1):
            rbw.time_scale = ts[f]
            kf(rbw, "time_scale", f, "LINEAR")
    bpy.ops.object.select_all(action="DESELECT")
    for ob, _ in chunks:
        ob.select_set(True)
    gcol.select_set(True)
    bpy.context.view_layer.objects.active = gcol
    bpy.ops.rigidbody.objects_add(type="ACTIVE")
    g = gcol.rigid_body
    g.type = "PASSIVE"
    g.friction = 0.85
    g.collision_shape = "BOX"
    g.collision_collections = [i in (0, 1) for i in range(20)]
    release = hit - 2 if impact == "ball" else hit
    for ob, m in chunks:
        rb = ob.rigid_body
        rb.collision_shape = "CONVEX_HULL"
        rb.mass = max(0.5, m)
        rb.friction = 0.6 if impact != "quake" else 0.35
        rb.restitution = 0.05 if material not in ("glass", "ice") else 0.15
        rb.use_margin = True
        rb.collision_margin = 0.003
        rb.linear_damping, rb.angular_damping = 0.08, 0.35
        rb.use_deactivation = True
        rb.deactivate_linear_velocity, rb.deactivate_angular_velocity = 0.15, 0.25
        rb.kinematic = True
        kf(rb, "kinematic", 1, "CONSTANT")
        if impact == "explosion":
            kf(ob, "location", hit - 1, "LINEAR")
            kf(ob, "rotation_euler", hit - 1, "LINEAR")
            d = ob.location - hp
            dist = d.length
            d = (d.normalized() if dist > 1e-4 else Vector((0, 0, 1)))
            fall = max(0.15, 1.0 - dist / (S * 0.9))
            v = (d * rnd.uniform(3.5, 6.5) * fall + Vector((0, 0, rnd.uniform(1, 3) * fall))) * power
            tc = v.dot(to_cam)
            if tc > 0:
                v -= to_cam * tc * 0.7
            dT = T[hit] - T[hit - 1]
            ob.location += v * dT
            ob.rotation_euler = Euler([a + rnd.uniform(-1, 1) * 12 * fall * dT for a in ob.rotation_euler])
            kf(ob, "location", hit, "LINEAR")
            kf(ob, "rotation_euler", hit, "LINEAR")
        elif impact == "slice" and (ob.location - hp).dot(nrm) > 0:
            kf(ob, "location", hit - 1, "LINEAR")
            slide = Vector((nrm.x, nrm.y, 0)).normalized() * -1.0
            slide = (slide - nrm * slide.dot(nrm)).normalized()
            ob.location += slide * 1.6 * power * (T[hit] - T[hit - 1])
            kf(ob, "location", hit, "LINEAR")
        rb.kinematic = False
        kf(rb, "kinematic", release + 1, "CONSTANT")
    nb = 0
    if impact != "explosion":
        K = 9000 * STRENGTH[material] * {"ball": 1.0, "quake": 0.3, "slice": 1.6}[impact] * p.f("bond", 1.0, 0.0, 3.0)
        if K > 0:
            nb = geo.bonds(by_seed, adjs, K, collection("Bonds"))
    ctx.stats["bonds"] = nb
    ctx.stats["concave"] = sum(1 for o, _ in chunks if o.get("concave"))
    ball = None
    extra = []
    if impact == "ball":
        r = min(0.5, max(0.2, 0.1 * H, 0.06 * S))
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r)
        me = bpy.data.meshes.new("Ball")
        bm.to_mesh(me)
        bm.free()
        for pl in me.polygons:
            pl.use_smooth = True
        ball = link(bpy.data.objects.new("Ball", me))
        me.materials.append(mats.iron())
        speed = 12.0 * power
        contact = hp - bdir * (r * 0.98)
        for f in range(1, release + 2):
            ball.location = contact - bdir * speed * (T[hit] - T[f])
            kf(ball, "location", f, "LINEAR")
        ball.select_set(True)
        bpy.context.view_layer.objects.active = ball
        bpy.ops.rigidbody.object_add(type="ACTIVE")
        brb = ball.rigid_body
        brb.collision_shape = "SPHERE"
        brb.mass = min(7800 * 4 / 3 * math.pi * r ** 3 * 0.8, 0.3 * sum(m for _, m in chunks))
        brb.friction, brb.restitution = 0.4, 0.1
        brb.kinematic = True
        kf(brb, "kinematic", release, "CONSTANT")
        brb.kinematic = False
        kf(brb, "kinematic", release + 1, "CONSTANT")
        extra.append(ball)
    if impact == "quake":
        amp = 0.05 * S / 4 * power
        dur = int(1.6 * fps / (0.35 if slowmo else 1))
        base = gcol.location.copy()
        g.kinematic = True
        kf(gcol, "location", hit, "LINEAR")
        ph = rnd.uniform(0, 6.28)
        for f in range(hit + 1, min(frames, hit + dur) + 1):
            tt = T[f]
            env = min(1.0, tt / 0.25) * max(0.0, 1.0 - tt / 1.6)
            gcol.location = base + Vector((math.sin(tt * 2 * math.pi * 2.3 + ph), 0.6 * math.sin(tt * 2 * math.pi * 3.1), 0.08 * math.sin(tt * 2 * math.pi * 5))) * amp * env
            kf(gcol, "location", f, "LINEAR")
    nd = int(36 * debris_amt) if impact != "quake" else int(14 * debris_amt)
    debris = []
    if nd:
        dcol = collection("Debris")
        dmesh = []
        for k in range(6):
            bm = rock(rnd, 1.0)
            me = bpy.data.meshes.new(f"rock{k}")
            bm.to_mesh(me)
            bm.free()
            me.materials.append(inner_m)
            dmesh.append(me)
        for k in range(nd):
            ob = bpy.data.objects.new(f"debris_{k:03d}", dmesh[k % 6])
            dcol.objects.link(ob)
            s = S * rnd.uniform(0.012, 0.03)
            ob.scale = (s, s, s)
            jitter = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))) * S * 0.04
            if impact == "ball":
                ob.location = hp + jitter + Vector((0.05 * S, 0, 0))
                v = (bdir * rnd.uniform(4, 9) + Vector((0, rnd.gauss(0, 2.5), rnd.uniform(0.5, 4.5)))) * power
            elif impact == "explosion":
                ob.location = hp + jitter
                d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), abs(rnd.gauss(0, 1)) + 0.3)).normalized()
                v = d * rnd.uniform(4, 8) * power
                v -= to_cam * max(0.0, v.dot(to_cam)) * 0.7
            elif impact == "slice":
                q = hp + Vector((rnd.uniform(-0.5, 0.5) * (hi.x - lo.x), rnd.uniform(-0.5, 0.5) * (hi.y - lo.y), 0))
                q.z = hp.z + (-(nrm.x * (q.x - hp.x) + nrm.y * (q.y - hp.y)) / nrm.z)
                ob.location = q
                v = Vector((rnd.gauss(0, 1.5), rnd.gauss(0, 1.5), rnd.uniform(0, 2.5)))
            else:
                ob.location = Vector((rnd.uniform(lo.x, hi.x) * 0.8, rnd.uniform(lo.y, hi.y) * 0.8, hi.z * rnd.uniform(0.6, 0.95)))
                v = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), 0))
            debris.append((ob, v))
        bpy.ops.object.select_all(action="DESELECT")
        for ob, _ in debris:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = debris[0][0]
        bpy.ops.rigidbody.objects_add(type="ACTIVE")
        for ob, v in debris:
            rb = ob.rigid_body
            rb.collision_shape = "CONVEX_HULL"
            rb.mass = 2.0
            rb.friction, rb.restitution = 0.7, 0.25
            rb.collision_collections = [i == 1 for i in range(20)]
            rb.use_margin, rb.collision_margin = True, 0.002
            rb.kinematic = True
            kf(rb, "kinematic", 1, "CONSTANT")
            ob.hide_render = True
            kf(ob, "hide_render", 1, "CONSTANT")
            ob.hide_render = False
            kf(ob, "hide_render", hit, "CONSTANT")
            kf(ob, "location", hit - 1, "LINEAR")
            ob.location += v * (T[hit] - T[hit - 1])
            kf(ob, "location", hit, "LINEAR")
            rb.kinematic = False
            kf(rb, "kinematic", hit + 1, "CONSTANT")
    t = time.time()
    with quiet(ctx.blog):
        with bpy.context.temp_override(scene=scn, point_cache=rbw.point_cache):
            bpy.ops.ptcache.bake(bake=True)
    log(f"bake {frames}f {time.time() - t:.1f}s")

    t = time.time()
    tracks = {ob.name: [] for ob, _ in chunks}
    for f in range(1, frames + 1):
        scn.frame_set(f)
        for ob, _ in chunks:
            tracks[ob.name].append(ob.matrix_world.translation.copy())
    if os.environ.get("PRODKIT_DEBUG"):
        for f in range(hit - 4, min(frames, hit + 12)):
            sp = sorted(((tracks[o.name][f] - tracks[o.name][f - 1]).length * fps, o.name) for o, _ in chunks)[-3:]
            log("dbg", f, [(round(a, 1), n) for a, n in sp])
        raise UserError("debug stop")
    pts = []
    for tr in tracks.values():
        pts += tr[hit::3]
    q = lambda arr, a: sorted(arr)[min(len(arr) - 1, max(0, int(a * len(arr))))]
    pq = 0.12 if impact == "explosion" else 0.06
    elo = Vector([q([v[i] for v in pts], pq) for i in range(3)])
    ehi = Vector([q([v[i] for v in pts], 1 - pq) for i in range(3)])
    elo = Vector(map(max, elo, lo - Vector((0.8 * S, 0.8 * S, 0))))
    ehi = Vector(map(min, ehi, hi + Vector((0.8 * S, 0.8 * S, 0.5 * S))))
    flo = Vector(map(min, lo, elo))
    fhi = Vector(map(max, hi, ehi))
    fhi.z = max(fhi.z, hi.z + 0.12 * H)
    flo.z = 0
    if impact == "ball":
        flo.x = min(flo.x, hp.x - 2.2 * r)
    if impact == "explosion":
        flo = Vector(map(min, flo, lo - Vector((0.45 * S, 0.45 * S, 0))))
        fhi = Vector(map(max, fhi, hi + Vector((0.45 * S, 0.45 * S, 0.35 * S))))

    dpts = []
    tint = mats.DUST_TINT[material]
    if material in ("glass", "ice"):
        dust_amt *= 0.35
    if dust_amt > 0:
        nb = int({"ball": 70, "explosion": 150, "quake": 30, "slice": 14}[impact] * dust_amt)
        for k in range(nb):
            if impact == "ball":
                pos = hp + Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))) * S * 0.04
                vel = bdir * rnd.uniform(1.5, 6) + Vector((rnd.gauss(0, 1.6), rnd.gauss(0, 1.6), rnd.gauss(0.4, 1.2)))
                if rnd.random() < 0.35:
                    vel = -bdir * rnd.uniform(1, 3.5) + Vector((rnd.gauss(0, 1.5), rnd.gauss(0, 1.5), rnd.gauss(0.2, 1)))
            elif impact == "explosion":
                pos = hp + Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1))) * S * 0.08
                d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), abs(rnd.gauss(0, 0.8)) + 0.15)).normalized()
                vel = d * rnd.uniform(2, 7)
            elif impact == "quake":
                a = rnd.uniform(0, 6.283)
                rr = max(hi.x - lo.x, hi.y - lo.y) * 0.55
                pos = Vector((ctr.x + math.cos(a) * rr, ctr.y + math.sin(a) * rr, 0.1))
                vel = Vector((math.cos(a), math.sin(a), 0.2)) * rnd.uniform(0.5, 2)
            else:
                pos = hp + Vector((rnd.uniform(-0.5, 0.5) * (hi.x - lo.x), rnd.uniform(-0.5, 0.5) * (hi.y - lo.y), 0))
                vel = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0.3, 0.5)))
            big = {"explosion": 1.6, "slice": 0.5}.get(impact, 1.0)
            dpts.append({"pos": pos, "vel": vel * power, "t0": rnd.uniform(0, 0.12 if impact != "quake" else 1.4),
                         "life": rnd.uniform(1.6, 3.2) * big, "size": S * rnd.uniform(0.035, 0.08) * big,
                         "drag": rnd.uniform(1.8, 3.2), "rise": rnd.uniform(0.03, 0.25)})
        cap = int(520 * dust_amt)
        for ob, m in chunks:
            tr = tracks[ob.name]
            hz = max(ob.dimensions) * 0.5
            for f in range(max(hit, 2), frames - 1):
                dT = max(1e-4, T[f] - T[f - 1])
                vz0 = (tr[f - 1].z - tr[f - 2].z) / dT
                vz1 = (tr[f].z - tr[f - 1].z) / dT
                if vz0 < -2.5 and vz1 > 0.35 * vz0 and tr[f - 1].z < hz + 0.25 * S / 4:
                    n = min(6, 1 + int(math.sqrt(m) / 6))
                    for _ in range(n):
                        if len(dpts) >= cap:
                            break
                        a = rnd.uniform(0, 6.283)
                        sp = rnd.uniform(0.8, 2.6) * min(2.0, -vz0 / 5)
                        dpts.append({"pos": Vector((tr[f - 1].x, tr[f - 1].y, 0.05)), "vel": Vector((math.cos(a) * sp, math.sin(a) * sp, rnd.uniform(0.2, 0.9))),
                                     "t0": T[f - 1] + rnd.uniform(0, 0.05), "life": rnd.uniform(1.8, 3.4), "size": max(hz * 1.2, S * 0.03) * rnd.uniform(0.6, 1.2),
                                     "drag": rnd.uniform(2.0, 3.5), "rise": rnd.uniform(0.05, 0.2)})
                    break
        dust = fx.dust(dpts, T[1:frames + 1], tint, 0.5)
        if dust:
            extra.append(dust)
    ctx.stats.update(dust_puffs=len(dpts), debris=len(debris))
    log(f"analyze+dust {len(dpts)} puffs {time.time() - t:.1f}s")

    if impact == "explosion":
        lt = bpy.data.lights.new("Flash", "POINT")
        lt.color = (1.0, 0.55, 0.22)
        lt.shadow_soft_size = 0.4 * S
        fl = link(bpy.data.objects.new("Flash", lt))
        fl.location = hp + Vector((0, 0, 0.1 * S))
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=1.0)
        me = bpy.data.meshes.new("Fireball")
        bm.to_mesh(me)
        bm.free()
        for pl in me.polygons:
            pl.use_smooth = True
        fb = link(bpy.data.objects.new("Fireball", me))
        fb.location = hp
        m, b = mats.new("fireball")
        v = b("ShaderNodeTexCoord").outputs["Object"]
        nz = b("ShaderNodeTexNoise", v, i_Scale=3.0, i_Detail=6, i_Distortion=1.5)
        col = b.ramp(nz.outputs["Fac"], [(0.3, (0.6, 0.08, 0.01)), (0.55, (1.0, 0.45, 0.08)), (0.75, (1.0, 0.85, 0.5))])
        em = b("ShaderNodeEmission", col, i_Strength=0.0)
        lw = b("ShaderNodeLayerWeight", i_Blend=0.4)
        a = b.math("POWER", b.math("SUBTRACT", 1.0, lw.outputs["Facing"], True), 1.5)
        mx = b("ShaderNodeMixShader", b.math("MULTIPLY", a, nz.outputs["Fac"]), b("ShaderNodeBsdfTransparent"), em)
        b("ShaderNodeOutputMaterial", mx)
        me.materials.append(m)
        fb.visible_shadow = False
        es = em.inputs["Strength"]
        for f in range(hit - 1, frames + 1):
            tt = max(0.0, T[f])
            k = tt / 0.35
            on = f >= hit and k < 1
            sc = S * 0.45 * (min(1, k * 3) ** 0.5) if on else 0.001
            fb.scale = (sc, sc, sc * 0.85)
            kf(fb, "scale", f, "LINEAR")
            es.default_value = 30 * (1 - k) ** 2 if on else 0
            kf(es, "default_value", f, "LINEAR")
            lt.energy = 6e4 * (S / 4) ** 2 * (1 - k) ** 2 if on else 0
            kf(lt, "energy", f, "LINEAR")
    if impact == "slice":
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
        me = bpy.data.meshes.new("Blade")
        bm.to_mesh(me)
        bm.free()
        blade = link(bpy.data.objects.new("Blade", me))
        blade.rotation_euler = nrm.to_track_quat("Z", "X").to_euler()
        blade.scale = (0.02 * S, S * 0.9, 1)
        me.materials.append(mats.emission("blade", (0.7, 0.85, 1.0), 40))
        tang = Vector((1, 0, 0)) - nrm * nrm.x
        tang.normalize()
        blade.hide_render = True
        kf(blade, "hide_render", 1, "CONSTANT")
        for f, u in ((hit - 3, -1.2), (hit, 1.2)):
            blade.location = hp + tang * S * u
            blade.hide_render = False
            kf(blade, "location", f, "LINEAR")
        kf(blade, "hide_render", hit - 3, "CONSTANT")
        blade.hide_render = True
        kf(blade, "hide_render", hit + 1, "CONSTANT")
        blade.visible_shadow = False

    cpts = stage.corners(flo, fhi)
    cam, rig, tgt, D = stage.camera_rig(ctx, cpts, cam_az - math.radians(5), cam_az + math.radians(7), math.radians(9),
                                        lens=38, dolly=(0.94, 1.02), margin=1.06, fstop=5.6)
    amp = {"ball": 0.012, "explosion": 0.03, "quake": 0.02, "slice": 0.006}[impact] * S
    stage.shake(tgt, hit, int(0.5 * fps) if impact != "quake" else int(1.5 * fps / (0.35 if slowmo else 1)), amp, ctx.seed, 0.88)
    stage.stage(ctx.background, ctr, max(S, (fhi - flo).length * 0.6), cam_az)
    setup_render(ctx, "CYCLES", motion_blur=True, transparent_bounces=24)
    ctx.poster_frame = hit + int((0.35 if not slowmo else 1.1) * fps)
    save_blend(ctx)
    render(ctx)
    return export_glb(ctx, [o for o, _ in chunks] + [o for o, _ in debris] + ([ball] if ball else []))
