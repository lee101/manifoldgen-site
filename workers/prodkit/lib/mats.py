import bpy
from .core import hexrgb


class NB:
    def __init__(s, tree, clear=True):
        s.t, s.N, s.L = tree, tree.nodes, tree.links
        if clear:
            s.N.clear()

    def __call__(s, typ, *ins, **kw):
        n = s.N.new(typ)
        for k, v in kw.items():
            if k.startswith("i_"):
                s.set(n.inputs[k[2:].replace("__", " ")], v)
            else:
                setattr(n, k, v)
        for j, v in enumerate(ins):
            if v is not None:
                s.set(n.inputs[j], v)
        return n

    def set(s, sock, v):
        if isinstance(v, bpy.types.NodeSocket):
            s.L.new(v, sock)
        elif isinstance(v, bpy.types.Node):
            s.L.new(v.outputs[0], sock)
        else:
            if isinstance(v, (tuple, list)) and len(v) == 3 and len(sock.default_value) == 4:
                v = (*v, 1.0)
            sock.default_value = v

    def math(s, op, a, b=0.0, clamp=False):
        return s("ShaderNodeMath", a, b, operation=op, use_clamp=clamp)

    def vmath(s, op, a, b=(0, 0, 0)):
        return s("ShaderNodeVectorMath", a, b, operation=op)

    def mix(s, fac, a, b, blend="MIX"):
        n = s("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        s.set(n.inputs[0], fac)
        s.set(n.inputs[6], a)
        s.set(n.inputs[7], b)
        return n.outputs[2]

    def ramp(s, fac, stops, interp="LINEAR"):
        n = s("ShaderNodeValToRGB", fac)
        cr = n.color_ramp
        cr.interpolation = interp
        while len(cr.elements) > len(stops):
            cr.elements.remove(cr.elements[-1])
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for e, (pos, col) in zip(cr.elements, stops):
            e.position = pos
            e.color = (*col, 1.0) if len(col) == 3 else col
        return n


def new(name):
    m = bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    return m, NB(m.node_tree)


def coords(b, coord):
    if coord == "rest":
        return b("ShaderNodeAttribute", attribute_name="rest", attribute_type="GEOMETRY").outputs["Vector"]
    return b("ShaderNodeTexCoord").outputs["Object"]


def finish(m, b, bsdf, bump=None):
    if bump is not None:
        b.set(bsdf.inputs["Normal"], bump)
    b("ShaderNodeOutputMaterial", bsdf)
    return m


def principled(name, color=(0.8, 0.8, 0.8), rough=0.5, metal=0.0, **kw):
    m, b = new(name)
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=color, i_Roughness=rough, i_Metallic=metal)
    for k, v in kw.items():
        b.set(bs.inputs[k.replace("_", " ")], v)
    return finish(m, b, bs)


def from_spec(name, d):
    if not isinstance(d, dict):
        d = {}
    from .core import _num
    col = hexrgb(d.get("color"), (0.7, 0.7, 0.72))
    m, b = new(name)
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col,
           i_Roughness=min(1, max(0, _num(d.get("roughness", 0.45), 0.45))),
           i_Metallic=min(1, max(0, _num(d.get("metallic", 0), 0))))
    em = hexrgb(d.get("emission"))
    if em:
        b.set(bs.inputs["Emission Color"], em)
        b.set(bs.inputs["Emission Strength"], min(50, max(0, _num(d.get("emission_strength", 2), 2))))
    tr = min(1, max(0, _num(d.get("transmission", 0), 0)))
    if tr:
        b.set(bs.inputs["Transmission Weight"], tr)
    return finish(m, b, bs)


def _noise(b, v, scale, detail=4, rough=0.55, dist=0.0):
    return b("ShaderNodeTexNoise", v, i_Scale=scale, i_Detail=detail, i_Roughness=rough, i_Distortion=dist)


def _bump(b, h, strength, dist=0.02):
    return b("ShaderNodeBump", i_Strength=strength, i_Distance=dist, i_Height=h)


