import bpy, bmesh, math
from mathutils import Vector, Matrix
from .core import link
from .mats import principled, new, finish


def M(name, col, rough=0.4, metal=0.0, **kw):
    m = bpy.data.materials.get(name)
    return m or principled(name, col, rough, metal, **kw)


def mats():
    return {
        "black": M("matte_black", (0.02, 0.02, 0.022), 0.45),
        "leather": _leather(),
        "steel": M("steel", (0.75, 0.75, 0.76), 0.22, 1.0),
        "dark_steel": M("gunmetal", (0.18, 0.18, 0.2), 0.3, 1.0),
        "brass": M("brass", (0.9, 0.62, 0.28), 0.25, 1.0),
        "glass": M("lens_glass", (0.85, 0.92, 1.0), 0.0, 0.0, Transmission_Weight=1.0, IOR=1.5),
        "rubber": M("rubber", (0.03, 0.03, 0.03), 0.75),
        "red": M("accent_red", (0.75, 0.04, 0.02), 0.35),
        "dial": M("dial_blue", (0.01, 0.04, 0.16), 0.3, 0.6),
        "white": M("white_plastic", (0.8, 0.8, 0.78), 0.35),
        "cream": M("cream", (0.85, 0.76, 0.6), 0.5),
        "strap": M("strap", (0.18, 0.08, 0.035), 0.55),
        "orange": M("orange", (0.9, 0.3, 0.03), 0.4),
    }


def _leather():
    m = bpy.data.materials.get("leatherette")
    if m:
        return m
    m, b = new("leatherette")
    n = b("ShaderNodeTexVoronoi", b("ShaderNodeTexCoord").outputs["Object"], i_Scale=60)
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=(0.025, 0.025, 0.025), i_Roughness=0.6)
    return finish(m, b, bs, b("ShaderNodeBump", i_Strength=0.25, i_Height=n.outputs["Distance"]))


def part(name, op, mat, bevel=0.0, smooth=True, scale=None, **kw):
    getattr(bpy.ops.mesh, op)(**kw)
    ob = bpy.context.active_object
    if scale:
        ob.scale = scale
    ob.name = name
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width, m.segments, m.limit_method = bevel, 3, "ANGLE"
    ob.data.materials.append(mat)
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
        try:
            ob.modifiers.new("ws", "WEIGHTED_NORMAL")
        except Exception:
            pass
    return ob


def bake(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), depsgraph=dg)
        me.transform(o.matrix_world)
        n = link(bpy.data.objects.new(o.name, me))
        n["dir"] = o.get("dir", (0, 0, 0))
        out.append(n)
    for o in objs:
        bpy.data.objects.remove(o)
    return out


def gear(name, mat, teeth, r, depth, loc):
    bm = bmesh.new()
    vs = []
    for k in range(teeth * 4):
        a = 2 * math.pi * k / (teeth * 4)
        rr = r if (k % 4) in (0, 1) else r * 0.86
        vs.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr, 0)))
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.location = loc
    me.materials.append(mat)
    return ob


