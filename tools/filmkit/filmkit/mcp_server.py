"""Minimal MCP stdio server (JSON-RPC 2.0, newline-delimited) exposing filmkit.tools to any agent."""
from __future__ import annotations

import json
import sys
import traceback

from .tools import BY_NAME, manifest


def _reply(id_, result=None, error=None):
    msg = {"jsonrpc": "2.0", "id": id_}
    msg.update({"error": error} if error else {"result": result})
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()


def serve() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        req = json.loads(line)
        method, id_, params = req.get("method"), req.get("id"), req.get("params") or {}
        if id_ is None:  # notification
            continue
        if method == "initialize":
            _reply(id_, {"protocolVersion": params.get("protocolVersion", "2024-11-05"), "capabilities": {"tools": {}},
                         "serverInfo": {"name": "filmkit", "version": "0.1.0"}})
        elif method == "tools/list":
            _reply(id_, {"tools": manifest()})
        elif method == "tools/call":
            name = params.get("name")
            if name not in BY_NAME:
                _reply(id_, error={"code": -32602, "message": f"unknown tool {name}"})
                continue
            try:
                out = BY_NAME[name][2](params.get("arguments") or {})
                _reply(id_, {"content": [{"type": "text", "text": json.dumps(out, ensure_ascii=False, default=str)}]})
            except Exception as exc:
                _reply(id_, {"isError": True, "content": [{"type": "text", "text": f"{exc}\n{traceback.format_exc()[-600:]}"}]})
        elif method == "ping":
            _reply(id_, {})
        else:
            _reply(id_, error={"code": -32601, "message": f"method not found: {method}"})
