import bpy, bmesh, os, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from .core import UserError, quiet, link

EXT = {".glb", ".gltf", ".obj", ".fbx", ".stl", ".ply"}
MAX_FACES = 400000


def import_model(path, blog=None):
    if not isinstance(path, str) or not os.path.isfile(path):
        raise UserError("model file not found")
    ext = os.path.splitext(path)[1].lower()
    if ext not in EXT:
        raise UserError("unsupported model format " + ext)
    if os.path.getsize(path) > 300e6:
        raise UserError("model file too large")
    if ext == ".gltf":
        _check_gltf(path)
    before = set(bpy.data.objects)
    try:
        with quiet(blog):
            if ext in (".glb", ".gltf"):
                bpy.ops.import_scene.gltf(filepath=path)
            elif ext == ".obj":
                bpy.ops.wm.obj_import(filepath=path)
            elif ext == ".fbx":
                bpy.ops.import_scene.fbx(filepath=path)
            elif ext == ".stl":
                bpy.ops.wm.stl_import(filepath=path)
            else:
                bpy.ops.wm.ply_import(filepath=path)
    except Exception as e:
        raise UserError("model import failed: " + str(e).splitlines()[0][:100])
    new = [o for o in bpy.data.objects if o not in before]
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in new:
        if o.type in ("MESH", "CURVE", "SURFACE", "FONT", "META"):
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
            if len(me.polygons) == 0:
                bpy.data.meshes.remove(me)
                continue
            me.transform(o.matrix_world)
            ob = link(bpy.data.objects.new(o.name, me))
            out.append(ob)
    for o in new:
        bpy.data.objects.remove(o, do_unlink=True)
    if not out:
        raise UserError("model has no mesh geometry")
    nf = sum(len(o.data.polygons) for o in out)
    if nf > MAX_FACES * 4:
        raise UserError("model too dense")
    return out


def _check_gltf(path):
    import json
    from urllib.parse import unquote
    try:
        with open(path) as f:
            d = json.load(f)
    except Exception:
        raise UserError("invalid gltf json")
    for k in ("buffers", "images"):
        for it in d.get(k, []) if isinstance(d.get(k), list) else []:
            u = it.get("uri", "") if isinstance(it, dict) else ""
            u = unquote(u) if isinstance(u, str) and not u.startswith("data:") else u
            if not isinstance(u, str) or (u and not u.startswith("data:") and (os.path.isabs(u) or ".." in u.replace("\\", "/").split("/") or ":" in u)):
                raise UserError("gltf references external path outside model dir")


def normalize(objs, size=3.0, ground=True, up_axis=None):
    lo, hi = bounds(objs)
    d = max(hi - lo)
    if d <= 0:
        raise UserError("degenerate model")
    s = size / d
    c = (lo + hi) / 2
    off = Vector((-c.x, -c.y, -lo.z if ground else -c.z))
    M = Matrix.Diagonal((s, s, s, 1)) @ Matrix.Translation(off)
    for o in objs:
        o.data.transform(M)
        o.data.update()
    return s


def bounds(objs):
    lo = Vector((1e18,) * 3)
    hi = Vector((-1e18,) * 3)
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            lo = Vector(map(min, lo, p))
            hi = Vector(map(max, hi, p))
    return lo, hi


def decimate(ob, target):
    n = len(ob.data.polygons)
    if n <= target:
        return
    m = ob.modifiers.new("dec", "DECIMATE")
    m.ratio = target / n
    with bpy.context.temp_override(object=ob, active_object=ob):
        bpy.ops.object.modifier_apply(modifier=m.name)


def join(objs, name="Model"):
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    bm = bmesh.new()
    mats = []
    for o in objs:
        me = o.data
        remap = []
        for m in me.materials:
            if m not in mats:
                mats.append(m)
            remap.append(mats.index(m))
        tmp = me.copy()
        for p in tmp.polygons:
            p.material_index = remap[p.material_index] if p.material_index < len(remap) else 0
        bm.from_mesh(tmp)
        bpy.data.meshes.remove(tmp)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)
    return link(bpy.data.objects.new(name, me))


def is_manifold(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    ok = all(e.is_manifold for e in bm.edges) and len(bm.edges) > 0
    bm.free()
    return ok


def watertight_proxy(ob, res=72):
    tmp = bpy.data.objects.new("proxy", ob.data.copy())
    link(tmp)
    m = tmp.modifiers.new("vox", "REMESH")
    m.mode = "VOXEL"
    m.voxel_size = max(ob.dimensions) / res
    m.adaptivity = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg), depsgraph=dg)
    me.transform(ob.matrix_world)
    bpy.data.objects.remove(tmp, do_unlink=True)
    bm = bmesh.new()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    return bm


