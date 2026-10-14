import bpy, math, time
from mathutils import Vector, Matrix
from lib.core import log, kf, link, UserError, reset, setup_render, save_blend, render, export_glb, hexrgb
from lib import mats, stage, geo, props
from lib.mats import NB

STYLES = ("cel", "anime", "comic", "flat")
DEMOS = {"character": props.character, "camera": props.camera, "headphones": props.headphones, "watch": props.watch}
BG = {"studio": ((0.62, 0.66, 0.72), (0.5, 0.54, 0.6)), "dark": ((0.03, 0.035, 0.07), (0.05, 0.055, 0.1)),
      "sky": ((0.35, 0.62, 0.95), (0.55, 0.75, 0.55)), "white": ((0.95, 0.95, 0.95), (0.85, 0.85, 0.86))}
STYLE = {"cel": dict(bands=3, shadow=(0.55, 0.55, 0.7), spec=0.5, rim=0.35, dots=False, sat=1.0, ow=1.0),
         "anime": dict(bands=2, shadow=(0.62, 0.55, 0.8), spec=0.7, rim=0.6, dots=False, sat=1.12, ow=0.8),
         "comic": dict(bands=3, shadow=(0.4, 0.38, 0.48), spec=0.9, rim=0.0, dots=True, sat=1.25, ow=2.0),
         "flat": dict(bands=2, shadow=(0.8, 0.8, 0.88), spec=0.0, rim=0.0, dots=False, sat=1.0, ow=1.0)}


