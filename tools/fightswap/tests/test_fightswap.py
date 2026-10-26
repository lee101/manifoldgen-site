from PIL import Image

from fightswap import cast, assemble, pipeline


def test_board_order_and_face_crop(tmp_path):
    a, b = tmp_path / "a.png", tmp_path / "b.png"
    Image.new("RGB", (300, 400), (255, 0, 0)).save(a)
    Image.new("RGB", (300, 400), (0, 0, 255)).save(b)
    out = cast.board_for([b, a], tmp_path / "board.jpg", height=200, gap=10)
    im = Image.open(out)
    assert im.getpixel((40, 100))[2] > 200 and im.getpixel((im.width - 40, 100))[0] > 200  # blue left, red right
    face = Image.open(cast.board_for([a], tmp_path / "face.jpg", height=200, gap=10, face=True))
    assert face.height < Image.open(cast.board_for([a], tmp_path / "full.jpg", height=200, gap=10)).height * 1.01 and face.width > 200 * 300 / 200 * 0.9


def test_swap_prompt_names_each_side():
    p = cast.swap_prompt([("man in white top", "Elon"), ("man in black top", "Sam")], ["left", "right"])
    assert p.index("left person") < p.index("right person") and "Elon" in p and "<Picture 1>" in p


def test_pipeline_ghibli_style_and_single_prompt():
    assert "Ghibli" in pipeline.single_prompt("man in white top", "Elon", "the other person", "ghibli")
    assert "Ghibli" not in pipeline.single_prompt("man in white top", "Elon", "the other person", "real")


def test_exertion_text_scales_with_level():
    from fightswap import fx
    assert fx.exertion_text("Ship it.", 0.1) == "Ship it."
    assert fx.exertion_text("Ship it.", 0.6).startswith("(breath)") and fx.exertion_text("Ship it.", 0.6).endswith("(pant)")
    assert "(gasps)" in fx.exertion_text("Okay. Sure.", 0.9)


def test_relay_graph_substitutions(monkeypatch):
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "workers/h3-swap"))
    import swap_relay
    fake = {k: {"class_type": "X", "inputs": {}} for k in ("source", "reference", "subject", "reference_conditioning", "adapter", "plan", "schedule",
                                                           "expand_mask", "prepare", "detect", "select", "save", "window", "mask_preview")}
    monkeypatch.setattr(swap_relay, "template", lambda: __import__("copy").deepcopy(fake))
    g = swap_relay.build_relay_graph(prompt="p", subject="person", video_name="v.mp4", image_name="r.png", seed=5, anchor_name="a.png", blur_scale=0.125)
    assert g["subject"]["inputs"]["text"] == "person" and g["window"]["inputs"]["anchor"] == ["anchor_img", 0]
    assert g["window"]["inputs"]["source"] == ["blur_comp", 0] and "mask_preview" not in g and g["plan"]["inputs"]["seed"] == 5


def test_pod_budget_cap(tmp_path, monkeypatch):
    from fightswap import pod
    monkeypatch.setattr(pod, "BUDGET", tmp_path / "b.json")
    monkeypatch.setattr(pod, "DAILY_CAP_MIN", 100)
    pod._budget(60)
    import pytest
    with pytest.raises(RuntimeError):
        pod._budget(60)
