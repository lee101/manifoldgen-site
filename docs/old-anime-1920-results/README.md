# Studio 1939 MiniMax H3 evaluation

Date: 2026-08-26. Result: **worker support retained; automatic production routing disabled**.

We tested [`lovis93/studio-1939-old-animation-lora-minimax-h3`](https://huggingface.co/lovis93/studio-1939-old-animation-lora-minimax-h3) on the production H100 H3 stack. Every main pair used the same prompt, seed, 4:3 aspect ratio, balanced 896×672 output, 124 frames, 20 steps, five-second duration, disabled prompt expansion, codec, and acceleration profile. B differs only by the strong r64 LoRA at 0.65; the published `gulliv3r, ` trigger is inserted by the worker.

The contact sheets show five one-second samples: A/base on top and B/Studio 1939 on the bottom. `deepseek-v4-flash-vision-exp` judged overall quality in this order: coherent anatomy/action, prompt and composition adherence, then period style. Style alone could not excuse broken content.

| Scene | Seed | A: base | B: Studio 1939 | Contact sheet | Judge |
|---|---:|---|---|---|---|
| Rabbit band | 1939001 | [video](01-rabbit-band-before.webm) | [video](01-rabbit-band-after.webm) | [five-frame A/B](01-rabbit-band-contact.jpg) | **A**, 0.90 — B has anatomical distortions and misplaced objects |
| Desert train | 1939002 | [video](02-desert-train-before.webm) | [video](02-desert-train-after.webm) | [five-frame A/B](02-desert-train-contact.jpg) | **A**, 0.90 — B disrupts anatomy and style cohesion |
| Storm pier | 1939003 | [video](03-storm-pier-before.webm) | [video](03-storm-pier-after.webm) | [five-frame A/B](03-storm-pier-contact.jpg) | **A**, 0.90 — B has anatomy/rope issues; A keeps coherent action |

Raw worker responses and model decisions are beside each asset as `*-before.json`, `*-after.json`, and `*-judge.json`. Face refinement applied to none of these outputs: faces were absent or below its validated size threshold, so it did not confound the style comparison.

## Calibration findings

- Strong r64 at 1.0 was manually rejected on the first two seeds because it heavily altered composition and prompt content.
- Strong r64 at 0.65 preserved more structure and delivered a clear analog-paint gain, but the independent vision judge still preferred base A in all three matched pairs at 0.90 confidence.
- Light r16 at 0.8 was tested on the hardest desert-train seed: [video](02-desert-train-light-r16.webm), [contact sheet](02-desert-train-light-r16-contact.jpg), [judge](02-desert-train-light-r16-judge.json). The judge again chose base A at 0.90 because B broke anatomy and the requested handcar action.

## Production decision

The worker now has an immutable, checksum-verified, allowlisted Studio 1939 capability and can swap its small LoRA patch without reloading the H3 base. The Go route uses the shared Gobed embedding model and conservative early-animation anchors, rejects arbitrary client LoRA names, and forces prompt expansion off for this recipe.

`H3_STUDIO1939_ENABLED` defaults off. Do not enable it until a replacement adapter or inference recipe wins a representative A/B set on coherence and prompt adherence—not merely on period texture.
