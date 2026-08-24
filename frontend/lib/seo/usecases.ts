import type { UseCase } from '@/lib/seo/types';

export const USE_CASES: UseCase[] = [
  {
    slug: 'text-to-video',
    h1: 'Text to Video AI',
    title: 'AI Text to Video Generator — From $0.09 a Clip',
    metaDescription:
      'Turn text prompts into video on ManifoldGen. Seedance 2 for cinematic quality with audio, LTX 2 from $0.09, Wan at $0.15 per second. One API key.',
    intro:
      'The best text-to-video tool on ManifoldGen is Seedance 2 for final shots and LTX 2 for drafts: LTX starts at just 9 credits (~$0.09) per clip, the cheapest real generator on the platform. Every model shares one API key and credit balance, so you can switch quality tiers per shot without changing providers.',
    audience:
      'Marketers, creators, and developers who need finished clips or cheap drafts directly from written prompts.',
    workflow: [
      {
        step: 'Write a shot-level prompt',
        detail:
          'Describe subject, action, camera move, lighting, and lens in one or two sentences. Concrete nouns and one camera instruction beat long paragraphs.',
      },
      {
        step: 'Pick the tier',
        detail:
          'Draft on LTX 2 (~$0.09) or Wan (~$0.90 per 5s). Final renders on Seedance 2 (~$1.67 per 5s) when you want native audio and 1080p.',
      },
      {
        step: 'Generate and refine',
        detail:
          'Reroll weak clips with tightened prompts rather than editing around flaws. Iterate in ManifoldGen Studio until timing reads correctly.',
      },
      {
        step: 'Export and add sound',
        detail:
          'Seedance 2 ships synchronized audio. For silent models, layer a $0.35 music track or TTS voiceover before export.',
      },
    ],
    recommendedModels: [
      {
        slug: 'seedance',
        why: 'Best prompt fidelity and cinematic motion, with generated synchronized audio and 1080p output from ~$1.67 per 5s clip.',
      },
      {
        slug: 'ltx',
        why: 'Cheapest text-to-video on the platform: LTX 2 starts at 9 credits (~$0.09) per clip, ideal for volume drafting.',
      },
      {
        slug: 'wan',
        why: 'Versatile styles and camera-move control at ~$0.90 per 5s, roughly half of Seedance Fast, if you do not need audio or 1080p.',
      },
    ],
    prompts: [
      'Slow dolly-in through an abandoned train station at dawn, dust motes floating in shafts of amber light, shallow depth of field, 35mm film grain, volumetric haze, quiet and tense atmosphere, photorealistic, no text',
      'Aerial drone shot pulling back over a fog-covered pine forest at sunrise, camera rising smoothly above the treeline, soft pastel sky, cinematic color grade, steady motion, photorealistic detail, no text',
      'Close-up of espresso pouring into a glass cup in slow motion, crema swirling, warm kitchen light, macro lens, steam curling upward, crisp focus on the liquid, shallow background blur, commercial look, no text',
      'Neon-lit Tokyo alley in heavy rain, reflections shimmering on wet asphalt, lone figure with umbrella walking away from camera, cyberpunk palette of magenta and cyan, anamorphic flares, moody night cinematography, no text',
    ],
    faqs: [
      {
        q: 'How much does text-to-video cost?',
        a: 'LTX 2 starts at 9 credits (~$0.09) per clip. Wan runs about $0.15 per second (~$0.90 for 5s). Seedance 2 costs roughly $1.67 per 5-second clip at full quality. One credit equals $0.01, prepaid, no subscription needed.',
      },
      {
        q: 'Which AI video model should I use for text-to-video?',
        a: 'Use Seedance 2 for final cinematic shots because it follows complex prompts best and generates audio. Use LTX 2 or Wan while iterating; they cost under a dollar per clip, so rerolls are cheap.',
      },
      {
        q: 'Do I own the videos I generate?',
        a: 'Yes. Clips you generate on your ManifoldGen account are yours to use commercially. Credits are prepaid and every generation is logged against your job history.',
      },
      {
        q: 'How do I start generating videos from text?',
        a: 'Open https://manifoldgen.com/studio, type a prompt, pick a model, and generate. Developers can call the same models through the REST API with one key and credit balance.',
      },
    ],
    mediaKey: 'usecase-text-to-video',
  },
  {
    slug: 'image-to-video',
    h1: 'AI Image to Video Generator',
    title: 'AI Image to Video Generator — Animate Any Still',
    metaDescription:
      'Animate photos into video on ManifoldGen. LTX 2.3 for reliable 1080p, Happy Horse for expressive characters, Seedance for cinematic motion with audio.',
    intro:
      'LTX 2.3 is the most dependable image-to-video lane on ManifoldGen: coherent motion and solid 1080p landscape output at about $1.68 per 6-second clip. For expressive character animation, Happy Horse adds lively motion to any still from 168 credits (~$1.68).',
    audience:
      'Photographers, e-commerce teams, and animators turning stills, portraits, and product shots into moving footage.',
    workflow: [
      {
        step: 'Prepare the source image',
        detail:
          'Generate a base frame first with FLUX.2 [dev] at $0.04 per image, or upload your own photo. Clean composition and clear subjects animate best.',
      },
      {
        step: 'Match model to subject',
        detail:
          'Landscapes and products go to LTX 2.3 for stable 1080p. Stylized characters and dance-like energy go to Happy Horse. Cinematic people shots go to Seedance Image.',
      },
      {
        step: 'Prompt the motion',
        detail:
          'Keep motion instructions short and singular: one camera move, one subject action. Overloaded motion prompts cause warping and flicker.',
      },
      {
        step: 'Refine and export',
        detail:
          'Reroll with simplified motion if limbs or edges smear. Silent outputs take a $0.35 music bed or SFX pass before publishing.',
      },
    ],
    recommendedModels: [
      {
        slug: 'ltx',
        why: 'LTX 2.3 image-to-video delivers dependable 1080p output at about $1.68 per 6-second clip, the safest bet for product and landscape stills.',
      },
      {
        slug: 'happy-horse',
        why: 'Tuned for expressive, playful animation of illustrated and stylized characters, from 168 credits (~$1.68) per clip at 720p.',
      },
      {
        slug: 'seedance',
        why: 'Seedance image-to-video keeps characters coherent through action and generates synchronized audio, best when the shot includes people moving.',
      },
    ],
    prompts: [
      'Animate this portrait: subject slowly turns toward camera, subtle smile forming, hair moving gently in a light breeze, background bokeh stays soft and static, natural skin texture preserved, smooth 24fps motion, no text',
      'Bring this product shot to life: slow 30-degree orbit around the bottle, studio highlights sweeping across the surface, condensation droplets glinting, background stays clean white, elegant commercial pacing, no text',
      'Animate this mountain landscape photograph: clouds drifting slowly across the peaks, grass swaying in the foreground valley, birds crossing the frame once, golden-hour light held constant, gentle parallax push-in, no text',
      'Make this cartoon character move: excited bounce, arms swinging wide, head tilting with a laugh, exaggerated squash-and-stretch energy, background elements lightly bobbing to the rhythm, playful Saturday-morning style, no text',
    ],
    faqs: [
      {
        q: 'How much does image-to-video cost?',
        a: 'LTX 2.3 runs about $1.68 per 6-second clip at 1080p. Happy Horse starts at 168 credits ($1.68) per clip, and Seedance image-to-video sits near $1.67 per 5 seconds. Credits are $0.01 each.',
      },
      {
        q: 'Which model is best for animating a still image?',
        a: 'LTX 2.3 for reliable 1080p scenes and products, Happy Horse for stylized characters that need expressive energy, and Seedance Image when people are in frame and you want synchronized audio.',
      },
      {
        q: 'Can I use animated images commercially?',
        a: 'Yes. Animations created from your own uploads or generated frames are yours for commercial use, including ads, social posts, and client work.',
      },
      {
        q: 'How do I animate my first image?',
        a: 'Upload a still at https://manifoldgen.com/studio, choose an image-to-video model, describe one motion, and generate. The API supports the same flow programmatically.',
      },
    ],
    mediaKey: 'usecase-image-to-video',
  },
  {
    slug: 'product-ads',
    h1: 'AI Product Ad Video Generator',
    title: 'AI Product Ad Videos — Studio Shots From $0.04',
    metaDescription:
      'Generate product ad videos on ManifoldGen: FLUX.2 stills at $0.04, LTX 2.3 orbits at 1080p, Seedance hero shots with audio. Prepaid credits, no subscription.',
    intro:
      'The fastest way to make a product ad on ManifoldGen is a FLUX.2 [dev] hero frame ($0.04) animated by LTX 2.3 at 1080p (~$1.68 per 6s). For a finished spot with sound, Seedance 2 renders cinematic reveals with synchronized audio for about $1.67 per 5 seconds.',
    audience:
      'E-commerce brands, agencies, and performance marketers producing paid social and marketplace ads at volume.',
    workflow: [
      {
        step: 'Build the hero frame',
        detail:
          'Generate packshot-style stills with FLUX.2 [dev] at $0.04 per image. Nano Banana 2 ($0.16) handles label edits and text rendering when packaging must stay exact.',
      },
      {
        step: 'Choose the reveal model',
        detail:
          'LTX 2.3 for clean orbits and pushes at 1080p. Seedance 2 when the ad needs dramatic motion and built-in audio for a single-clip cut.',
      },
      {
        step: 'Direct the camera',
        detail:
          'Prompt one move per clip: slow orbit, rack focus, or push-in on the logo side. Consistent lighting language across clips makes cuts seamless.',
      },
      {
        step: 'Assemble and voice',
        detail:
          'Cut variants together, add a $0.35 flat music track, then a TTS voiceover line. Export vertical and square crops for each placement.',
      },
    ],
    recommendedModels: [
      {
        slug: 'ltx',
        why: 'LTX 2.3 image-to-video gives stable 1080p product motion at ~$1.68 per 6s, cheap enough to produce a variant per placement.',
      },
      {
        slug: 'seedance',
        why: 'Highest-fidelity hero shots with strong prompt following and generated synchronized audio, ~$1.67 per 5s, so one clip can be the whole ad.',
      },
      {
        slug: 'manifold',
        why: 'Ordered keyframes and an exact stop frame let you pin exactly where the reveal starts and ends, from ~101 credits (~$1.01) including audio.',
      },
    ],
    prompts: [
      'Slow 360-degree orbit around a matte black skincare bottle on a marble pedestal, soft gradient backdrop, studio key light with rim highlight, water droplets on glass surface beside it, premium cosmetic commercial aesthetic, crisp reflections, no text',
      'Macro push-in on a sneaker mid-air, frozen above a puddle, splash crown erupting beneath it, high-speed photography look, dramatic side lighting, dark background, athletic brand energy, sharp fabric texture detail, no text',
      'Product reveal: velvet cloth sliding off a smartwatch, screen glowing to life, camera easing backward as light sweeps across the metal case, deep charcoal set, luxury tech commercial pacing, polished floor reflection, no text',
      'Overhead top-down shot of a coffee bag surrounded by scattered beans, steam wisping across frame, warm morning light raking left to right, camera drifting slowly downward, artisan roastery mood, rich brown palette, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI product ad video cost?',
        a: 'A working pipeline costs under $2: a $0.04 FLUX.2 hero image plus a ~$1.68 LTX 2.3 animation. A single Seedance 2 spot with audio runs about $1.67 per 5 seconds. Credits are prepaid at $0.01 each.',
      },
      {
        q: 'Which model should I use for product commercials?',
        a: 'LTX 2.3 for reliable 1080p orbits and pushes, Seedance 2 when you need one dramatic clip with native audio, and Manifold Video when exact start and stop framing matters for matching live-action plates.',
      },
      {
        q: 'Can I use these ads for commercial campaigns?',
        a: 'Yes. Generated assets on your account are cleared for commercial use across paid social, marketplaces, and broadcast-style placements.',
      },
      {
        q: 'How do I start making product ads?',
        a: 'Open https://manifoldgen.com/studio, generate a product still, then animate it with an image-to-video model. Teams automating variants should use the API with job IDs for async batch generation.',
      },
    ],
    mediaKey: 'usecase-product-ads',
  },
  {
    slug: 'ecommerce-videos',
    h1: 'AI Ecommerce Video Generator',
    title: 'AI Ecommerce Product Videos — Volume From $0.90',
    metaDescription:
      'Scale ecommerce catalog videos on ManifoldGen. Wan clips from ~$0.90, LTX 2.3 1080p showcases, lifestyle imagery at $0.04. One API key, prepaid credits.',
    intro:
      'For catalog-scale ecommerce video, Wan is the workhorse: broad styles and camera moves at roughly $0.15 per second (~$0.90 per 5s clip), half the cost of Seedance Fast. Reserve LTX 2.3 1080p animations (~$1.68 per 6s) for hero SKUs where resolution sells.',
    audience:
      'Marketplace sellers and DTC teams who need video for hundreds of SKUs without a production budget.',
    workflow: [
      {
        step: 'Template your shot list',
        detail:
          'Define two or three repeatable moves per SKU category: static rotate, lifestyle context, detail macro. Templates keep a catalog visually consistent.',
      },
      {
        step: 'Generate base imagery',
        detail:
          'Produce lifestyle stills with FLUX.2 [klein] at $0.03 per image, the cheapest on the platform, then animate the winners.',
      },
      {
        step: 'Batch generate',
        detail:
          'Run Wan for standard SKUs at ~$0.90 per clip and LTX 2.3 for hero items. Async jobs return IDs, so large batches queue unattended via API.',
      },
      {
        step: 'Standardize exports',
        detail:
          'Add a shared $0.35 music track per collection, normalize crops to marketplace specs, and publish per-SKU galleries.',
      },
    ],
    recommendedModels: [
      {
        slug: 'wan',
        why: 'Lowest sensible price for volume: ~$0.90 per 5-second clip with versatile styles, ideal when hundreds of SKUs each need a short loop.',
      },
      {
        slug: 'ltx',
        why: 'LTX 2.3 animates product stills into dependable 1080p showcase video at ~$1.68 per 6s for hero listings.',
      },
      {
        slug: 'ra2v',
        why: 'One routed endpoint returns polished general-purpose clips from 120 credits ($1.20), so API pipelines skip per-model logic entirely.',
      },
    ],
    prompts: [
      'Clean studio rotation of a ceramic mug on a turntable, soft even lighting, pale linen backdrop, gentle shadow beneath, minimalist Scandinavian styling, steady speed suitable for looping, warm neutral palette, no text',
      'Lifestyle scene: folded knit sweater resting on a wooden chair beside a window, curtains breathing in a light draft, dust motes in sunbeams, slow lateral drift, cozy autumn tones, catalog-ready composition, no text',
      'Macro glide across a leather wallet surface showing stitching grain, light sweeping to reveal texture, deep saddle-brown tone, dark walnut table below, premium craftsmanship mood, shallow depth of field, no text',
      'Wireless earbuds case opening in close-up, buds lifting slightly with a subtle hover, matte finish catching a cool blue rim light, seamless grey background, precise tech-product choreography, smooth eased motion, no text',
    ],
    faqs: [
      {
        q: 'How much does it cost to make ecommerce product videos with AI?',
        a: 'About $1 per SKU: a $0.03 base image plus a Wan clip at roughly $0.90 per 5 seconds. Hero products get LTX 2.3 1080p treatment at ~$1.68 per 6s. Credits are $0.01 each, prepaid.',
      },
      {
        q: 'What is the best AI video model for product listings?',
        a: 'Wan for high-volume standard listings thanks to its low price, LTX 2.3 for hero SKUs that need 1080p polish, and RA2V when your pipeline wants a single routed endpoint.',
      },
      {
        q: 'Do I own the catalog videos I generate?',
        a: 'Yes. Everything generated under your account is yours commercially, including marketplace listings, ads, and reseller pages.',
      },
      {
        q: 'How do I generate videos for many products at once?',
        a: 'Script the REST API: submit async jobs per SKU, keep the returned job IDs, and collect results when done. One key covers image, video, and audio generation.',
      },
    ],
    mediaKey: 'usecase-ecommerce-videos',
  },
  {
    slug: 'ugc-ads',
    h1: 'AI UGC Ad Video Generator',
    title: 'AI UGC Ads — Test Hooks Before You Spend',
    metaDescription:
      'Generate UGC-style ad videos on ManifoldGen. Seedance 2 for believable talking presence with audio, Wan for cheap hook variants. Prepaid credits, own everything.',
    intro:
      'Seedance 2 is the strongest choice for UGC-style ads on ManifoldGen: it keeps faces coherent through action and generates synced audio, around $1.67 per 5-second clip. Draft hooks on Wan at ~$0.90 per clip, then only pay for quality renders on the angles that test well.',
    audience:
      'Performance marketers and dropshippers running creative tests who need many authentic-feeling hooks fast.',
    workflow: [
      {
        step: 'Write the hook first',
        detail:
          'Lead with the payoff line in the prompt: what changes, who it is for. UGC lives or dies in the first two seconds.',
      },
      {
        step: 'Cast with references',
        detail:
          'Lock a consistent presenter across variants using Seedance Reference so split tests compare hooks, not different people.',
      },
      {
        step: 'Draft cheap, render once',
        detail:
          'Screen hook lines on Wan at ~$0.90 per 5s. Move winning scripts to Seedance 2 with native audio for the final cut.',
      },
      {
        step: 'Finish like a phone',
        detail:
          'Keep vertical framing, add captions over silent-safe playback, and layer TTS only where the model did not speak.',
      },
    ],
    recommendedModels: [
      {
        slug: 'seedance',
        why: 'Strongest character coherence and reference-guided consistency, with generated synchronized audio so the presenter speaks in-clip, ~$1.67 per 5s.',
      },
      {
        slug: 'wan',
        why: 'Cheap enough for mass hook testing at ~$0.90 per 5-second clip, with handheld-style camera-move prompting that reads as casual UGC.',
      },
      {
        slug: 'manifold',
        why: 'Ordered keyframes pin the exact reaction beat between start and stop frames, from ~101 credits (~$1.01) including audio.',
      },
    ],
    prompts: [
      'Selfie-style vertical clip: young woman in a car talking energetically to camera, afternoon sunlight through windshield, slight handheld shake, genuine surprised expression mid-sentence, casual hoodie, authentic smartphone framing, candid UGC feel, no text',
      'Handheld vertical shot: man unboxes a package on his kitchen counter, tearing tape, reacting with visible excitement, overhead mixed with eye-level angle, warm home lighting, imperfect framing like a real phone recording, no text',
      'POV walking clip through a grocery aisle, hand reaching for a product and holding it up to camera, fluorescent store lighting, natural wrist sway, friend-showing-you-something energy, vertical smartphone composition, no text',
      'Vertical mirror selfie video: person pointing at their outfit and grinning, bedroom cluttered realistically behind them, ring light glow, slight autofocus hunting, spontaneous influencer tone, natural body language throughout, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI UGC ad cost to generate?',
        a: 'Hook drafts run about $0.90 per 5-second clip on Wan. A final Seedance 2 version with synchronized audio is roughly $1.67 per 5 seconds, so testing ten hooks costs under $10 in credits.',
      },
      {
        q: 'Which model looks most like real UGC?',
        a: 'Seedance 2, because it holds facial coherence through speech-like motion and generates audio in-clip. Its reference mode keeps the same presenter across every variant in a test cell.',
      },
      {
        q: 'Can I run AI UGC ads commercially?',
        a: 'Yes. Generated presenters and clips are yours for paid placements. They are synthetic actors, not likenesses of real people, so there is no talent release to manage.',
      },
      {
        q: 'How do I start making UGC ads with AI?',
        a: 'Open https://manifoldgen.com/studio, paste a hook prompt, and generate a vertical draft. Wire the same prompts into the API to spin up test cells automatically.',
      },
    ],
    mediaKey: 'usecase-ugc-ads',
  },
  {
    slug: 'tiktok',
    h1: 'AI TikTok Video Generator',
    title: 'AI TikTok Videos — Vertical Clips From $0.90',
    metaDescription:
      'Make TikTok videos with AI on ManifoldGen: Wan clips from ~$0.90, Seedance 2 trends with synced audio, Happy Horse for meme energy. Own every clip.',
    intro:
      'Wan is the best value engine for TikTok volume on ManifoldGen at about $0.90 per 5-second clip, while Seedance 2 handles trend formats that need synchronized sound at ~$1.67. Both post straight from ManifoldGen Studio exports at vertical-friendly aspect ratios.',
    audience:
      'Creators, social managers, and trend-page operators posting daily vertical content.',
    workflow: [
      {
        step: 'Storyboard to the trend',
        detail:
          'Break the format into three beats: hook visual, escalation, payoff. Each beat becomes one 4-6 second generation.',
      },
      {
        step: 'Pick per-beat models',
        detail:
          'Silent aesthetic beats on Wan (~$0.90). Sound-on moments on Seedance 2. Meme-character beats on Happy Horse for exaggerated energy.',
      },
      {
        step: 'Generate and tighten',
        detail:
          'Cut dead frames aggressively; TikTok rewards pace. Reroll rather than settle, since drafts cost under a dollar.',
      },
      {
        step: 'Sound and caption',
        detail:
          'Trend audio usually comes from the platform, so export silent where needed. Add a $0.35 original music track when you want your own sound page.',
      },
    ],
    recommendedModels: [
      {
        slug: 'wan',
        why: 'Volume pricing at ~$0.15 per second (~$0.90 per 5s) with versatile styles, built for daily posting cadence without a subscription.',
      },
      {
        slug: 'seedance',
        why: 'Native synchronized audio plus strong prompt following makes trend and lip-sync adjacent formats work in a single ~$1.67 clip.',
      },
      {
        slug: 'happy-horse',
        why: 'Expressive, dance-like character animation from 168 credits ($1.68), tuned for meme-ready vertical energy at 720p.',
      },
    ],
    prompts: [
      'Vertical neon city rooftop at night, dancer silhouette hitting a freeze pose as drones streak past overhead, magenta and cyan signage bokeh below, camera whip-pans to follow the pose, kinetic music-video energy, high contrast, no text',
      'Vertical clip: cat wearing tiny sunglasses rides a skateboard down a suburban street at golden hour, tail streaming, camera tracking alongside at wheel height, neighbors blurred in background, absurd confident swagger, no text',
      'Vertical POV: hands open a glowing treasure chest in a dark room, light floods the frame and reflects off shocked eyes above, dust particles swirling, beat-drop timing on the lid crack, saturated fantasy grading, no text',
      'Vertical fashion transition: outfit changes with each jump-cut snap, bedroom doorway location constant, colored flash lighting shifts per outfit, confident strut into camera, snappy streetwear edit rhythm, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI TikTok video cost?',
        a: 'About $0.90 per 5-second clip on Wan, with unlimited rerolls at that rate. Seedance 2 clips with audio run ~$1.67 per 5 seconds. Credits cost $0.01 and never expire into a subscription.',
      },
      {
        q: 'What is the best AI video generator for TikTok?',
        a: 'Wan for daily volume, Seedance 2 when the trend needs sound baked into the clip, and Happy Horse for character memes. All three share one credit balance in ManifoldGen Studio.',
      },
      {
        q: 'Can I post AI videos on TikTok commercially?',
        a: 'Yes. Clips you generate are yours to monetize through creator funds, brand deals, and shop links. Label AI content per platform policy where required.',
      },
      {
        q: 'How do I create a TikTok video with AI?',
        a: 'Open https://manifoldgen.com/studio, write a three-beat prompt, generate vertical clips, and stitch them in your editor. The API lets scheduled posters fetch finished clips by job ID.',
      },
    ],
    mediaKey: 'usecase-tiktok',
  },
  {
    slug: 'youtube-shorts',
    h1: 'AI YouTube Shorts Video Generator',
    title: 'AI YouTube Shorts Generator — Clips From $0.09',
    metaDescription:
      'Generate YouTube Shorts with AI on ManifoldGen. Draft on LTX 2 from $0.09, render finals on Seedance 2 with audio. Prepaid credits, full ownership.',
    intro:
      'For YouTube Shorts, draft every segment on LTX 2 starting at 9 credits (~$0.09) per clip and render only the final cut on Seedance 2 (~$1.67 per 5s) for 1080p with synchronized audio. That split typically lands a finished Short under $5 in credits.',
    audience:
      'YouTubers, faceless-channel operators, and educators repurposing content into daily Shorts.',
    workflow: [
      {
        step: 'Script to segments',
        detail:
          'Write the Short as five to eight spoken lines. Each line maps to one visual segment you will generate separately.',
      },
      {
        step: 'Generate b-roll per line',
        detail:
          'Run all segments through LTX 2 first at ~$0.09 each to check pacing against the script before spending on quality.',
      },
      {
        step: 'Re-render the keepers',
        detail:
          'Send final segments to Seedance 2 for 1080p fidelity and native audio, keeping the approved timings unchanged.',
      },
      {
        step: 'Voice, music, export',
        detail:
          'Narrate with TTS if segments are silent, add a $0.35 music track under the mix, and export 9:16 for upload.',
      },
    ],
    recommendedModels: [
      {
        slug: 'ltx',
        why: 'Cheapest drafting anywhere: LTX 2 text-to-video starts at 9 credits (~$0.09) per clip, so scripting an entire Short costs pocket change.',
      },
      {
        slug: 'seedance',
        why: 'Final-render quality at 1080p with strong prompt following and generated synchronized audio, ~$1.67 per 5-second segment.',
      },
      {
        slug: 'ra2v',
        why: 'Single-endpoint routing from 120 credits ($1.20) suits automated channel pipelines that submit segments nightly via API.',
      },
    ],
    prompts: [
      'Vertical macro shot: match igniting in extreme slow motion, flame blooming toward camera, embers rising past the lens, black background, narration-friendly negative space at top of frame, dramatic orange rim lighting, no text',
      'Vertical timelapse-style clip: skyscraper construction cranes swinging as day flips to night, traffic light trails streaking below, camera slowly pushing up the building face, inspiring documentary energy, no text',
      'Vertical shot: chess piece slides forward and smashes through the board in surreal slow motion, fragments suspended midair, spotlight from above, deep shadows, metaphor-for-strategy visual, clean editorial look, no text',
      'Vertical underwater shot: diver descends past a sunken statue as light rays pierce blue water, bubbles trailing upward, camera drifting alongside, awe-inducing scale, crystal clarity, calm documentary pacing, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI-generated YouTube Short cost?',
        a: 'Under $5 typically: eight LTX 2 drafts at ~$0.09 each plus four Seedance 2 finals at ~$1.67 per 5 seconds. Credits are $0.01 each and prepaid with no subscription.',
      },
      {
        q: 'Which AI model works best for Shorts?',
        a: 'LTX 2 for cheap pacing drafts, Seedance 2 for final 1080p segments with built-in audio. If you automate uploads, RA2V offers one stable endpoint at $1.20 per clip.',
      },
      {
        q: 'Do AI Shorts count as my own content for monetization?',
        a: 'Yes. Outputs generated on your account belong to you commercially and are eligible for YouTube monetization when your channel meets standard requirements.',
      },
      {
        q: 'How do I make a YouTube Short with AI?',
        a: 'Write your script, open https://manifoldgen.com/studio, and generate one clip per line, or batch the segments through the API and assemble them in your editor.',
      },
    ],
    mediaKey: 'usecase-youtube-shorts',
  },
  {
    slug: 'music-videos',
    h1: 'AI Music Video Generator',
    title: 'AI Music Video Generator — Synced Visuals + Audio',
    metaDescription:
      'Make AI music videos on ManifoldGen. Original tracks from $0.35 flat, Seedance 2 performance visuals with synced audio, Manifold for beat-matched keyframes.',
    intro:
      'ManifoldGen covers both halves of a music video: original full-length tracks at $0.35 flat (vocals or instrumental, lyrics supported) and visuals led by Seedance 2, whose synchronized audio and cinematic motion fit performance cuts at ~$1.67 per 5-second clip.',
    audience:
      'Independent artists, labels, and editors producing visualizers and narrative videos without crews.',
    workflow: [
      {
        step: 'Generate the track',
        detail:
          'Create the song first for $0.35 flat, specifying genre, vocals versus instrumental, and custom lyrics up to 300 seconds.',
      },
      {
        step: 'Plan shots to sections',
        detail:
          'Map verse, chorus, bridge to shot lists. Aim for one 4-8 second clip per bar group so edits land on musical boundaries.',
      },
      {
        step: 'Generate visuals',
        detail:
          'Use Manifold Video keyframes to hit exact poses on downbeats, or Seedance 2 for flowing cinematic passages with generated ambience.',
      },
      {
        step: 'Sync and grade',
        detail:
          'Cut clips to the waveform, unify color across shots, and reuse the generated stems or SFX (~$0.86 per 5s estimate) for transitions.',
      },
    ],
    recommendedModels: [
      {
        slug: 'seedance',
        why: 'Cinematic motion with native synchronized audio and 1080p output at ~$1.67 per 5s, ideal for performance and narrative passages.',
      },
      {
        slug: 'manifold',
        why: 'Ordered keyframes and an exact stop frame let editors land poses precisely on downbeats, from ~101 credits (~$1.01) with audio included.',
      },
      {
        slug: 'happy-horse',
        why: 'Playful animated-character energy from 168 credits ($1.68) for stylized artist avatars and cartoon visualizer interludes.',
      },
    ],
    prompts: [
      'Rain-soaked city crosswalk at night, singer silhouetted under a single streetlight, slow-motion raindrops backlit by headlights, camera arcs from low angle to eye level, melancholic indie-music-video grade, teal and sodium orange, no text',
      'Desert highway at dusk, vintage convertible cruising away from camera, heat shimmer distorting the horizon, sun flare kissing the lens, camera drifting laterally at door height, nostalgic americana music video feel, no text',
      'Abandoned warehouse rave: strobing beams slice through fog as the crowd pulses in silhouette, confetti caught mid-air in freeze frames, handheld camera weaving through bodies, raw analog grain, underground techno energy, no text',
      'Cherry blossom courtyard in spring, figure in flowing dress spinning slowly as petals spiral around her, camera circling counter to her motion, soft backlight halo, dreamlike ballad atmosphere, pastel palette, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI music video cost to make?',
        a: 'The track is $0.35 flat regardless of length up to 300 seconds. Twenty visual clips on Seedance 2 run about $33 total at ~$1.67 per 5 seconds, cheaper than any shoot day.',
      },
      {
        q: 'Which model should I use for music video visuals?',
        a: 'Seedance 2 for flowing cinematic shots with native audio, Manifold Video when specific poses must land on downbeats via ordered keyframes, and Happy Horse for cartoon avatar segments.',
      },
      {
        q: 'Who owns the song and video generated this way?',
        a: 'You do. Tracks and visuals generated on your account are yours for release, distribution, and Content ID registration at your discretion.',
      },
      {
        q: 'How do I start making a music video with AI?',
        a: 'Generate your track in ManifoldGen Studio, build a shot list, then produce clips model-by-model at https://manifoldgen.com/studio. The API batches shot generation overnight.',
      },
    ],
    mediaKey: 'usecase-music-videos',
  },
  {
    slug: 'vfx',
    h1: 'AI VFX Video Generator',
    title: 'AI VFX Shots — Destruction & FX Plates From $1.01',
    metaDescription:
      'Generate VFX plates and destruction shots on ManifoldGen. Manifold keyframes for plate control from ~$1.01, Seedance 2 fire and water with audio at 1080p.',
    intro:
      'For VFX work, Manifold Video is the control pick: ordered keyframes and an exact stop frame give compositors predictable in and out points from ~101 credits (~$1.01). Seedance 2 handles complex simulation-like motion such as fire, smoke, and water at ~$1.67 per 5s with 1080p output.',
    audience:
      'Compositors, indie filmmakers, and previz artists generating FX plates, backgrounds, and set extensions.',
    workflow: [
      {
        step: 'Break the effect into layers',
        detail:
          'Split hero element, environment, and atmospheric passes. Generate each separately so you can comp them with real control.',
      },
      {
        step: 'Pin timing with keyframes',
        detail:
          'In Manifold Video, set the exact start and stop frames so the element enters and exits where your edit demands.',
      },
      {
        step: 'Generate simulation passes',
        detail:
          'Fire, debris, and water read best on Seedance 2 at 1080p. Generate multiple takes and choose the one whose physics read cleanest.',
      },
      {
        step: 'Integrate and mix',
        detail:
          'Track, key, and grade plates into your scene. Reuse generated audio beds or add SFX at ~$0.86 per 5 seconds for impact hits.',
      },
    ],
    recommendedModels: [
      {
        slug: 'manifold',
        why: 'Only generator with ordered keyframes and an exact stop frame, giving compositors deterministic timing from ~101 credits (~$1.01) including audio.',
      },
      {
        slug: 'seedance',
        why: 'Best complex-motion fidelity for fire, smoke, and water at 1080p with strong prompt following, ~$1.67 per 5-second plate.',
      },
      {
        slug: 'ltx',
        why: 'Near-zero-cost test plates from 9 credits (~$0.09) let you validate camera and timing before committing to quality renders.',
      },
    ],
    prompts: [
      'Building facade collapsing outward in slow motion, concrete chunks and rebar tumbling toward camera, dust cloud rolling across the street, fixed tripod perspective for clean tracking marks, overcast flat lighting, photoreal destruction, no text',
      'Wall of fire racing along a refinery pipe corridor, heat distortion rippling the air, embers streaming past camera, locked-off wide shot, industrial safety-orange glow against steel blue dusk, no text',
      'Ocean wave crashing through a harbor seawall at dawn, spray freezing mid-air, debris bobbing in churning foam, static camera on the dock, cold grey-blue grade, documentary disaster realism, no text',
      'Portal tearing open above a desert road, violet energy filaments spiraling inward, sand lifting in a vortex beneath, heat haze and lens flare at center frame, locked shot for compositing, high dynamic range, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI VFX shot cost?',
        a: 'Test plates on LTX 2 cost about $0.09 each. Production plates run ~$1.01 on Manifold Video or ~$1.67 per 5 seconds on Seedance 2, versus thousands for practical effects.',
      },
      {
        q: 'Which AI model is best for VFX plates?',
        a: 'Manifold Video when you need exact frame timing from ordered keyframes, Seedance 2 for complex fire, smoke, and water motion at 1080p.',
      },
      {
        q: 'Can I use AI-generated VFX in commercial films?',
        a: 'Yes. Plates generated on your account are yours to composite into client work, shorts, features, and advertising without royalties.',
      },
      {
        q: 'How do I generate VFX shots with AI?',
        a: 'Open https://manifoldgen.com/studio, prompt one effect per clip with a locked camera note, and iterate. Batch plate generation runs cleanly through the async API.',
      },
    ],
    mediaKey: 'usecase-vfx',
  },
  {
    slug: 'anime',
    h1: 'AI Anime Video Generator',
    title: 'AI Anime Video Generator — Animated Clips From $0.90',
    metaDescription:
      'Generate anime video with AI on ManifoldGen. Wan styles from ~$0.90 per clip, Happy Horse expressive characters, Seedance for sakuga action with audio.',
    intro:
      'Wan is the value pick for anime on ManifoldGen: versatile art styles and deliberate camera moves at ~$0.90 per 5-second clip. For emotional character acting, Happy Horse animates illustrated characters expressively from 168 credits (~$1.68), and Seedance 2 carries high-action cuts with synced audio.',
    audience:
      'Anime creators, VTuber studios, and fan-content teams producing episodes, openings, and AMVs.',
    workflow: [
      {
        step: 'Lock the style sheet',
        detail:
          'Define your series look in a reusable prompt prefix: line weight, palette, shading. Identical prefixes keep shots consistent across episodes.',
      },
      {
        step: 'Design characters as images',
        detail:
          'Generate character sheets with FLUX.2 [dev] at $0.04 per image, then feed them to image-to-video models as anchors.',
      },
      {
        step: 'Animate scene by scene',
        detail:
          'Dialogue beats on Happy Horse for expressive faces, action beats on Seedance 2 for coherent multi-subject motion, backgrounds on Wan.',
      },
      {
        step: 'Cut and score',
        detail:
          'Edit to your soundtrack, add a $0.35 original theme if you need one, and export episode masters at your delivery resolution.',
      },
    ],
    recommendedModels: [
      {
        slug: 'wan',
        why: 'Handles broad illustration styles with camera-move prompting at ~$0.90 per 5s, making full episode coverage affordable.',
      },
      {
        slug: 'happy-horse',
        why: 'Purpose-built for expressive, exaggerated character animation from stills, from 168 credits ($1.68) per clip, perfect for dialogue and reactions.',
      },
      {
        slug: 'seedance',
        why: 'Keeps characters coherent through complex action with native synchronized audio at 1080p, ~$1.67 per 5s, suited to sakuga fight cuts.',
      },
    ],
    prompts: [
      'Anime schoolgirl sprints across a rooftop at sunset, uniform ribbon trailing, cherry petals swirling in her wake, camera tracking parallel at shoulder height, cel-shaded 90s OVA style, dramatic orange sky, speed lines on cuts, no text',
      'Anime swordsman draws his blade in a rainy bamboo forest, single slash freezing time as raindrops hang suspended, camera slow-pushes on his narrowed eyes, ink-wash shading, high-contrast storm lighting, no text',
      'Mecha launches from a carrier deck into a lightning storm, thrusters igniting in electric blue, camera whip-pans following its ascent, detailed panel linework, retro anime mechanical design, thunder-lit clouds, no text',
      'Cozy anime cafe interior, waitress sets down a latte with a smile as steam curls upward, rain pattering the window behind her, gentle dolly-in, soft pastel palette, slice-of-life warmth, Ghibli-inspired backgrounds, no text',
    ],
    faqs: [
      {
        q: 'How much does AI anime video cost?',
        a: 'Background and establishing shots run ~$0.90 per 5 seconds on Wan. Expressive character clips on Happy Horse start at 168 credits ($1.68), and action cuts on Seedance 2 at ~$1.67 per 5 seconds.',
      },
      {
        q: 'Which AI model makes the best anime clips?',
        a: 'Wan for stylistic range at low cost, Happy Horse for expressive character acting from stills, Seedance 2 for multi-character action that needs to stay coherent.',
      },
      {
        q: 'Can I publish AI-generated anime commercially?',
        a: 'Yes. Your generated episodes, openings, and merch assets are yours commercially, provided you avoid prompting existing copyrighted characters.',
      },
      {
        q: 'How do I start an AI anime project?',
        a: 'Build character sheets first, then animate scene-by-scene at https://manifoldgen.com/studio. Series pipelines automate per-scene generation through the single API key.',
      },
    ],
    mediaKey: 'usecase-anime',
  },
  {
    slug: 'short-films',
    h1: 'AI Short Film Video Generator',
    title: 'AI Short Films — Full Pipeline From Under $50',
    metaDescription:
      'Make short films with AI on ManifoldGen: LTX 2 previs at $0.09 a shot, Seedance 2 hero scenes with audio at 1080p, Manifold keyframes for blocking.',
    intro:
      'A complete AI short film fits ManifoldGen: previs every shot on LTX 2 at ~$0.09, block key scenes with Manifold Video keyframes from ~$1.01, and render hero moments on Seedance 2 at 1080p (~$1.67 per 5s). A ten-minute cut typically totals well under $100 in credits.',
    audience:
      'Indie filmmakers and film students directing narrative work without crews or cameras.',
    workflow: [
      {
        step: 'Write the shot list',
        detail:
          'Break the script into numbered shots with lens, camera move, and time of day noted. The list drives every generation prompt.',
      },
      {
        step: 'Previs the whole cut',
        detail:
          'Generate every shot on LTX 2 for ~$0.09 each and edit them against temp audio. Fix story problems now, at throwaway prices.',
      },
      {
        step: 'Render the locked edit',
        detail:
          'Upgrade kept shots: Manifold Video where start/stop framing must match, Seedance 2 where performance and 1080p matter.',
      },
      {
        step: 'Score and finish',
        detail:
          'Commission a $0.35 score cue per section, add SFX at ~$0.86 per 5 seconds, and conform the final master.',
      },
    ],
    recommendedModels: [
      {
        slug: 'ltx',
        why: 'Whole-film previs at 9 credits (~$0.09) per clip means iterating the edit costs almost nothing before any quality spend.',
      },
      {
        slug: 'manifold',
        why: 'Ordered keyframes and an exact stop frame nail continuity between shots, from ~101 credits (~$1.01) with generated audio included.',
      },
      {
        slug: 'seedance',
        why: 'Benchmark cinematic quality and character coherence at 1080p with native audio, ~$1.67 per 5 seconds for hero scenes.',
      },
    ],
    prompts: [
      'Noir detective steps into a rain-glazed alley, fedora brim dripping, match flare illuminating his face as he lights a cigarette, slow push-in from across the street, hard chiaroscuro lighting, 1940s crime drama mood, no text',
      'Girl opens a attic door onto an impossible starlit ocean, wind pulling her hair as she steps to the threshold, camera follows from behind at eye level, magical-realist family drama tone, deep indigo palette, no text',
      'Two strangers share a silence in an all-night diner, coffee steam rising between them, neon sign flickering through the window, camera creeps along the counter, intimate widescreen composition, melancholic blue hour light, no text',
      'Farmer watches a dust storm swallow his fields at dusk, windmill groaning as it turns faster, coat snapping in the gusts, static wide shot holding on his small figure, apocalyptic yet quiet tone, sepia desaturation, no text',
    ],
    faqs: [
      {
        q: 'How much does an AI short film cost to produce?',
        a: 'Previs runs about $0.09 per shot on LTX 2. Rendering 80 final shots averaging $1.30 brings the total near $105, and tighter films land far lower. Credits are $0.01 each.',
      },
      {
        q: 'Which AI model should anchor a short film?',
        a: 'LTX 2 for the previs pass, Manifold Video for continuity-critical blocking, Seedance 2 for hero scenes needing 1080p and synchronized audio.',
      },
      {
        q: 'Can I enter AI short films in festivals commercially?',
        a: 'Yes. You own the generated footage and can sell, stream, and screen it. Check individual festival rules on disclosed AI usage.',
      },
      {
        q: 'How do I start filming a short with AI?',
        a: 'Write a shot list, then generate the previs cut at https://manifoldgen.com/studio. Long-form projects benefit from the API for overnight batch rendering.',
      },
    ],
    mediaKey: 'usecase-short-films',
  },
  {
    slug: 'storyboard-previs',
    h1: 'AI Storyboard & Previs Generator',
    title: 'AI Storyboard Generator — Previs From $0.09 a Shot',
    metaDescription:
      'Generate storyboards and previs with AI on ManifoldGen. LTX 2 boards at ~$0.09 per shot, FLUX.2 frames at $0.04, Manifold for motion blocking from ~$1.01.',
    intro:
      'LTX 2 is purpose-built territory for previs on ManifoldGen: editorial-timing clips from 9 credits (~$0.09) each let you board an entire sequence for a few dollars. Static frames cost $0.04 with FLUX.2 [dev], and Manifold Video blocks motion precisely from ~101 credits.',
    audience:
      'Directors, DP supervisors, and ad teams selling sequences with moving boards instead of static sketches.',
    workflow: [
      {
        step: 'Board the frames',
        detail:
          'Generate composition frames per shot with FLUX.2 [dev] at $0.04 each. These double as image-to-video sources.',
      },
      {
        step: 'Time it with previs clips',
        detail:
          'Animate boards on LTX 2 at ~$0.09 per clip to prove rhythm and coverage before anyone discusses budget.',
      },
      {
        step: 'Block critical moves',
        detail:
          'For complicated staging, use Manifold Video keyframes to fix exactly where the camera starts, passes, and stops.',
      },
      {
        step: 'Present the reel',
        detail:
          'Assemble boards and previs into an animatic with scratch audio, exported straight from your editor for client or department review.',
      },
    ],
    recommendedModels: [
      {
        slug: 'ltx',
        why: 'Built for editorial timing: LTX 2 previs clips start at 9 credits (~$0.09), the cheapest way to test a cut on Earth.',
      },
      {
        slug: 'manifold',
        why: 'Ordered keyframes and exact stop frames communicate intended camera blocking precisely, from ~101 credits (~$1.01) per blocked shot.',
      },
      {
        slug: 'wan',
        why: 'At ~$0.90 per 5s it upgrades selected boards to fuller motion tests without touching the quality-tier budget.',
      },
    ],
    prompts: [
      'Storyboard-style wide shot: car chase approaches a drawbridge at dusk, hero sedan fishtailing in the foreground lane, bridge beginning to rise ahead, high contrast sketch-like grading, clear depth staging for the board, no text',
      'Previs frame: heist crew crosses a museum atrium on rappel lines, guards visible below at third positions, overhead crane shot descending slowly, clean readable silhouettes, neutral grey test-render palette, no text',
      'Blocking test: argument scene in a cramped kitchen, camera plans a slow arc from stove-side to door, both actors framed in profile at the midpoint, simple domestic dressing, flat even lighting for planning, no text',
      'Battle sequence board: cavalry cresting a hill at dawn, infantry lines arrayed in the valley below, camera planned to sweep right-to-left along the ridge, epic scale composition, muted historical tones, no text',
    ],
    faqs: [
      {
        q: 'How much does AI previs cost per shot?',
        a: 'Static frames are $0.04 with FLUX.2 [dev] and moving previs clips start at 9 credits (~$0.09) on LTX 2, so boarding a 40-shot sequence costs under $5.',
      },
      {
        q: 'What is the best tool for AI storyboards?',
        a: 'FLUX.2 [dev] for composition frames, LTX 2 for timing tests, and Manifold Video when the board must show exact camera start and end positions.',
      },
      {
        q: 'Do I own AI-generated storyboard material?',
        a: 'Yes. Boards and previs reels generated on your account are yours to present, pitch, and license to production clients.',
      },
      {
        q: 'How do I generate a storyboard with AI?',
        a: 'List your shots, generate frames and clips at https://manifoldgen.com/studio, and cut them into an animatic. The API chains frame generation into animation automatically.',
      },
    ],
    mediaKey: 'usecase-storyboard-previs',
  },
];