def concrete(name="concrete", coord="rest", inner=False, tint=(0.44, 0.42, 0.39)):
    m, b = new(name)
    v = coords(b, coord)
    n1 = _noise(b, v, 2.5, 6, 0.6)
    n2 = _noise(b, v, 18, 3, 0.7)
    vor = b("ShaderNodeTexVoronoi", v, i_Scale=40 if not inner else 25)
    pits = b.math("LESS_THAN", vor.outputs["Distance"], 0.12 if not inner else 0.2)
    lo = tuple(c * 0.72 for c in tint)
    hi = tuple(min(1, c * 1.22) for c in tint)
    if inner:
        lo, hi = tuple(min(1, c * 1.05) for c in tint), tuple(min(1, c * 1.45) for c in tint)
    col = b.mix(n1.outputs["Fac"], lo, hi)
    col = b.mix(b.math("MULTIPLY", pits, 0.6), col, tuple(c * 0.35 for c in tint))
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col, i_Roughness=0.92)
    h = b.math("ADD", b.math("MULTIPLY", n2.outputs["Fac"], 0.6), b.math("MULTIPLY", pits, -0.5))
    return finish(m, b, bs, _bump(b, h, 0.35 if not inner else 0.6))


def brick(name="brick", coord="rest", scale=1.5):
    m, b = new(name)
    v = coords(b, coord)
    sep = b("ShaderNodeSeparateXYZ", v)
    uv = b("ShaderNodeCombineXYZ", b.math("ADD", sep.outputs[0], sep.outputs[1]), sep.outputs[2], 0.0)
    n = _noise(b, v, 6, 4, 0.6)
    br = b("ShaderNodeTexBrick", uv, i_Color1=(0.3, 0.075, 0.035), i_Color2=(0.17, 0.045, 0.022), i_Mortar=(0.26, 0.24, 0.22),
           i_Scale=scale, i_Mortar__Size=0.022, i_Mortar__Smooth=0.15, i_Bias=0.0, i_Brick__Width=0.5, i_Row__Height=0.2,
           offset=0.5, squash=1.0)
    col = b.mix(b.math("MULTIPLY", n.outputs["Fac"], 0.5), br.outputs["Color"], (0.12, 0.05, 0.03), "MULTIPLY")
    col = b.mix(0.35, br.outputs["Color"], col)
    rough = b.math("ADD", 0.82, b.math("MULTIPLY", br.outputs["Fac"], 0.1))
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col, i_Roughness=rough)
    h = b.math("ADD", b.math("MULTIPLY", br.outputs["Fac"], -1.0), b.math("MULTIPLY", _noise(b, v, 30, 3).outputs["Fac"], 0.25))
    return finish(m, b, bs, _bump(b, h, 0.6))


def brick_inner(name="brick_inner", coord="rest"):
    return concrete(name, coord, inner=True, tint=(0.13, 0.08, 0.062))


def glass(name="glass", coord="rest", tint=(0.82, 0.95, 0.9), rough=0.02, frost=0.0):
    m, b = new(name)
    v = coords(b, coord)
    r = rough
    if frost:
        r = b.math("ADD", rough, b.math("MULTIPLY", _noise(b, v, 25, 3).outputs["Fac"], frost))
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=tint, i_Roughness=r, i_Transmission__Weight=1.0, i_IOR=1.45)
    return finish(m, b, bs)


def ice(name="ice", coord="rest", inner=False):
    m, b = new(name)
    v = coords(b, coord)
    n = _noise(b, v, 4, 6, 0.6, 0.6)
    r = b.math("ADD", 0.05 if not inner else 0.25, b.math("MULTIPLY", n.outputs["Fac"], 0.25))
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=(0.62, 0.84, 0.97), i_Roughness=r, i_Transmission__Weight=0.92 if not inner else 0.75,
           i_IOR=1.31, i_Subsurface__Weight=0.0)
    b.set(bs.inputs["Coat Weight"], 0.4)
    return finish(m, b, bs, _bump(b, _noise(b, v, 14, 4).outputs["Fac"], 0.25))


def wood(name="wood", coord="rest", inner=False):
    m, b = new(name)
    v = coords(b, coord)
    mp = b("ShaderNodeMapping", v, i_Scale=(1.0, 1.0, 0.12))
    n = _noise(b, mp, 3, 6, 0.6)
    w = b("ShaderNodeTexWave", b.mix(0.08, mp, n.outputs["Color"]), wave_type="RINGS", rings_direction="Z", i_Scale=2.2,
          i_Distortion=3.0, i_Detail=3)
    a, c = ((0.28, 0.13, 0.05), (0.52, 0.29, 0.12)) if not inner else ((0.55, 0.36, 0.18), (0.75, 0.55, 0.32))
    col = b.ramp(w.outputs["Fac"], [(0.0, a), (0.55, c), (1.0, a)])
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col.outputs[0], i_Roughness=0.55 if not inner else 0.85)
    return finish(m, b, bs, _bump(b, w.outputs["Fac"], 0.15))


