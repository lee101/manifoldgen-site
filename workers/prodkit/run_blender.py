import sys, os, json, importlib, traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import core

RECIPES = ("destruction", "exploded_view", "toon_shader", "scene")


def finish(out, m, code):
    if out:
        with open(os.path.join(out, "manifest.json"), "w") as f:
            json.dump(m, f, indent=1)
    core.log("PRODKIT_RESULT " + json.dumps(m if not m.get("ok") else {k: m[k] for k in ("ok", "recipe", "render_seconds", "total_seconds")}))
    sys.stdout.flush()
    os._exit(code)


def main():
    out = None
    try:
        argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
        if not argv:
            raise core.UserError("usage: -- /abs/args.json")
        with open(argv[0]) as f:
            args = json.load(f)
        if not isinstance(args, dict) or not isinstance(args.get("out"), str) or not os.path.isabs(args["out"]):
            raise core.UserError("args.out must be an absolute path")
        out = args["out"]
        os.makedirs(out, exist_ok=True)
        recipe = args.get("recipe")
        if recipe not in RECIPES:
            raise core.UserError("unknown recipe")
        ctx = core.Ctx(args)
        core.log(f"prodkit {recipe} {ctx.quality} {ctx.w}x{ctx.h} {ctx.frames}f@{ctx.fps}")
        glb = importlib.import_module("recipes." + recipe).run(ctx)
        finish(out, core.manifest(ctx, recipe, glb), 0)
    except core.UserError as e:
        finish(out, {"ok": False, "error": str(e)[:300]}, 2)
    except Exception as e:
        tb = traceback.format_exc()
        if out:
            with open(os.path.join(out, "error.log"), "w") as f:
                f.write(tb)
        core.log(tb[-1500:])
        finish(out, {"ok": False, "error": (type(e).__name__ + ": " + str(e))[:300]}, 1)


main()
