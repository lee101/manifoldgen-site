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
print("testdata ready", sorted(os.listdir(D)))
