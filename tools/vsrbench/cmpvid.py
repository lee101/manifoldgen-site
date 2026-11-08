import cv2, numpy as np, subprocess, sys, os
def run(name, variants, box):
    x, y, w, h = box
    caps = [cv2.VideoCapture(p) for _, p in variants]
    fps = caps[0].get(cv2.CAP_PROP_FPS)
    W = w * len(variants)
    pr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{h}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "17", "-pix_fmt", "yuv420p", f"out/sheets/{name}.mp4"], stdin=subprocess.PIPE)
    while True:
        fr = []
        for c in caps:
            ok, f = c.read()
            if not ok:
                break
            fr.append(f)
        if len(fr) < len(caps):
            break
        ps = []
        for (lab, _), f in zip(variants, fr):
            p = f[y:y + h, x:x + w].copy()
            cv2.rectangle(p, (0, 0), (w, 34), (0, 0, 0), -1)
            cv2.putText(p, lab, (8, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
            ps.append(p)
        pr.stdin.write(np.hstack(ps).tobytes())
    pr.stdin.close(); pr.wait()
run("video_potter_x2", [("lanczos", "out/real_lanczos/potter.mp4"), ("RealESRGAN", "out/real_esrgan/potter.mp4"), ("RelayVSR x2", "out/real_relay2/potter.mp4")], (498, 806, 540, 720))
run("video_dancer_x2", [("lanczos", "out/real_lanczos/dancer.mp4"), ("RealESRGAN", "out/real_esrgan/dancer.mp4"), ("RelayVSR x2", "out/real_relay2/dancer.mp4")], (1024, 460, 640, 720))
run("video_dancer_x4", [("lanczos x4", "out/lanczos4/dancer.mp4"), ("RealESRGAN x4", "out/esrgan4/dancer.mp4"), ("RelayVSR x4", "out/relay4/dancer_warm.mp4"), ("ground truth", "clips/gt/dancer.mp4")], (650, 300, 420, 540))
print(os.listdir("out/sheets"))
