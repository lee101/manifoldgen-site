import bpy, os, sys, json, math, time, re, shutil, subprocess, contextlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG = os.environ.get("PRODKIT_FFMPEG") or ("/usr/bin/ffmpeg" if os.path.exists("/usr/bin/ffmpeg") else (shutil.which("ffmpeg") or "ffmpeg"))
QUALITY = {"draft": (540, 16, 0.6), "standard": (720, 32, 1.0), "high": (1080, 64, 1.0)}
ASPECT = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1.0}
BUDGET = {"OPTIX": 7e9, "CUDA": 5.5e9, "CPU": 1.2e9}
EEVEE_BUDGET = 4e9
_OUT_FD = os.dup(1)


class UserError(Exception):
    pass


def log(*a):
    os.write(_OUT_FD, (" ".join(str(x) for x in a) + "\n").encode())


@contextlib.contextmanager
def quiet(path=None):
    sys.stdout.flush(); sys.stderr.flush()
    fd = os.open(path or os.devnull, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)
    s1, s2 = os.dup(1), os.dup(2)
    os.dup2(fd, 1); os.dup2(fd, 2)
    try:
        yield
    finally:
        sys.stdout.flush(); sys.stderr.flush()
        os.dup2(s1, 1); os.dup2(s2, 2)
        for f in (fd, s1, s2):
            os.close(f)


def _num(v, dv):
    if isinstance(v, bool) or not isinstance(v, (int, float, str)):
        return dv
    try:
        v = float(v)
    except ValueError:
        return dv
    return v if math.isfinite(v) else dv