def marble(name="marble", coord="rest", inner=False):
    m, b = new(name)
    v = coords(b, coord)
    n = _noise(b, v, 1.2, 8, 0.62, 2.5)
    w = b("ShaderNodeTexWave", b.mix(0.6, v, n.outputs["Color"]), i_Scale=0.9, i_Distortion=10.0, i_Detail=8, i_Detail__Roughness=0.62)
    veins = b.ramp(w.outputs["Fac"], [(0.0, (0.1, 0.1, 0.1)), (0.04, (0.35, 0.34, 0.33)), (0.12, (0.66, 0.65, 0.62)), (1.0, (0.74, 0.73, 0.7))])
    col = veins.outputs[0]
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col, i_Roughness=0.18 if not inner else 0.65)
    b.set(bs.inputs["Subsurface Weight"], 0.15)
    b.set(bs.inputs["Subsurface Radius"], (0.2, 0.18, 0.15))
    b.set(bs.inputs["Subsurface Scale"], 0.05)
    if inner:
        return finish(m, b, bs, _bump(b, _noise(b, v, 40, 3).outputs["Fac"], 0.5))
    return finish(m, b, bs)


def iron(name="iron"):
    m, b = new(name)
    v = coords(b, "object")
    n = _noise(b, v, 8, 6, 0.6)
    col = b.mix(n.outputs["Fac"], (0.03, 0.03, 0.035), (0.09, 0.085, 0.08))
    bs = b("ShaderNodeBsdfPrincipled", i_Base__Color=col, i_Metallic=1.0, i_Roughness=b.math("ADD", 0.25, b.math("MULTIPLY", n.outputs["Fac"], 0.3)))
    return finish(m, b, bs)


SUBJECT_MATS = {
    "concrete": (lambda: concrete(), lambda: concrete("concrete_inner", inner=True)),
    "brick": (lambda: brick(), lambda: brick_inner()),
    "glass": (lambda: glass(), lambda: glass("glass_inner", frost=0.15)),
    "wood": (lambda: wood(), lambda: wood("wood_inner", inner=True)),
    "marble": (lambda: marble(), lambda: marble("marble_inner", inner=True)),
    "ice": (lambda: ice(), lambda: ice("ice_inner", inner=True)),
}
DUST_TINT = {"concrete": (0.55, 0.52, 0.48), "brick": (0.5, 0.36, 0.3), "glass": (0.8, 0.82, 0.84), "wood": (0.5, 0.42, 0.32),
             "marble": (0.82, 0.8, 0.77), "ice": (0.85, 0.92, 0.97)}


def dust(name="dust", tint=(0.55, 0.52, 0.48), density=0.55):
    m, b = new(name)
    fade = b("ShaderNodeAttribute", attribute_name="fade", attribute_type="INSTANCER").outputs["Fac"]
    lw = b("ShaderNodeLayerWeight", i_Blend=0.5)
    soft = b.math("POWER", b.math("SUBTRACT", 1.0, lw.outputs["Facing"], True), 2.2)
    life = b.math("POWER", b.math("SUBTRACT", 1.0, fade, True), 1.6)
    ramp_in = b.math("MINIMUM", b.math("MULTIPLY", fade, 12.0), 1.0)
    a = b.math("MULTIPLY", b.math("MULTIPLY", soft, life), b.math("MULTIPLY", ramp_in, density))
    tex = _noise(b, b("ShaderNodeTexCoord").outputs["Object"], 2.5, 3)
    a = b.math("MULTIPLY", a, b.math("ADD", 0.45, tex.outputs["Fac"]), True)
    diff = b("ShaderNodeBsdfDiffuse", i_Color=tint)
    tr = b("ShaderNodeBsdfTransparent")
    mx = b("ShaderNodeMixShader", a, tr, diff)
    b("ShaderNodeOutputMaterial", mx)
    m.surface_render_method = "BLENDED"
    return m


def emission(name, color, strength=5.0):
    m, b = new(name)
    return finish(m, b, b("ShaderNodeEmission", i_Color=color, i_Strength=strength))
