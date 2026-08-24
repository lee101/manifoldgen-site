#!/usr/bin/env python3
"""Download blog media, extract poster frames, and build OG images."""
import os, subprocess, tempfile, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, 'frontend', 'public', 'blog', 'media')
OG = os.path.join(ROOT, 'frontend', 'public', 'blog', 'og')
STATIC = 'https://manifoldgenstatic.manifoldgen.com/gallery'

VIDEOS = {
    'how-to-make-ai-video-from-script/storm-cliff': f'{STATIC}/2176d271-9e3/videos/14290676-96db-4dcb-bf7d-3452161e73b8.webm',
    'how-to-make-ai-video-from-script/lamp-room': f'{STATIC}/2176d271-9e3/videos/aca33426-88ab-45b0-958a-307ef927fa41.webm',
    'how-to-make-ai-video-look-real/fish-market': f'{STATIC}/2176d271-9e3/videos/e3b61ad1-2cf9-4666-8340-9db6c49a0dfd.webm',
    'how-to-make-ai-video-look-real/kitchen-golden-hour': f'{STATIC}/2176d271-9e3/videos/0a2e7519-1f33-440e-a63c-b533112dcf60.webm',
    'ai-content-for-tiktok/iced-coffee-macro': f'{STATIC}/2176d271-9e3/videos/a9533e91-7b28-44f5-b78c-420dbd4f66d2.webm',
    'ai-product-videos-without-a-studio/perfume-loop': f'{STATIC}/2176d271-9e3/videos/3c860243-1515-44ad-94df-5479394bea5c.webm',
    'start-faceless-channel-with-ai/cozy-rain-nook': f'{STATIC}/2176d271-9e3/videos/15f03689-085f-4a55-b31f-c6ff05c92fd9.webm',
    'camera-movement-angles-and-lenses/salt-flat-dolly-in': f'{STATIC}/2176d271-9e3/videos/e3754003-2c0d-4c83-a7ac-1112885d4a03.webm',
    'camera-movement-angles-and-lenses/salt-flat-orbit': f'{STATIC}/2176d271-9e3/videos/9685c845-1dbe-4ff4-b240-5b95dac22144.webm',
    'camera-movement-angles-and-lenses/salt-flat-crane-up': f'{STATIC}/2176d271-9e3/videos/fde75e25-c8ae-4707-924c-2dc9bf06dd43.webm',
    'turn-photo-into-ai-video/golden-retriever': f'{STATIC}/2176d271-9e3/videos/8a933bd7-f580-4940-9a7c-bdda6d97c95e.webm',
    'documentary-videos-with-ai/shipyard-push-in': f'{STATIC}/2176d271-9e3/videos/3ff92491-b5d9-4d36-a3e1-2e55820eede5.webm',
    'consistent-characters-and-locations/moss-cave-shot': f'{STATIC}/2176d271-9e3/videos/814132c4-b19f-47f9-9bfb-43298fe374db.webm',
    'consistent-characters-and-locations/jungle-trail-shot': f'{STATIC}/2176d271-9e3/videos/1ca12ef6-6d50-4a84-8723-da33f6770618.webm',
}
IMAGES = {
    'turn-photo-into-ai-video/source-photo': f'{STATIC}/originals/6353a3f88c56b8ae_160c18ac.webp',
    'documentary-videos-with-ai/archive-still': f'{STATIC}/originals/c5465d98c7eb5fad_cb32b789.webp',
    'consistent-characters-and-locations/character-sheet': f'{STATIC}/originals/992bf65558a68fdf_016be2f4.webp',
    'prompting-images-composition-light/ceramicist': f'{STATIC}/originals/bb9b5fa973ce8602_0dd69482.webp',
}

def fetch(url, dest):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, 'wb') as f:
        f.write(r.read())
    print(f'  {dest} ({os.path.getsize(dest)//1024} KB)')

def poster(video_path):
    jpg = os.path.splitext(video_path)[0] + '.jpg'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', video_path,
                    '-frames:v', '1', '-q:v', '3', jpg], check=True)
    return jpg