def camera():
    m = mats()
    P = []
    def add(o, d):
        o["dir"] = d
        P.append(o)
    add(part("Body", "primitive_cube_add", m["leather"], 0.04, size=1, location=(0, 0, 0.42), scale=(1.4, 0.5, 0.72)), (0, 0.35, 0))
    add(part("TopPlate", "primitive_cube_add", m["steel"], 0.03, size=1, location=(0, 0, 0.86), scale=(1.4, 0.5, 0.16)), (0, 0, 0.9))
    add(part("Viewfinder", "primitive_cube_add", m["black"], 0.03, size=1, location=(0, 0.02, 1.04), scale=(0.42, 0.42, 0.22)), (0, 0, 1.6))
    add(part("ModeDial", "primitive_cylinder_add", m["steel"], 0.01, vertices=48, radius=0.13, depth=0.08, location=(-0.45, 0.02, 0.98)), (-0.3, 0, 1.3))
    add(part("Shutter", "primitive_cylinder_add", m["red"], 0.008, vertices=32, radius=0.06, depth=0.06, location=(0.48, -0.05, 0.97)), (0.3, 0, 1.4))
    add(part("Mount", "primitive_cylinder_add", m["steel"], 0.01, vertices=64, radius=0.33, depth=0.06, location=(0, -0.28, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -0.5, 0))
    add(part("Grip", "primitive_cylinder_add", m["rubber"], 0.01, vertices=96, radius=0.31, depth=0.22, location=(0, -0.42, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -1.0, 0))
    add(part("Barrel", "primitive_cylinder_add", m["dark_steel"], 0.01, vertices=64, radius=0.29, depth=0.2, location=(0, -0.63, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -1.5, 0))
    add(part("RedRing", "primitive_torus_add", m["red"], 0, major_radius=0.29, minor_radius=0.012, location=(0, -0.74, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -1.75, 0))
    for k, y in enumerate((-0.5, -0.62, -0.74)):
        add(part(f"Element{k}", "primitive_cylinder_add", m["glass"], 0.008, vertices=64, radius=0.24, depth=0.035, location=(0, y, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -1.9 - 0.45 * k, 0.0))
    add(part("Hood", "primitive_cylinder_add", m["black"], 0.01, vertices=64, radius=0.31, depth=0.07, location=(0, -0.77, 0.42), rotation=(math.pi / 2, 0, 0)), (0, -3.4, 0))
    add(part("Battery", "primitive_cube_add", m["orange"], 0.015, size=1, location=(0.42, 0.05, 0.38), scale=(0.28, 0.2, 0.5)), (0.4, 0, -1.1))
    add(part("Card", "primitive_cube_add", m["black"], 0.004, size=1, location=(0.2, 0.05, 0.35), scale=(0.16, 0.02, 0.2)), (0.1, 0, -1.4))
    add(part("Screen", "primitive_cube_add", m["glass"], 0.01, size=1, location=(0, 0.26, 0.44), scale=(0.9, 0.03, 0.55)), (0, 1.0, 0))
    return bake(P), {"axis": "forward", "lift": 0.0}


def watch():
    m = mats()
    P = []
    def add(o, d):
        o["dir"] = d
        P.append(o)
    add(part("CaseBack", "primitive_cylinder_add", m["steel"], 0.02, vertices=96, radius=1.0, depth=0.14, location=(0, 0, 0.07)), (0, 0, -1.2))
    add(part("Movement", "primitive_cylinder_add", m["brass"], 0.01, vertices=96, radius=0.86, depth=0.1, location=(0, 0, 0.19)), (0, 0, -0.4))
    for k, (r, n, x, y) in enumerate(((0.32, 18, -0.25, 0.2), (0.22, 12, 0.3, 0.25), (0.26, 14, 0.05, -0.32))):
        g = gear(f"Gear{k}", m["brass"] if k != 1 else m["steel"], n, r, 0.05, (x, y, 0.24 + 0.012 * k))
        add(g, (x * 0.8, y * 0.8, 0.25 + 0.25 * k))
    add(part("Case", "primitive_torus_add", m["steel"], 0, major_radius=0.98, minor_radius=0.12, major_segments=96, minor_segments=24, location=(0, 0, 0.27)), (0, 0, 0.0))
    add(part("Dial", "primitive_cylinder_add", m["dial"], 0.005, vertices=96, radius=0.86, depth=0.03, location=(0, 0, 0.31)), (0, 0, 1.0))
    for k in range(12):
        a = 2 * math.pi * k / 12
        o = part(f"Index{k}", "primitive_cube_add", m["steel"], 0.0, size=1, location=(math.sin(a) * 0.7, math.cos(a) * 0.7, 0.335), rotation=(0, 0, -a), scale=(0.035, 0.14 if k % 3 == 0 else 0.09, 0.02))
        o["dir"] = (0, 0, 1.0)
        P.append(o)
    add(part("HourHand", "primitive_cube_add", m["steel"], 0.0, size=1, location=(0.15, 0.12, 0.36), rotation=(0, 0, -0.9), scale=(0.05, 0.42, 0.015)), (0, 0, 1.6))
    add(part("MinuteHand", "primitive_cube_add", m["steel"], 0.0, size=1, location=(-0.12, 0.25, 0.38), rotation=(0, 0, 0.45), scale=(0.035, 0.62, 0.015)), (0, 0, 1.9))
    add(part("SecondHand", "primitive_cube_add", m["red"], 0.0, size=1, location=(0.0, -0.2, 0.40), rotation=(0, 0, 3.0), scale=(0.012, 0.75, 0.01)), (0, 0, 2.2))
    add(part("Bezel", "primitive_torus_add", m["black"], 0, major_radius=0.95, minor_radius=0.07, major_segments=96, minor_segments=16, location=(0, 0, 0.41)), (0, 0, 2.6))
    add(part("Crystal", "primitive_cylinder_add", m["glass"], 0.01, vertices=96, radius=0.9, depth=0.04, location=(0, 0, 0.43)), (0, 0, 3.0))
    add(part("Crown", "primitive_cylinder_add", m["steel"], 0.01, vertices=32, radius=0.09, depth=0.18, location=(1.15, 0, 0.27), rotation=(0, math.pi / 2, 0)), (1.0, 0, 0.3))
    for s in (1, -1):
        add(part(f"Strap{'A' if s > 0 else 'B'}", "primitive_cube_add", m["strap"], 0.04, size=1, location=(0, s * 1.65, 0.2), scale=(0.95, 1.4, 0.12)), (0, s * 1.0, -0.2))
    return bake(P), {"axis": "vertical", "lift": 0.0}


def headphones():
    m = mats()
    P = []
    def add(o, d):
        o["dir"] = d
        P.append(o)
    cu = bpy.data.curves.new("band", "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    pts = [(math.cos(a) * 1.05, 0, 1.0 + math.sin(a) * 1.05) for a in [math.pi * k / 24 for k in range(25)]]
    sp.points.add(len(pts) - 1)
    for p, c in zip(sp.points, pts):
        p.co = (*c, 1)
    cu.bevel_depth, cu.bevel_resolution = 0.06, 4
    ob = link(bpy.data.objects.new("Headband", cu))
    ob.data.materials.append(m["black"])
    add(ob, (0, 0, 1.2))
    for s in (1, -1):
        add(part(f"Slider{s}", "primitive_cylinder_add", m["steel"], 0.01, vertices=32, radius=0.035, depth=0.5, location=(s * 1.05, 0, 0.85)), (s * 0.6, 0, 0.6))
        add(part(f"Cup{s}", "primitive_cylinder_add", m["white"], 0.04, vertices=96, radius=0.45, depth=0.28, location=(s * 1.05, 0, 0.3), rotation=(0, math.pi / 2, 0)), (s * 1.0, 0, 0))
        add(part(f"Cap{s}", "primitive_cylinder_add", m["steel"], 0.02, vertices=96, radius=0.32, depth=0.05, location=(s * 1.21, 0, 0.3), rotation=(0, math.pi / 2, 0)), (s * 1.7, 0, 0))
        add(part(f"Driver{s}", "primitive_cylinder_add", m["dark_steel"], 0.01, vertices=64, radius=0.36, depth=0.06, location=(s * 0.88, 0, 0.3), rotation=(0, math.pi / 2, 0)), (s * 0.3, 0, 0))
        add(part(f"Cushion{s}", "primitive_torus_add", m["cream"], 0, major_radius=0.36, minor_radius=0.1, major_segments=64, minor_segments=16, location=(s * 0.82, 0, 0.3), rotation=(0, math.pi / 2, 0)), (s * -0.5, 0, 0))
    return bake(P), {"axis": "radial", "lift": 0.0}


def character():
    m = {"skin": M("toon_skin", (0.95, 0.62, 0.45), 0.6), "shirt": M("toon_shirt", (0.08, 0.35, 0.85), 0.6),
         "pants": M("toon_pants", (0.12, 0.12, 0.2), 0.6), "hair": M("toon_hair", (0.9, 0.35, 0.05), 0.6),
         "eye": M("toon_eye", (0.02, 0.02, 0.03), 0.3), "white": M("toon_white", (0.95, 0.95, 0.95), 0.4),
         "shoe": M("toon_shoe", (0.85, 0.1, 0.12), 0.5)}
    P = []
    P.append(part("Head", "primitive_uv_sphere_add", m["skin"], 0, segments=48, ring_count=24, radius=0.62, location=(0, 0, 2.05)))
    P.append(part("Hair", "primitive_uv_sphere_add", m["hair"], 0, segments=48, ring_count=24, radius=0.66, location=(0, 0.06, 2.2), scale=(1.02, 1.0, 0.8)))
    for s in (1, -1):
        P.append(part(f"EyeW{s}", "primitive_uv_sphere_add", m["white"], 0, segments=24, ring_count=12, radius=0.16, location=(s * 0.22, -0.5, 2.05), scale=(1, 0.5, 1.25)))
        P.append(part(f"Eye{s}", "primitive_uv_sphere_add", m["eye"], 0, segments=24, ring_count=12, radius=0.09, location=(s * 0.22, -0.58, 2.03), scale=(1, 0.5, 1.3)))
        P.append(part(f"Ear{s}", "primitive_uv_sphere_add", m["skin"], 0, segments=24, ring_count=12, radius=0.14, location=(s * 0.62, 0, 2.0), scale=(0.5, 1, 1)))
        P.append(part(f"Arm{s}", "primitive_cylinder_add", m["shirt"], 0.05, vertices=24, radius=0.13, depth=0.75, location=(s * 0.62, 0, 1.15), rotation=(0, s * 0.35, 0)))
        P.append(part(f"Hand{s}", "primitive_uv_sphere_add", m["skin"], 0, segments=24, ring_count=12, radius=0.15, location=(s * 0.76, 0, 0.78)))
        P.append(part(f"Leg{s}", "primitive_cylinder_add", m["pants"], 0.04, vertices=24, radius=0.15, depth=0.6, location=(s * 0.2, 0, 0.42)))
        P.append(part(f"Shoe{s}", "primitive_uv_sphere_add", m["shoe"], 0, segments=24, ring_count=12, radius=0.2, location=(s * 0.2, -0.08, 0.1), scale=(1, 1.4, 0.6)))
    P.append(part("Body", "primitive_cylinder_add", m["shirt"], 0.12, vertices=48, radius=0.45, depth=0.85, location=(0, 0, 1.1)))
    P.append(part("Mouth", "primitive_torus_add", m["eye"], 0, major_radius=0.12, minor_radius=0.025, location=(0, -0.57, 1.82), rotation=(math.radians(80), 0, 0), scale=(1, 1, 0.5)))
    return bake(P), {}