def srgb(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexrgb(v, dv=None):
    if isinstance(v, str):
        m = re.fullmatch(r"#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})", v.strip())
        if m:
            h = m.group(1)
            if len(h) == 3:
                h = "".join(c * 2 for c in h)
            return tuple(srgb(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4))
    return dv


class P:
    def __init__(s, d):
        s.d = d if isinstance(d, dict) else {}

    def f(s, k, dv, lo, hi, d=None):
        return min(hi, max(lo, _num((s.d if d is None else d).get(k, dv), dv)))

    def i(s, k, dv, lo, hi, d=None):
        return int(round(s.f(k, dv, lo, hi, d)))

    def e(s, k, dv, opts, d=None):
        v = (s.d if d is None else d).get(k, dv)
        v = v.strip().lower() if isinstance(v, str) else dv
        return v if v in opts else dv

    def b(s, k, dv, d=None):
        v = (s.d if d is None else d).get(k, dv)
        if isinstance(v, str):
            return v.strip().lower() in ("1", "true", "yes", "on")
        return bool(v) if isinstance(v, (bool, int, float)) else dv

    def c(s, k, dv, d=None):
        return hexrgb((s.d if d is None else d).get(k), dv)

    def text(s, k, dv, n=16, d=None):
        v = (s.d if d is None else d).get(k, dv)
        v = re.sub(r"[^A-Za-z0-9 !?&.,:'\-+#@$%]", "", v if isinstance(v, str) else dv)[:n].strip()
        return v or dv

    def vec(s, k, dv, lo=-1e3, hi=1e3, n=3, d=None):
        v = (s.d if d is None else d).get(k)
        if not isinstance(v, (list, tuple)) or len(v) < n:
            return tuple(dv)
        return tuple(min(hi, max(lo, _num(v[j], dv[j]))) for j in range(n))


class Ctx:
    def __init__(s, args):
        s.args = args
        s.out = args["out"]
        s.p = P(args.get("params"))
        s.inputs = args.get("inputs") if isinstance(args.get("inputs"), dict) else {}
        p = s.p
        s.fps = p.i("fps", 24, 12, 30)
        s.duration = p.f("duration", 4, 2, 8)
        s.frames = max(24, int(round(s.duration * s.fps)))
        s.quality = p.e("quality", "standard", QUALITY)
        s.aspect = p.e("aspect", "16:9", ASPECT)
        s.seed = p.i("seed", 7, 0, 2 ** 31 - 1)
        s.background = p.e("background", "studio", ("studio", "dark", "sky", "white"))
        h, s.samples, s.mb = QUALITY[s.quality]
        a = ASPECT[s.aspect]
        s.w, s.h = (int(round(h * a / 2)) * 2, h) if a >= 1 else (h, int(round(h / a / 2)) * 2)
        s.stats = {}
        s.poster_frame = s.frames // 2
        s.engine = "CYCLES"
        s.device = "CPU"
        s.export_glb = p.b("export_glb", True)
        s.t0 = time.time()
        s.blog = os.path.join(s.out, "blender.log")

    def model_paths(s):
        ps = []
        if isinstance(s.inputs.get("model_path"), str):
            ps.append(s.inputs["model_path"])
        if isinstance(s.inputs.get("model_paths"), list):
            ps += [x for x in s.inputs["model_paths"][:16] if isinstance(x, str)]
        return ps

    def scene(s):
        scn = bpy.context.scene
        scn.frame_start, scn.frame_end = 1, s.frames
        scn.render.fps = s.fps
        scn.render.resolution_x, scn.render.resolution_y = s.w, s.h
        scn.render.resolution_percentage = 100
        return scn


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "BEZIER"
    return bpy.context.scene


def kf(target, path, frame, interp="BEZIER", index=-1):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = interp
    target.keyframe_insert(path, frame=frame, index=index)


def link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def setup_device():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for t in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = t
        except TypeError:
            continue
        prefs.refresh_devices()
        if any(d.type == t for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == t
            return t
    return "CPU"


def eevee_ok():
    if os.environ.get("PRODKIT_ENGINE", "").upper() == "CYCLES":
        return False
    scn = bpy.context.scene
    old = scn.render.engine, scn.render.resolution_x, scn.render.resolution_y, scn.render.filepath, scn.camera
    tmp = None
    try:
        if not scn.camera:
            tmp = bpy.data.objects.new("_tmpcam", bpy.data.cameras.new("_tmpcam"))
            scn.collection.objects.link(tmp)
            scn.camera = tmp
        scn.render.engine = "BLENDER_EEVEE"
        scn.render.resolution_x = scn.render.resolution_y = 32
        with quiet():
            bpy.ops.render.render(write_still=False)
        return True
    except Exception:
        return False
    finally:
        scn.render.engine, scn.render.resolution_x, scn.render.resolution_y, scn.render.filepath, scn.camera = old
        if tmp:
            bpy.data.objects.remove(tmp)


def setup_render(ctx, engine="CYCLES", motion_blur=True, transparent_bounces=16):
    scn = ctx.scene()
    env = os.environ.get("PRODKIT_ENGINE", "").upper()
    if env in ("CYCLES", "EEVEE"):
        engine = env
    if engine == "EEVEE" and not eevee_ok():
        engine = "CYCLES"
    r = scn.render
    px = ctx.w * ctx.h * ctx.frames
    if engine == "EEVEE":
        r.engine = "BLENDER_EEVEE"
        ctx.device = "GPU"
        ee = scn.eevee
        spp = max(8, min(ctx.samples * 2, int(EEVEE_BUDGET / px)))
        ee.taa_render_samples = spp
        ee.use_shadows = True
        ee.shadow_ray_count, ee.shadow_step_count = 2, 6
        ee.use_raytracing = False
        ee.use_fast_gi = False
        ctx.samples = spp
    else:
        r.engine = "CYCLES"
        ctx.device = setup_device()
        c = scn.cycles
        c.device = "GPU" if ctx.device != "CPU" else "CPU"
        spp = max(8, min(ctx.samples, int(BUDGET[ctx.device if ctx.device in BUDGET else "CUDA"] / px)))
        if ctx.device == "CPU":
            spp = min(spp, 16)
            if px * spp > BUDGET["CPU"]:
                r.resolution_percentage = max(50, int(100 * math.sqrt(BUDGET["CPU"] / (px * spp))))
        c.samples = spp
        c.use_adaptive_sampling = True
        c.adaptive_threshold = 0.03
        c.use_denoising = True
        try:
            c.denoiser = "OPTIX" if ctx.device == "OPTIX" else "OPENIMAGEDENOISE"
        except TypeError:
            pass
        c.max_bounces, c.diffuse_bounces, c.glossy_bounces = 8, 3, 3
        c.transmission_bounces, c.transparent_max_bounces, c.volume_bounces = 8, transparent_bounces, 1
        c.caustics_reflective = c.caustics_refractive = False
        c.sample_clamp_indirect = 6
        c.blur_glossy = 1.0
        r.use_persistent_data = True
        ctx.samples = spp
    if os.environ.get("PRODKIT_PREVIEW"):
        r.resolution_percentage = 50
        if engine == "EEVEE":
            scn.eevee.taa_render_samples = 4
        else:
            scn.cycles.samples = 4
        ctx.samples = 4
    ctx.engine = "EEVEE" if engine == "EEVEE" else "CYCLES"
    r.use_motion_blur = bool(motion_blur)
    r.motion_blur_shutter = 0.5 * ctx.mb
    r.film_transparent = False
    vs = scn.view_settings
    vs.view_transform = "AgX"
    try:
        vs.look = "AgX - Medium High Contrast"
    except TypeError:
        pass
    im = r.image_settings
    im.file_format = "PNG"
    im.color_mode = "RGB"
    im.color_depth = "8"
    im.compression = 15
    r.filepath = os.path.join(ctx.out, "frames", "f_")
    r.use_file_extension = True
    return scn


def save_blend(ctx):
    path = os.path.join(ctx.out, "scene.blend")
    with quiet(ctx.blog):
        try:
            bpy.ops.file.pack_all()
        except RuntimeError:
            pass
        bpy.ops.wm.save_as_mainfile(filepath=path, compress=True, relative_remap=False)
    ctx.blend_mb = round(os.path.getsize(path) / 1e6, 2)
    log(f"blend {ctx.blend_mb} MB")


def export_glb(ctx, objs=None, animated=True):
    if not ctx.export_glb:
        return None
    path = os.path.join(ctx.out, "scene.glb")
    t = time.time()
    try:
        if objs is not None:
            for o in bpy.context.scene.objects:
                o.select_set(o in objs)
        with quiet(ctx.blog):
            bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_animations=animated, use_selection=objs is not None,
                                      export_cameras=False, export_lights=False, export_apply=True,
                                      export_yup=True, export_force_sampling=True)
        log(f"glb {time.time() - t:.1f}s")
        return "scene.glb" if os.path.exists(path) else None
    except Exception as e:
        log("glb export failed", str(e)[:120])
        return None


def render(ctx):
    scn = bpy.context.scene
    fdir = os.path.join(ctx.out, "frames")
    shutil.rmtree(fdir, ignore_errors=True)
    os.makedirs(fdir, exist_ok=True)
    n = scn.frame_end - scn.frame_start + 1
    step = max(1, n // 8)
    st = {"t": time.time()}

    def post(sc, *a):
        f = sc.frame_current - sc.frame_start + 1
        if f % step == 0 or f == n:
            log(f"render {f}/{n} {time.time() - st['t']:.0f}s")

    bpy.app.handlers.render_write.append(post)
    log(f"render {ctx.engine}/{ctx.device} {ctx.w}x{ctx.h}@{scn.render.resolution_percentage}% spp={ctx.samples} frames={n}")
    t = time.time()
    with quiet(ctx.blog):
        bpy.ops.render.render(animation=True)
    bpy.app.handlers.render_write.remove(post)
    ctx.render_seconds = round(time.time() - t, 1)
    encode(ctx, fdir)


def encode(ctx, fdir):
    mp4 = os.path.join(ctx.out, "render.mp4")
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-framerate", str(ctx.fps), "-i", os.path.join(fdir, "f_%04d.png"),
           "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode or not os.path.exists(mp4):
        raise RuntimeError("ffmpeg encode failed: " + r.stderr[-200:])
    pf = min(max(1, ctx.poster_frame), ctx.frames)
    src = os.path.join(fdir, f"f_{pf:04d}.png")
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src, "-q:v", "2", os.path.join(ctx.out, "poster.jpg")], check=True)
    if not os.environ.get("PRODKIT_KEEP_FRAMES"):
        shutil.rmtree(fdir, ignore_errors=True)


def manifest(ctx, recipe, glb):
    m = {"ok": True, "recipe": recipe, "video": "render.mp4", "poster": "poster.jpg", "blend": "scene.blend",
         "width": ctx.w, "height": ctx.h, "fps": ctx.fps, "frames": ctx.frames, "seconds": round(ctx.frames / ctx.fps, 3),
         "device": ctx.device if ctx.engine == "CYCLES" else "EEVEE", "engine": ctx.engine,
         "render_seconds": getattr(ctx, "render_seconds", 0), "total_seconds": round(time.time() - ctx.t0, 1),
         "stats": dict(ctx.stats, samples=ctx.samples, quality=ctx.quality, blend_mb=getattr(ctx, "blend_mb", 0))}
    if glb:
        m["glb"] = glb
    return m
