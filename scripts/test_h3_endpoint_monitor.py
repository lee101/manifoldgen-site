import h3_endpoint_monitor as m

H = lambda done, running, prog, q=0, **w: {"jobs": {"completed": done, "inProgress": prog, "inQueue": q}, "workers": {"running": running, **w}}


def test_stuck_needs_three_frozen_checks():
    s, issues = {}, []
    for _ in range(3):
        s, issues = m.detect(s, H(35, 2, 2))
    assert issues and issues[0].startswith("STUCK")
    s, issues = m.detect(s, H(36, 2, 2))  # counter moved: reset
    assert not issues and s["stuck"] == 0


def test_idle_endpoint_is_never_stuck():
    s = {}
    for _ in range(5):
        s, issues = m.detect(s, H(35, 0, 0, idle=1))
    assert not issues


def test_backlog_only_when_nothing_is_starting():
    s = {}
    for _ in range(3):
        s, issues = m.detect(s, H(1, 0, 0, q=2, initializing=1))
    assert not issues
    for _ in range(3):
        s, issues = m.detect(s, H(1, 0, 0, q=2))
    assert issues and issues[0].startswith("BACKLOG")


def test_triage_falls_through_terra_to_deepseek_then_to_none():
    def dead(_): raise RuntimeError("402 insufficient credits")
    assert m.triage("p", (("gpt-6.1-terra", dead), ("deepseek-flash", lambda _: "ok")))[0] == "deepseek-flash"
    who, text = m.triage("p", (("a", dead), ("b", dead)))
    assert who == "none" and "402" in text