# --- OG card sources ------------------------------------------------------
SHOWCASE_TORUS = os.path.join(ROOT, 'frontend', 'public', 'showcase', 'h3-loop-glass-torus.webm')
OG_SOURCES = {
    'how-to-make-ai-video-from-script': ('video', MEDIA + '/how-to-make-ai-video-from-script/storm-cliff.webm'),
    'how-to-make-ai-video-look-real': ('video', MEDIA + '/how-to-make-ai-video-look-real/fish-market.webm'),
    'ai-content-for-tiktok': ('video', MEDIA + '/ai-content-for-tiktok/iced-coffee-macro.webm'),
    'documentary-videos-with-ai': ('image', MEDIA + '/documentary-videos-with-ai/archive-still.webp'),
    'turn-photo-into-ai-video': ('video', MEDIA + '/turn-photo-into-ai-video/golden-retriever.webm'),
    'ai-product-videos-without-a-studio': ('video', MEDIA + '/ai-product-videos-without-a-studio/perfume-loop.webm'),
    'start-faceless-channel-with-ai': ('video', MEDIA + '/start-faceless-channel-with-ai/cozy-rain-nook.webm'),
    'index': ('video', MEDIA + '/camera-movement-angles-and-lenses/salt-flat-crane-up.webm'),
    'camera-movement-angles-and-lenses': ('video', MEDIA + '/camera-movement-angles-and-lenses/salt-flat-orbit.webm'),
    'cutedsl-latent-teleportation-faster-generation': ('image', os.path.join(MEDIA, '_art', 'lattice.webp')),
    'prompting-video-motion-camera-language': ('video', SHOWCASE_TORUS),
    'prompting-images-composition-light': ('image', MEDIA + '/prompting-images-composition-light/ceramicist.webp'),
    'seedance-vs-kling-vs-veo': ('video', SHOWCASE_TORUS),
    'best-ai-video-model-for-anime': ('image', MEDIA + '/consistent-characters-and-locations/character-sheet.webp'),
    'best-ai-video-model-for-product-ads': ('video', MEDIA + '/ai-product-videos-without-a-studio/perfume-loop.webm'),
    'ai-video-api-cost-guide-2026': ('video', MEDIA + '/how-to-make-ai-video-look-real/fish-market.webm'),
}
OG_TITLES = {
    'index': ('MANIFOLDGEN BLOG', 'AI Video Guides With Real Prompts and Real Outputs'),
    'how-to-make-ai-video-from-script': ('GUIDE', 'How to Make an AI Video From a Script in 2026'),
    'how-to-make-ai-video-look-real': ('GUIDE', 'How to Make AI Video Look Real in 2026'),
    'ai-content-for-tiktok': ('GUIDE', 'How to Create AI Content for TikTok in 2026'),
    'documentary-videos-with-ai': ('GUIDE', 'How to Make Documentary Videos With AI in 2026'),
    'turn-photo-into-ai-video': ('GUIDE', 'How to Turn a Photo Into an AI Video'),
    'ai-product-videos-without-a-studio': ('GUIDE', 'AI Product Videos Without a Studio'),
    'start-faceless-channel-with-ai': ('GUIDE', 'How to Start a Faceless Channel With AI'),
    'consistent-characters-and-locations': ('GUIDE', 'Keep Characters and Locations Consistent Across AI Shots'),
    'camera-movement-angles-and-lenses': ('PROMPT CRAFT', 'Control Camera Movement, Angles, and Lens in AI Video'),
    'cutedsl-latent-teleportation-faster-generation': ('SYSTEMS', 'Latent Teleportation: The Shortest Path to Faster Generation'),
    'prompting-video-motion-camera-language': ('PROMPT CRAFT', 'Describe the Shot, Not a Pile of Adjectives'),
    'prompting-images-composition-light': ('PROMPT CRAFT', 'Composition First, Detail Second'),
    'seedance-vs-kling-vs-veo': ('MODEL COMPARISON', 'Seedance 2 vs Kling 3.0 vs Veo 3.1'),
    'best-ai-video-model-for-anime': ('USE CASE', 'Best AI Video Model for Anime'),
    'best-ai-video-model-for-product-ads': ('USE CASE', 'Best AI Video Model for Product Ads'),
    'ai-video-api-cost-guide-2026': ('API & PRICING', 'The Real Cost of an AI Video API in 2026'),
}
ACCENT = (123, 231, 217)   # #7be7d9
VIOLET = (188, 178, 255)   # #bcb2ff

