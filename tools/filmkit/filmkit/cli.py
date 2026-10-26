"""filmkit CLI: `filmkit tools --json` (agent manifest), `filmkit mcp` (stdio MCP server), `filmkit call <tool> '<json>'`."""
from __future__ import annotations

import json
import sys


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    cmd = argv[0] if argv else "tools"
    if cmd == "mcp":
        from .mcp_server import serve
        serve()
    elif cmd == "tools":
        from .tools import manifest
        print(json.dumps(manifest(), indent=2) if "--json" in argv else "\n".join(f"{t['name']:<18}{t['description'][:110]}" for t in manifest()))
    elif cmd == "call":
        from .tools import BY_NAME
        print(json.dumps(BY_NAME[argv[1]][2](json.loads(argv[2] if len(argv) > 2 else "{}")), indent=2, ensure_ascii=False, default=str))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