class Inside:
    def __init__(s, bm):
        s.bvh = BVHTree.FromBMesh(bm)
        s.dirs = [Vector((0.0, 0.0, 1.0)), Vector((0.577, 0.577, 0.577)), Vector((-0.6, 0.3, -0.74))]

    def __call__(s, p):
        votes = 0
        for d in s.dirs:
            n, q = 0, p.copy()
            hit = s.bvh.ray_cast(q, d)
            while hit[0] is not None and n < 64:
                n += 1
                q = hit[0] + d * 1e-4
                hit = s.bvh.ray_cast(q, d)
            votes += n % 2
        return votes >= 2


def voronoi_seeds(inside, lo, hi, n, focus=None, focus_r=1.0, bias=0.5, rnd=None):
    rnd = rnd or random.Random(1)
    pts, tries = [], 0
    while len(pts) < n and tries < n * 200:
        tries += 1
        if focus is not None and rnd.random() < bias:
            d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 1)))
            p = focus + d * focus_r * (rnd.random() ** 1.5)
            if not all(lo[i] <= p[i] <= hi[i] for i in range(3)):
                continue
        else:
            p = Vector([rnd.uniform(lo[i], hi[i]) for i in range(3)])
        if inside(p):
            pts.append(p)
    return pts


def fracture(bm0, pts, inner_index, min_verts=4):
    kd = KDTree(len(pts))
    for i, p in enumerate(pts):
        kd.insert(p, i)
    kd.balance()
    cells = []
    lay = bm0.faces.layers.int.get("nb") or bm0.faces.layers.int.new("nb")
    for i, c in enumerate(pts):
        bm = bm0.copy()
        nb = bm.faces.layers.int["nb"]
        rmax = max((v.co - c).length for v in bm.verts)
        for (o, j, d) in kd.find_n(c, len(pts)):
            if j == i:
                continue
            if d * 0.5 > rmax:
                break
            nrm = (o - c).normalized()
            mid = (o + c) / 2
            r = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=mid, plane_no=nrm, clear_outer=True)
            edges = [e for e in r["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                try:
                    f = bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=False, edges=edges, normal=nrm)
                    for face in f["geom"]:
                        if isinstance(face, bmesh.types.BMFace):
                            face.material_index = inner_index
                            face.smooth = False
                            face[nb] = j + 1
                except Exception:
                    pass
            if len(bm.verts) < min_verts:
                break
            rmax = max((v.co - c).length for v in bm.verts)
        if len(bm.verts) < min_verts or len(bm.faces) < 4:
            bm.free()
            continue
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
        adj = {}
        for fc in bm.faces:
            if fc[nb]:
                adj[fc[nb] - 1] = adj.get(fc[nb] - 1, 0.0) + fc.calc_area()
        cells.append((i, bm, adj))
    return cells


def bonds(objs, adjs, K, coll, min_area=1e-3):
    made = []
    for i, oa in objs.items():
        for j, area in adjs.get(i, {}).items():
            if j <= i or j not in objs or area < min_area:
                continue
            ob = objs[j]
            e = bpy.data.objects.new(f"bond_{i}_{j}", None)
            coll.objects.link(e)
            e.location = (oa.location + ob.location) / 2
            e.empty_display_size = 0.05
            made.append((e, oa, ob, K * area))
    if not made:
        return 0
    for e, oa, ob, th in made:
        with bpy.context.temp_override(object=e, active_object=e):
            bpy.ops.rigidbody.constraint_add(type="FIXED")
        c = e.rigid_body_constraint
        c.object1, c.object2 = oa, ob
        c.use_breaking = True
        c.breaking_threshold = th
        c.disable_collisions = bool(oa.get("concave") or ob.get("concave"))
        e.hide_render = True
    return len(made)


def cell_object(bm, name, mats, coll):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    vol = abs(bm.calc_volume(signed=True))
    hb = bmesh.new()
    for v in bm.verts:
        hb.verts.new(v.co)
    try:
        bmesh.ops.convex_hull(hb, input=hb.verts[:], use_existing_faces=False)
        bmesh.ops.delete(hb, geom=[v for v in hb.verts if not v.link_faces], context="VERTS")
        hvol = abs(hb.calc_volume(signed=True))
    except Exception:
        hvol = vol
    hb.free()
    bm.free()
    for m in mats:
        me.materials.append(m)
    co = [0.0] * (len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    a = me.attributes.new("rest", "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", co)
    n = len(me.vertices)
    c = Vector((sum(co[0::3]) / n, sum(co[1::3]) / n, sum(co[2::3]) / n))
    me.transform(Matrix.Translation(-c))
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    ob.location = c
    ob["concave"] = hvol > vol * 1.35 and len(me.polygons) < 3000
    return ob, vol
