import type { Guide } from '../types';

const guide: Guide = {
  slug: 'from-comfyui-to-one-click',
  section: 'craft',
  category: 'Pipelines',
  title: `From ComfyUI to One Click: Carrying Graph Thinking Into Guided Tools`,
  excerpt: `Node graphs make every stage of generation explicit. Learn the load-condition-sample-decode spine once and every guided tool becomes legible.`,
  readTime: '7 min read',
  updated: 'August 2026',
  blocks: [
    { t: 'p', text: `ComfyUI's real gift is not the interface — it is honesty. A node graph shows you that generation is a pipeline of explicit stages, not a magic box. Learn that shape once and every one-click tool stops being opaque: you can see which node it is hiding behind a slider.` },
    { t: 'h2', text: `The spine of every graph` },
    { t: 'steps', items: [
      `**Load** — checkpoint, VAE, text encoder. Which model, at what precision.`,
      `**Encode condition** — text encoding, reference adapters (IPAdapter-style), control nets (depth, pose), masks.`,
      `**Sample** — sampler choice, steps, CFG, denoise strength, seed. Where images actually get made.`,
      `**Decode** — latents to pixels. Happens once, at the end.`,
      `**Post** — upscale, color, save.`,
    ] },
    { t: 'h2', text: `What each node maps to on ManifoldGen` },
    { t: 'list', items: [
      `Text encode → the prompt box in any tool.`,
      `Reference adapter → attaching references: Soul Moodboard fusion, Nano Banana 2 or GPT Image 2 reference edit.`,
      `img2img denoise → Style Transfer strength; low preserves composition, high reinvents it.`,
      `Inpaint pipeline → the Inpaint tool's mask-and-describe flow.`,
      `Upscale chain → Image Upscale.`,
      `ControlNet depth/pose → Cinematic Cameras presets; Character Animator's driving clip is pose control for video.`,
      `KSampler seed → the seed field, with all its limits (see why faces change).`,
    ] },
    { t: 'h2', text: `When a graph still wins` },
    { t: 'list', items: [
      `Exotic stacks combining three control signals at once.`,
      `Research and reproducibility — a saved graph is an executable experiment.`,
      `Custom checkpoints and LoRAs that never left your machine.`,
      `Pixel-exact caching of expensive branches while you iterate on one node.`,
    ] },
    { t: 'h2', text: `When guided tools win` },
    { t: 'list', items: [
      `Speed to result — maintained defaults beat hand-tuned graphs for standard jobs.`,
      `No local VRAM ceiling; GPU time metered per run instead of owned per machine.`,
      `Teams where nobody should be maintaining someone's 40-node graph.`,
    ] },
    { t: 'h2', text: `Habits worth porting over` },
    { t: 'list', items: [
      `Change the equivalent of one node at a time — same discipline as one-variable iterations.`,
      `Save winning configurations as reusable briefs instead of rebuilding them.`,
      `Treat denoise strength as the main dial between preserve and invent.`,
      `Keep raw outputs untouched; edit derivatives only.`,
    ] },
    { t: 'callout', tone: 'violet', title: `The whole mental model`, body: `A prompt is conditioning. A reference is conditioning with pixels. An edit is resampling with protection. Every generation tool you will ever touch is one of those three wearing different clothes.` },
  ],
};

export default guide;