def load_font(size):
    from PIL import ImageFont
    candidates = [
        os.path.join(tempfile.gettempdir(), 'SpaceGrotesk.ttf'),
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    ]
    for path in candidates:
        if not os.path.exists(path):
            continue
        font = ImageFont.truetype(path, size)
        try:
            font.set_variation_by_name('Bold')
        except Exception:
            pass
        return font
    raise SystemExit('no font found')

def wrap(draw, text, font, max_width):
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if draw.textlength(trial, font=font) <= max_width or not line:
            line = trial
        else:
            lines.append(line)
            line = word
    if line:
        lines.append(line)
    return lines

def build_og(sources):
    from PIL import Image, ImageDraw
    W, H = 1200, 630
    os.makedirs(OG, exist_ok=True)
    title_font = load_font(64)
    eyebrow_font = load_font(26)
    mark_font = load_font(30)
    for slug, (kind, src) in sources.items():
        if kind == 'video':
            tmp = os.path.join(OG, f'.{os.path.basename(src)}.jpg')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', '1.5', '-i', src,
                            '-frames:v', '1', '-q:v', '2', tmp], check=True)
            base = Image.open(tmp).convert('RGB')
            os.remove(tmp)
        else:
            base = Image.open(src).convert('RGB')
        # cover-crop to 1200x630
        scale = max(W / base.width, H / base.height)
        base = base.resize((round(base.width * scale), round(base.height * scale)), Image.LANCZOS)
        x = (base.width - W) // 2
        y = (base.height - H) // 2
        img = base.crop((x, y, x + W, y + H))
        overlay = Image.new('RGBA', (W, H))
        grad = ImageDraw.Draw(overlay)
        for i in range(H):
            a = int(200 * max(0.0, (i / H) ** 1.6))
            grad.line([(0, i), (W, i)], fill=(7, 7, 10, min(a, 210)))
        img = Image.alpha_composite(img.convert('RGBA'), overlay).convert('RGB')
        d = ImageDraw.Draw(img)
        eyebrow, title = OG_TITLES[slug]
        # brand mark
        d.rounded_rectangle((48, 48, 92, 92), radius=12, fill=(255, 255, 255))
        d.text((70, 70), 'M', font=mark_font, fill=(12, 13, 16), anchor='mm')
        d.text((108, 70), 'MANIFOLDGEN', font=eyebrow_font, fill=(255, 255, 255, 230), anchor='lm')
        # accent bar + eyebrow
        d.rectangle((48, 400, 96, 408), fill=(*ACCENT,))
        d.text((110, 404), eyebrow, font=eyebrow_font, fill=(*VIOLET,), anchor='lm')
        y = 430
        for line in wrap(d, title, title_font, W - 100):
            d.text((50, y), line, font=title_font, fill=(255, 255, 255))
            y += 74
        out = os.path.join(OG, f'{slug}.jpg')
        img.save(out, 'JPEG', quality=90)
        print(f'  og: {out}')

if __name__ == '__main__':
    print('downloading videos...')
    for key, url in VIDEOS.items():
        dest = os.path.join(MEDIA, key + '.webm')
        if not os.path.exists(dest):
            fetch(url, dest)
        poster(dest)
    print('downloading images...')
    for key, url in IMAGES.items():
        dest = os.path.join(MEDIA, key + '.webp')
        if not os.path.exists(dest):
            fetch(url, dest)
    art_dir = os.path.join(MEDIA, '_art')
    os.makedirs(art_dir, exist_ok=True)
    lattice = os.path.join(art_dir, 'lattice.webp')
    if not os.path.exists(lattice):
        fetch(f'{STATIC}/originals/ed0b28b1808b60b4_7bf318ba.webp', lattice)
    print('building og images...')
    build_og(OG_SOURCES)
    print('done.')
