import bpy
from .core import kf, link
from .mats import NB, dust as dust_mat

ATTRS = (("vel", "FLOAT_VECTOR"), ("t0", "FLOAT"), ("life", "FLOAT"), ("size", "FLOAT"), ("drag", "FLOAT"), ("rise", "FLOAT"))


def _gn_tree(mat, grow=1.8):
    ng = bpy.data.node_groups.new("DustSim", "GeometryNodeTree")
    ng.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    tsock = ng.interface.new_socket("Time", in_out="INPUT", socket_type="NodeSocketFloat")
    ng.interface.new_socket("Grow", in_out="INPUT", socket_type="NodeSocketFloat").default_value = grow
    ng.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    b = NB(ng)
    gi = b("NodeGroupInput")
    go = b("NodeGroupOutput")
    A = {n: b("GeometryNodeInputNamedAttribute", data_type=t, i_Name=n).outputs["Attribute"] for n, t in ATTRS}
    age = b.math("SUBTRACT", gi.outputs["Time"], A["t0"])
    agep = b.math("MAXIMUM", age, 0.0)
    k = b.math("MAXIMUM", A["drag"], 0.01)
    e = b.math("SUBTRACT", 1.0, b.math("EXPONENT", b.math("MULTIPLY", b.math("MULTIPLY", k, agep), -1.0)))
    disp = b.vmath("SCALE", A["vel"], None)
    b.set(disp.inputs["Scale"], b.math("DIVIDE", e, k))
    up = b("ShaderNodeCombineXYZ", 0.0, 0.0, b.math("MULTIPLY", A["rise"], agep))
    pos = b.vmath("ADD", b.vmath("ADD", b("GeometryNodeInputPosition"), disp), up)
    sep = b("ShaderNodeSeparateXYZ", pos)
    zc = b.math("MAXIMUM", sep.outputs[2], b.math("MULTIPLY", A["size"], 0.5))
    pos2 = b("ShaderNodeCombineXYZ", sep.outputs[0], sep.outputs[1], zc)
    fade = b.math("DIVIDE", age, b.math("MAXIMUM", A["life"], 0.01))
    dead = b.math("MAXIMUM", b.math("LESS_THAN", age, 0.0), b.math("GREATER_THAN", fade, 1.0))
    sp = b("GeometryNodeSetPosition", gi.outputs["Geometry"], None, pos2)
    st = b("GeometryNodeStoreNamedAttribute", sp, None, "fade", data_type="FLOAT", domain="POINT")
    b.set(st.inputs["Value"], fade)
    dl = b("GeometryNodeDeleteGeometry", st, dead, domain="POINT")
    ico = b("GeometryNodeMeshIcoSphere", i_Radius=1.0, i_Subdivisions=2)
    sm = b("GeometryNodeSetShadeSmooth", ico)
    smat = b("GeometryNodeSetMaterial", sm, i_Material=mat)
    g = b.math("SUBTRACT", 1.0, b.math("EXPONENT", b.math("MULTIPLY", agep, -1.3)))
    scale = b.math("MULTIPLY", A["size"], b.math("ADD", 0.35, b.math("MULTIPLY", g, gi.outputs["Grow"])))
    rot = b("FunctionNodeRandomValue", data_type="FLOAT_VECTOR", i_Max=(6.3, 6.3, 6.3))
    iop = b("GeometryNodeInstanceOnPoints", dl, i_Instance=smat)
    b.set(iop.inputs["Rotation"], rot.outputs[0])
    b.set(iop.inputs["Scale"], scale)
    b.set(go.inputs[0], iop)
    return ng, tsock.identifier


def dust(points, sim_time, tint, density=0.5, name="Dust", coll=None):
    if not points:
        return None
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(points))
    me.vertices.foreach_set("co", [c for p in points for c in p["pos"]])
    for n, t in ATTRS:
        a = me.attributes.new(n, t, "POINT")
        if t == "FLOAT_VECTOR":
            a.data.foreach_set("vector", [c for p in points for c in p[n]])
        else:
            a.data.foreach_set("value", [p[n] for p in points])
    ob = link(bpy.data.objects.new(name, me), coll)
    mat = dust_mat(name + "_mat", tint, density)
    me.materials.append(mat)
    ng, tid = _gn_tree(mat)
    mod = ob.modifiers.new("DustSim", "NODES")
    mod.node_group = ng
    sock = getattr(mod.properties.inputs, tid)
    for f, t in enumerate(sim_time, start=1):
        sock.value = t
        kf(sock, "value", f, "LINEAR")
    ob.visible_shadow = False
    return ob
