import bpy, math, time
from mathutils import Vector, Euler
from lib.core import log, kf, link, UserError, reset, setup_render, save_blend, render, export_glb, hexrgb, P
from lib import mats, stage, geo
from recipes.toon_shader import toonify, outline_mat, STYLE

TYPES = ("cube", "sphere", "cylinder", "cone", "torus", "plane", "text", "model")
LIGHTS = ("sun", "area", "point", "spot")
WPRESETS = ("studio", "sky", "night", "sunset", "dark", "white")
INTERP = {"bezier": "BEZIER", "linear": "LINEAR", "constant": "CONSTANT"}
MAXO, MAXK, MAXL = 64, 64, 16


def prim(t, q):
    ops = {"cube": lambda: bpy.ops.mesh.primitive_cube_add(size=1),
           "sphere": lambda: bpy.ops.mesh.primitive_uv_sphere_add(radius=0.5, segments=48, ring_count=24),
           "cylinder": lambda: bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=1, vertices=48),
           "cone": lambda: bpy.ops.mesh.primitive_cone_add(radius1=0.5, depth=1, vertices=48),
           "torus": lambda: bpy.ops.mesh.primitive_torus_add(major_radius=0.4, minor_radius=0.4 * q.f("thickness", 0.3, 0.01, 0.95), major_segments=96, minor_segments=24),
           "plane": lambda: bpy.ops.mesh.primitive_plane_add(size=1)}
    ops[t]()
    ob = bpy.context.active_object
    if t in ("sphere", "cylinder", "cone", "torus"):
        for pl in ob.data.polygons:
            pl.use_smooth = True
    bv = q.f("bevel", 0.0, 0.0, 0.5)
    if bv and t in ("cube", "cylinder", "cone"):
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width, m.segments = bv, 4
        for pl in ob.data.polygons:
            pl.use_smooth = True
        ob.modifiers.new("wn", "WEIGHTED_NORMAL")
    return ob


def text_obj(q):
    cu = bpy.data.curves.new("Text", "FONT")
    cu.body = q.text("text", "Text", 64)
    cu.extrude = q.f("extrude", 0.08, 0.0, 2.0)
    cu.bevel_depth = q.f("bevel", 0.01, 0.0, 0.2)
    cu.size = q.f("size", 1.0, 0.05, 20.0)
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    ob = link(bpy.data.objects.new("Text", cu))
    return ob


def apply_tf(ob, q, d):
    if "location" in d:
        ob.location = q.vec("location", (0, 0, 0), -500, 500, d=d)
    if "rotation" in d:
        ob.rotation_euler = Euler([math.radians(a) for a in q.vec("rotation", (0, 0, 0), -36000, 36000, d=d)])
    if "scale" in d:
        v = d.get("scale")
        if isinstance(v, (int, float)) and not isinstance(v, bool):
            s = q.f("scale", 1, 0.001, 100, d=d)
            ob.scale = (s, s, s)
        else:
            ob.scale = q.vec("scale", (1, 1, 1), 0.001, 100, d=d)


def keyframes(ob, q, keys, F, interp, cam=False, tgt=None):
    if not isinstance(keys, list):
        return 0
    n = 0
    for k in keys[:MAXK]:
        if not isinstance(k, dict):
            continue
        f = q.i("frame", 1, 1, F, d=k)
        if cam:
            if "location" in k:
                ob.location = q.vec("location", (0, 0, 0), -500, 500, d=k)
                kf(ob, "location", f, interp)
            if "look_at" in k and tgt is not None:
                tgt.location = q.vec("look_at", (0, 0, 0), -500, 500, d=k)
                kf(tgt, "location", f, interp)
            if "lens" in k:
                ob.data.lens = q.f("lens", 50, 8, 300, d=k)
                kf(ob.data, "lens", f, interp)
        else:
            for key, path in (("location", "location"), ("rotation", "rotation_euler"), ("scale", "scale")):
                if key in k:
                    apply_tf(ob, q, {key: k[key]})
                    kf(ob, path, f, interp)
        n += 1
    return n


def material(name, md, toon, eevee, st):
    m = mats.from_spec(name, md)
    if toon:
        toonify(m, st, 3, stage.sph(math.radians(-60), math.radians(48), 1), eevee, None, True)
    return m


