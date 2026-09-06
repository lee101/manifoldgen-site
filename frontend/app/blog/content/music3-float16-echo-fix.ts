import type { BlogArticle } from '../articles';

const CDN = 'https://manifoldgenstatic.manifoldgen.com/blog/music3-fp16';

function pair(id: string, title: string, tags: string) {
  return {
    type: 'example' as const,
    example: {
      label: title,
      prompt: tags,
      media: [
        { kind: 'audio' as const, src: `${CDN}/${id}-bf16.opus`, caption: 'Before: acoustic stage in bfloat16 (what production shipped until this week)' },
        { kind: 'audio' as const, src: `${CDN}/${id}-fp16.opus`, caption: 'After: acoustic stage in float16, same caption, lyrics and seed' },
      ],
    },
  };
}

export const music3Float16EchoFix: BlogArticle = {
  slug: 'music3-float16-echo-fix',
  category: 'Engineering',
  title: 'Our Music Generator Had a Washed-Out Echo. One dtype Fixed It.',
  excerpt: 'Songs from our hosted MiniMax Music 3 endpoint sounded smeared and hollow next to the same model on Hugging Face. The solver, steps and guidance were identical; the diffusion stage was running in bfloat16. Switching it to float16 restored the sound at the same speed. Before/after samples, the measurements, and three music videos we cut from the fixed songs.',
  readTime: '8 min read',
  date: '2026-09-06',
  ogImage: '/blog/og/music3-float16-echo-fix.webp',
  blocks: [
    { type: 'p', text: 'Our music generator runs MiniMax Music 3 on our own GPU workers. It worked, and the songs were recognisably the right genre, but they had a washed-out, echo-ish quality: wide, phasey stereo, a noisy top end, and about eight decibels less level than they should have had. The public MiniMax-Music3-Jam space on Hugging Face runs the same weights and sounded clean. Same model, different sound. This is the story of finding out why, with the audio so you can hear the difference yourself.' },

    { type: 'h2', text: 'Hear it first' },
    { type: 'p', text: 'Every pair below is the same caption, the same lyrics and the same seed on the same H200. The only difference is the numeric format of the acoustic stage. Captions and lyrics come from public songs in the Jam community feed so we could compare our render of a song against a known-good render of the same song.' },
    pair('94e337800e61', 'Piano ballad', 'piano ballad, male vocals, slow tempo, cinematic, melancholic'),
    pair('1b0c7d4b481f', 'Pop', 'pop, female vocals, 100 bpm, uplifting, melodic'),
    pair('cf1ed8f73998', 'Indie pop', 'indie pop, male vocals, 100 bpm, uplifting'),
    pair('4b08c0dfa6c7', 'Cool jazz', 'cool jazz, muted trumpet, piano trio, 1958 vibe, 120 bpm'),

    { type: 'h2', text: 'What the model actually does' },
    { type: 'p', text: 'MiniMax Music 3 is two models. An autoregressive Qwen3 backbone writes the song as a stream of audio codes, twenty-five frames per second, eight codebooks deep. Every two hundred frames are handed to a flow-matching diffusion transformer, thirty-six layers wide, which solves a VAE latent in thirty Euler steps with classifier-free guidance, and a DAC-style decoder turns that latent into 32 kHz stereo. The backbone decides what the song is. The acoustic stage decides what it sounds like.' },
    { type: 'p', text: 'We serve it through sgl-omni. Our worker quantises the backbone to FP8, which the community had already shown to be close to lossless, and we had set the acoustic stage to bfloat16 for speed. sgl-omni itself defaults that stage to float32, and its authors call float32 the only default. That comment turned out to be the whole bug.' },

    { type: 'h2', text: 'Ruling out the obvious' },
    { type: 'p', text: 'The first suspects were the sampler settings, because a smeared, reverb-like sound is what under-sampled diffusion usually produces. They were identical everywhere: thirty steps, guidance 1.7 on the diffusion stage, guidance 1.5 with top-k 50 on the backbone, and the same latent carry-over between overlapping two-hundred-frame windows. The Jam space, the sgl-omni defaults and our worker all agreed. The FP8 backbone was the second suspect, and it was not the problem either. An earlier A/B against a bfloat16 backbone had sounded almost identical.' },
    { type: 'p', text: 'That left precision inside the acoustic stage. To test it without guessing, we built a way to measure the difference.' },

    { type: 'h2', text: 'Measuring "sounds worse"' },
    { type: 'p', text: 'We pulled sixty songs from the Jam community feed, which publishes each song\'s caption, lyrics and seed alongside the audio. Regenerating those songs on our infrastructure gives paired comparisons: our render of a song next to a clean render of the same song. We scored each pair with CLAP audio embeddings (cosine similarity between our render and the reference render of the same song), plus a Fréchet audio distance over the set, and a handful of signal statistics: stereo correlation, spectral flatness, crest factor and RMS level.' },
    { type: 'p', text: 'We also built a cepstral echo detector, because "echo" was the word everyone used. It finds a synthetic 120 ms echo instantly. It found nothing in our songs. Whatever the ear was hearing, it was not a discrete delay. It was decorrelated stereo and a noisy spectrum, which the other numbers caught cleanly.' },
    {
      type: 'table',
      head: ['Acoustic stage', 'Paired CLAP vs reference', 'Stereo correlation', 'RMS level', 'FAD vs reference', 'Seconds per 60 s song'],
      rows: [
        ['bfloat16 (old production)', '0.53', '0.31', '-26.9 dBFS', '0.99', '33'],
        ['float32', '0.82', '0.59', '-21.8 dBFS', '0.48', '54'],
        ['float32, 50 steps', '0.84', '0.73', '-18.9 dBFS', '0.46', '63'],
        ['float16 (new production)', '0.83', '0.65', '-19.7 dBFS', '0.31', '41'],
        ['Reference renders', '1.00', '0.68', '-18.6 dBFS', '0', ''],
      ],
    },
    { type: 'p', text: 'Five songs per row for the first three, ten for float16, all on one H200. bfloat16 is not slightly worse. Its renders are barely recognisable as the same song as the reference, they are eight decibels quieter, and the two channels have half the correlation a mixed record has. float32 fixes all of that and costs sixty percent more time.' },

    { type: 'h2', text: 'What did not work' },
    { type: 'list', items: [
      'Keeping the Euler state and the guidance mix in float32 while the transformer ran in bfloat16. No change at all. The error is not accumulating between steps; it is inside each forward pass.',
      'Running only the vocoder in float32. No change. The latent arriving at the vocoder is already damaged.',
      'More steps. Fifty steps in float32 nudges the numbers a little for fifteen percent more time. Thirty steps was never the problem.',
    ] },

    { type: 'h2', text: 'The fix' },
    { type: 'p', text: 'bfloat16 has an eight-bit mantissa. float16 has ten bits, the same as the TF32 tensor-core path that float32 mode actually runs on, and it moves through the GPU at bfloat16 speed. sgl-omni only allowed float32 or bfloat16 for the acoustic stage, so the fix is a two-line whitelist patch and one environment variable:' },
    { type: 'code', text: `-SUPPORTED_ACOUSTIC_DTYPES = frozenset({"float32", "bfloat16"})
+SUPPORTED_ACOUSTIC_DTYPES = frozenset({"float32", "bfloat16", "float16"})

     return {
         "float32": torch.float32,
         "bfloat16": torch.bfloat16,
+        "float16": torch.float16,
     }[name]

MUSIC3_ACOUSTIC_DTYPE=float16` },
    { type: 'p', text: 'float16 matches float32 on every metric we track, sits closer to the reference on stereo correlation and level, and renders a sixty-second song in forty-one seconds instead of fifty-four. No overflow, silence or NaN on any of the ten validation songs, which deliberately included dubstep, progressive rock and Latin trap. It is what the music generator serves now.' },
    { type: 'callout', title: 'If you host a diffusion audio model in bfloat16', text: 'Render one song in float32 and listen to the two side by side before you trust the speed. Video and image diffusion models are usually forgiving of bfloat16; a thirty-six-layer transformer solving a waveform latent over thirty steps is not.' },

    { type: 'h2', text: 'Three music videos from the fixed songs' },
    { type: 'p', text: 'To show the new sound in context we cut three of the float16 songs into music videos with H3, our audio-driven video model. Each video is one performer: we generated eight stills of the same character with FLUX, then cut the song at its onsets into three-to-five-second shots, each shot driven by the slice of the song it covers so the lips and the movement follow the vocal. The shot frames sum to exactly the song length, so the recomposed video never drifts from the master audio.' },
    {
      type: 'example',
      example: {
        label: 'Piano ballad',
        prompt: "Basic Attributes: bpm is 68. key is A, and scale is minor. Contemporary piano ballad. Global Emotional Progression: The piece opens with intimate fragility, swells into conflicted yearning, and culminates in a...",
        media: [{ kind: 'video', src: `${CDN}/mv-94e337800e61.mp4`, poster: `${CDN}/mv-94e337800e61-poster.webp`, aspect: '16:9', sound: true, caption: 'Piano ballad, 13 shots cut on the song\'s onsets, performer driven by the vocal' }],
      },
    },
    {
      type: 'example',
      example: {
        label: 'Pop',
        prompt: "Basic Attributes: bpm is 100. key is C, and scale is major. Pop. Global Emotional Progression: Starts gentle and intimate, builds to a hopeful, soaring chorus, and returns to a warm, resolved ending. Application...",
        media: [{ kind: 'video', src: `${CDN}/mv-1b0c7d4b481f.mp4`, poster: `${CDN}/mv-1b0c7d4b481f-poster.webp`, aspect: '16:9', sound: true, caption: 'Pop, 14 shots, singing on the vocal sections and dancing between them' }],
      },
    },
    {
      type: 'example',
      example: {
        label: 'Electro-pop',
        prompt: "Basic Attributes: bpm is 115. key is C, and scale is major. Electro\u2011pop. Global Emotional Progression: The track opens with curious intrigue, builds to confident optimism in the pre\u2011chorus, bursts into energised triumph...",
        media: [{ kind: 'video', src: `${CDN}/mv-aa41d6ffed11.mp4`, poster: `${CDN}/mv-aa41d6ffed11-poster.webp`, aspect: '16:9', sound: true, caption: 'Electro-pop, 15 shots, neon performer stills from FLUX' }],
      },
    },
    { type: 'p', text: 'Each shot asks H3 for slightly more video than it keeps, and the driving audio for a shot is the song under that longer window, so consecutive windows overlap and every cut lands on a beat the model has already heard. The song itself goes back in as the master track at the end; H3\'s own generated audio is kept as a second track for anyone who wants the foley.' },

    { type: 'h2', text: 'Numbers' },
    { type: 'list', items: [
      'A sixty-second song on the production endpoint: 41 seconds of H200 time, a few cents.',
      'The whole investigation: about eighty songs across six acoustic configurations, all on scale-to-zero serverless workers cloned from the production template, well under ten dollars of GPU time.',
      'The metric scripts, the endpoint-cloning ablation runner and the music-video pipeline are in our repo and drove every number in this article.',
    ] },
    { type: 'links', items: [
      { label: 'Try the music generator', href: '/tools/music-generator' },
      { label: 'Make a music video in Studio', href: '/studio' },
      { label: 'MiniMax-Music3-Jam on Hugging Face', href: 'https://huggingface.co/spaces/victor/MiniMax-Music3-Jam' },
    ] },
  ],
};
