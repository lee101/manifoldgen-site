import bpy, os, sys, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import props

D = os.path.join(os.path.dirname(os.path.abspath(__file__)), "testdata")
os.makedirs(D, exist_ok=True)
BASE = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/{0}/glTF-Binary/{0}.glb"
for m in ("DamagedHelmet", "Duck"):
    p = os.path.join(D, m + ".glb")
    if not os.path.exists(p):
        urllib.request.urlretrieve(BASE.format(m), p)
p = os.path.join(D, "watch_parts.glb")
if not os.path.exists(p):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    props.watch()
    bpy.ops.export_scene.gltf(filepath=p, export_format="GLB")
p = os.path.join(D, "bunny_open.obj")
if not os.path.exists(p):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_monkey_add(size=2)
    bpy.ops.wm.obj_export(filepath=p, export_materials=False)
p = os.path.join(D, "tall_figure.glb")
if not os.path.exists(p):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=3.0, location=(0, 0, 1.5), vertices=32)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.55, location=(0, 0, 3.4))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.15), scale=(1.2, 1.2, 0.3))
    for o, c in zip(bpy.context.scene.objects, ((0.8, 0.2, 0.1, 1), (0.1, 0.4, 0.9, 1), (0.9, 0.8, 0.2, 1))):
        m = bpy.data.materials.new(o.name)
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = c
        o.data.materials.append(m)
    bpy.ops.export_scene.gltf(filepath=p, export_format="GLB")
print("testdata ready", sorted(os.listdir(D)))