def run(ctx):
    p = ctx.p
    t = time.time()
    spec = p.d.get("spec")
    if not isinstance(spec, dict):
        raise UserError("params.spec must be an object")
    q = P(spec)
    if "frames" in spec:
        ctx.frames = q.i("frames", ctx.frames, 24, 240)
    if "fps" in spec:
        ctx.fps = q.i("fps", ctx.fps, 12, 30)
    F = ctx.frames
    objs_spec = [o for o in (spec.get("objects") or [])[:MAXO] if isinstance(o, dict)] if isinstance(spec.get("objects"), list) else []
    if not objs_spec:
        raise UserError("spec.objects is empty")
    lights_spec = [l for l in (spec.get("lights") or [])[:MAXL] if isinstance(l, dict)] if isinstance(spec.get("lights"), list) else []
    anytoon = any(isinstance(o.get("material"), dict) and o["material"].get("toon") is True for o in objs_spec)
    engine = p.e("engine", "auto", ("auto", "cycles", "eevee"))
    engine = ("EEVEE" if anytoon else "CYCLES") if engine == "auto" else engine.upper()
    reset()
    scn = ctx.scene()
    setup_render(ctx, engine, motion_blur=q.b("motion_blur", True))
    eevee = ctx.engine == "EEVEE"
    st = dict(STYLE[p.e("toon_style", "cel", tuple(STYLE))])
    models = ctx.model_paths()
    cache = {}
    made, nkeys, om = [], 0, None
    for i, od in enumerate(objs_spec):
        oq = P(od)
        typ = oq.e("type", "cube", TYPES)
        if typ == "model":
            mi = oq.i("model_index", 0, 0, 15)
            if mi >= len(models):
                raise UserError(f"objects[{i}].model_index out of range")
            if mi not in cache:
                parts = geo.import_model(models[mi], ctx.blog)
                ob0 = geo.join(parts, f"Model{mi}")
                geo.normalize([ob0], 1.0, ground=False)
                geo.decimate(ob0, 400000 // max(1, len(models)))
                cache[mi] = ob0
                ob = ob0
            else:
                ob = link(bpy.data.objects.new(f"Model{mi}", cache[mi].data))
        elif typ == "text":
            ob = text_obj(oq)
        else:
            ob = prim(typ, oq)
        nm = oq.text("name", "", 32)
        if nm:
            ob.name = nm
        apply_tf(ob, oq, od)
        md = od.get("material")
        if isinstance(md, dict) or typ != "model":
            toon = isinstance(md, dict) and md.get("toon") is True
            m = material(f"mat_{i}", md if isinstance(md, dict) else {}, toon, eevee, st)
            if typ == "model":
                ob.data = ob.data.copy()
                ob.data.materials.clear()
            ob.data.materials.append(m)
            if toon and ob.type == "MESH" and typ != "plane":
                om = om or outline_mat((0.01, 0.01, 0.015))
                ob.data.materials.append(om)
                sm = ob.modifiers.new("Outline", "SOLIDIFY")
                sm.thickness, sm.offset, sm.use_flip_normals, sm.use_rim = 0.012 * max(ob.scale), 1.0, True, False
                sm.material_offset = len(ob.data.materials) - 1
        interp = INTERP.get(oq.e("interpolation", "bezier", tuple(INTERP)), "BEZIER")
        if isinstance(od.get("keyframes"), list) and od["keyframes"]:
            for path in ("location", "rotation_euler", "scale"):
                kf(ob, path, 1, interp)
            nkeys += keyframes(ob, oq, od["keyframes"], F, interp)
            apply_tf(ob, oq, od)
        made.append(ob)
    for o in made:
        o.select_set(False)
    wd = spec.get("world") if isinstance(spec.get("world"), dict) else {}
    wq = P(wd)
    preset = wq.e("preset", ctx.background, WPRESETS)
    floor = q.b("floor", True)
    bpy.context.view_layer.update()
    lo, hi = stage.bbox(made)
    size = max(max(hi - lo), 0.5)
    ctr = (lo + hi) / 2
    cd = spec.get("camera") if isinstance(spec.get("camera"), dict) else {}
    cq = P(cd)
    if cd.get("location"):
        camd = bpy.data.cameras.new("Camera")
        camd.lens = cq.f("lens", 50, 8, 300)
        camd.clip_end = 2000
        cam = link(bpy.data.objects.new("Camera", camd))
        cam.location = cq.vec("location", (0, -10, 3), -500, 500)
        tgt = link(bpy.data.objects.new("CamTarget", None))
        tgt.location = cq.vec("look_at", tuple(ctr), -500, 500)
        tc = cam.constraints.new("TRACK_TO")
        tc.target, tc.track_axis, tc.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"
        if "fstop" in cd:
            camd.dof.use_dof, camd.dof.focus_object, camd.dof.aperture_fstop = True, tgt, cq.f("fstop", 4, 0.5, 64)
        ci = INTERP.get(cq.e("interpolation", "bezier", tuple(INTERP)), "BEZIER")
        if isinstance(cd.get("keyframes"), list) and cd["keyframes"]:
            kf(cam, "location", 1, ci)
            kf(tgt, "location", 1, ci)
            nkeys += keyframes(cam, cq, cd["keyframes"], F, ci, cam=True, tgt=tgt)
        scn.camera = cam
        cam_az = math.atan2(cam.location.x - ctr.x, -(cam.location.y - ctr.y))
    else:
        cam_az = math.radians(-30)
        stage.camera_rig(ctx, stage.corners(lo, hi), cam_az - math.radians(6), cam_az + math.radians(6), math.radians(16), lens=50, dolly=(1.02, 0.96), margin=1.12)
    sp = preset if preset in ("studio", "sky", "dark", "white") else ("dark" if preset == "night" else "sky")
    auto = stage.stage(sp, ctr, size, cam_az, floor=floor and not q.b("no_floor", False))
    if floor and lo.z < -0.01:
        for o in auto:
            if o.name in ("Backdrop", "Ground"):
                o.location.z = lo.z
    if lights_spec:
        for o in auto:
            if o.type == "LIGHT":
                bpy.data.objects.remove(o)
    if preset in ("night", "sunset"):
        stage.world(preset)
    if "color" in wd:
        stage.world("flat", color=wq.c("color", (0.4, 0.4, 0.4)), strength=wq.f("strength", 1.0, 0, 20))
    elif "strength" in wd and scn.world:
        for n in scn.world.node_tree.nodes:
            if n.bl_idname == "ShaderNodeBackground":
                n.inputs["Strength"].default_value = wq.f("strength", 1.0, 0, 20)
    for i, ld in enumerate(lights_spec):
        lq = P(ld)
        lt = lq.e("type", "area", LIGHTS)
        l = bpy.data.lights.new(f"Light{i}", lt.upper())
        l.color = lq.c("color", (1, 1, 1))
        l.energy = lq.f("energy", 4 if lt == "sun" else 500, 0, 20 if lt == "sun" else 1e5)
        if lt == "area":
            l.size = lq.f("size", 2, 0.01, 100)
        elif lt in ("point", "spot"):
            l.shadow_soft_size = lq.f("size", 0.25, 0, 50)
        if lt == "spot":
            l.spot_size = math.radians(lq.f("spot_size", 45, 1, 180))
        ob = link(bpy.data.objects.new(f"Light{i}", l))
        ob.location = lq.vec("location", (4, -4, 6), -500, 500)
        if "look_at" in ld or "rotation" not in ld:
            d = Vector(lq.vec("look_at", tuple(ctr), -500, 500)) - ob.location
            ob.rotation_euler = (d if d.length > 1e-6 else Vector((0, 0, -1))).to_track_quat("-Z", "Y").to_euler()
        else:
            ob.rotation_euler = Euler([math.radians(a) for a in lq.vec("rotation", (0, 0, 0), -3600, 3600)])
    ctx.stats.update(objects=len(made), lights=len(lights_spec), keyframes=nkeys, world=preset, toon=anytoon)
    log(f"scene {len(made)} objs {nkeys} keys {time.time() - t:.1f}s")
    ctx.poster_frame = F // 2
    save_blend(ctx)
    render(ctx)
    return export_glb(ctx, made)