def base_source(m):
    if not m or not m.node_tree:
        return None, (0.7, 0.7, 0.7)
    bs = next((n for n in m.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    if not bs:
        return None, (0.7, 0.7, 0.7)
    inp = bs.inputs["Base Color"]
    if inp.is_linked:
        return inp.links[0].from_socket, None
    return None, tuple(inp.default_value[:3])


def toonify(m, st, bands, light_dir, eevee, palette_col, rim_on):
    sock, col = base_source(m)
    if palette_col is not None:
        sock, col = None, palette_col
    tree = m.node_tree
    for n in list(tree.nodes):
        if n.bl_idname == "ShaderNodeOutputMaterial":
            tree.nodes.remove(n)
    b = NB(tree, clear=False)
    base = sock if sock is not None else b("ShaderNodeRGB").outputs[0]
    if sock is None:
        base.default_value = (*col, 1)
    if st["sat"] != 1.0:
        base = b("ShaderNodeHueSaturation", i_Saturation=st["sat"], i_Color=base).outputs[0]
    if eevee:
        lit = b("ShaderNodeRGBToBW", b("ShaderNodeShaderToRGB", b("ShaderNodeBsdfDiffuse", i_Color=(1, 1, 1))).outputs[0]).outputs[0]
    else:
        nrm = b("ShaderNodeNewGeometry").outputs["Normal"]
        lit = b("ShaderNodeMath", b.vmath("DOT_PRODUCT", nrm, tuple(light_dir)).outputs["Value"], 0.5, 0.5, operation="MULTIPLY_ADD")
    lv = [0.0] + [k / (bands - 1) for k in range(1, bands)]
    stops = [(0.0, (lv[0],) * 3)] + [(0.06 + 0.5 * k / bands if eevee else 0.25 + 0.55 * k / bands, (lv[k],) * 3) for k in range(1, bands)]
    ramp = b.ramp(lit, stops, "CONSTANT").outputs[0]
    shade = b.mix(ramp, st["shadow"], (1, 1, 1))
    c = b.mix(1.0, base, shade, "MULTIPLY")
    if st["dots"]:
        win = b("ShaderNodeTexCoord").outputs["Window"]
        r = bpy.context.scene.render
        uv = b.vmath("MULTIPLY", win, (70.0 * r.resolution_x / r.resolution_y, 70.0, 1.0))
        rot = b("ShaderNodeVectorRotate", uv, rotation_type="Z_AXIS", i_Angle=math.radians(30))
        fr = b.vmath("SUBTRACT", b.vmath("FRACTION", rot), (0.5, 0.5, 0.0))
        d = b("ShaderNodeSeparateXYZ", fr)
        ln = b.math("SQRT", b.math("ADD", b.math("MULTIPLY", d.outputs[0], d.outputs[0]), b.math("MULTIPLY", d.outputs[1], d.outputs[1])))
        dark = b.math("SUBTRACT", 1.0, b("ShaderNodeRGBToBW", ramp).outputs[0])
        dot = b.math("LESS_THAN", ln, b.math("ADD", b.math("MULTIPLY", dark, 0.5), 0.08))
        c = b.mix(b.math("MULTIPLY", dot, 0.55), c, (0.02, 0.02, 0.04))
    if st["spec"] and eevee:
        g = b("ShaderNodeRGBToBW", b("ShaderNodeShaderToRGB", b("ShaderNodeBsdfGlossy", i_Roughness=0.25)).outputs[0]).outputs[0]
        hl = b.math("GREATER_THAN", g, 0.55)
        c = b.mix(b.math("MULTIPLY", hl, st["spec"] * 0.6), c, (1, 1, 1))
    if rim_on and st["rim"]:
        lw = b("ShaderNodeLayerWeight", i_Blend=0.35)
        rim = b.math("GREATER_THAN", lw.outputs["Facing"], 0.72)
        rim = b.math("MULTIPLY", rim, b.math("MULTIPLY", ramp_bw(b, ramp), st["rim"]))
        c = b.mix(rim, c, (1.0, 0.97, 0.9), "SCREEN")
    em = b("ShaderNodeEmission", i_Color=c, i_Strength=1.0)
    b("ShaderNodeOutputMaterial", em)
    return m


def ramp_bw(b, ramp):
    return b("ShaderNodeRGBToBW", ramp).outputs[0]


def outline_mat(color):
    m, b = mats.new("toon_outline")
    em = b("ShaderNodeEmission", i_Color=color, i_Strength=1.0)
    tr = b("ShaderNodeBsdfTransparent")
    lp = b("ShaderNodeLightPath")
    hide = b.math("MAXIMUM", b("ShaderNodeNewGeometry").outputs["Backfacing"], lp.outputs["Is Shadow Ray"])
    b("ShaderNodeOutputMaterial", b("ShaderNodeMixShader", hide, em, tr))
    m.use_backface_culling = True
    m.use_backface_culling_shadow = True
    return m


def run(ctx):
    p = ctx.p
    t = time.time()
    style = p.e("style", "cel", STYLES)
    st = dict(STYLE[style])
    bands = p.i("bands", st["bands"], 2, 5)
    ow = p.f("outline_width", st["ow"], 0.0, 5.0)
    ocol = p.c("outline_color", (0.01, 0.01, 0.015))
    rim_on = p.b("rim", True)
    pal = p.d.get("palette")
    pal = [hexrgb(x) for x in pal[:16] if hexrgb(x)] if isinstance(pal, list) else []
    turntable = p.b("turntable", True)
    spin = p.f("turntable_degrees", 120, 0, 720)
    demo = p.e("demo", "character", DEMOS)
    reset()
    scn = ctx.scene()
    models = ctx.model_paths()
    if models:
        objs = []
        for mp in models[:8]:
            objs += geo.import_model(mp, ctx.blog)
        subject = "model"
    else:
        objs, _ = DEMOS[demo]()
        subject = demo
    geo.normalize(objs, 3.0, ground=True)
    for o in objs:
        geo.decimate(o, max(5000, 400000 // len(objs)))
    lo, hi = geo.bounds(objs)
    size = max(hi - lo)
    setup_render(ctx, "EEVEE", motion_blur=False)
    eevee = ctx.engine == "EEVEE"
    scn.view_settings.view_transform = "Standard"
    try:
        scn.view_settings.look = "None"
    except TypeError:
        pass
    az = math.radians(-28)
    key_dir = stage.sph(az - math.radians(50), math.radians(48), 1)
    mats_seen = []
    for o in objs:
        if not o.data.materials:
            o.data.materials.append(mats.principled("toon_default", (0.75, 0.75, 0.78)))
        for k, m in enumerate(o.data.materials):
            if m and m not in mats_seen:
                mats_seen.append(m)
    for k, m in enumerate(mats_seen):
        toonify(m, st, bands, key_dir, eevee, pal[k % len(pal)] if pal else None, rim_on)
    om = outline_mat(ocol)
    if ow > 0:
        for o in objs:
            o.data.materials.append(om)
            sm = o.modifiers.new("Outline", "SOLIDIFY")
            sm.thickness = size * 0.0045 * ow
            sm.offset = 1.0
            sm.use_flip_normals = True
            sm.use_rim = False
            sm.material_offset = len(o.data.materials) - 1
            sm.use_quality_normals = True
    for o in objs:
        for pl in o.data.polygons:
            pl.use_smooth = True
    pivot = link(bpy.data.objects.new("Turntable", None))
    for o in objs:
        o.parent = pivot
    F = ctx.frames
    az = math.radians(-28)
    if turntable and spin > 0:
        pivot.rotation_euler.z = az - math.radians(spin) / 2
        kf(pivot, "rotation_euler", 1, "LINEAR", index=2)
        pivot.rotation_euler.z = az + math.radians(spin) / 2
        kf(pivot, "rotation_euler", F, "LINEAR", index=2)
    else:
        pivot.rotation_euler.z = az * 0.5
    if subject == "character" and p.b("bounce", True):
        for k in range(0, F + 1, 6):
            ph = (k / ctx.fps) * 2 * math.pi * 1.0
            pivot.location.z = abs(math.sin(ph)) * size * 0.06
            pivot.scale = (1 + 0.03 * math.cos(2 * ph), 1 + 0.03 * math.cos(2 * ph), 1 - 0.04 * math.cos(2 * ph))
            kf(pivot, "location", k + 1, index=2)
            kf(pivot, "scale", k + 1)
    r = max(Vector((max(abs(lo.x), abs(hi.x)), max(abs(lo.y), abs(hi.y)), 0)).length, 0.1)
    pts = [Vector((math.cos(a) * r, math.sin(a) * r, z)) for a in [k * math.pi / 8 for k in range(16)] for z in (lo.z, hi.z * 1.08)] if turntable else stage.corners(lo, hi)
    cam, rig, tgt, D = stage.camera_rig(ctx, pts, az - math.radians(3), az + math.radians(3), math.radians(10), lens=50, dolly=(1.03, 0.97), margin=1.05)
    bgc, flc = BG[ctx.background]
    w = bpy.data.worlds.new("World")
    scn.world = w
    b = NB(w.node_tree)
    lp = b("ShaderNodeLightPath")
    bg = b("ShaderNodeBackground", i_Color=bgc, i_Strength=1.0)
    amb = b("ShaderNodeBackground", i_Color=(1, 1, 1), i_Strength=0.25)
    b("ShaderNodeOutputWorld", b("ShaderNodeMixShader", lp.outputs["Is Camera Ray"], amb, bg))
    bpy.ops.mesh.primitive_plane_add(size=size * 60)
    fl = bpy.context.active_object
    fl.name = "Floor"
    fm = mats.principled("toon_floor", flc)
    toonify(fm, dict(st, spec=0.0, rim=0.0, dots=False, sat=1.0), 2, key_dir, eevee, None, False)
    fl.data.materials.append(fm)
    s, _ = stage.sun("Key", az - math.radians(50), math.radians(48), 3.2, 1.5, (1, 0.98, 0.95))
    s.data.use_shadow = True
    ctx.stats.update(style=style, bands=bands, subject=subject, materials=len(mats_seen), engine_toon="shader_to_rgb" if eevee else "ndotl")
    log(f"toon {len(mats_seen)} mats {time.time() - t:.1f}s")
    ctx.poster_frame = int(F * 0.3)
    save_blend(ctx)
    render(ctx)
    return export_glb(ctx, objs + [pivot])
