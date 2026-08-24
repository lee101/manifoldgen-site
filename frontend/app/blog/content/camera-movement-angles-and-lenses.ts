import type { BlogArticle } from '../articles';

export const cameraMovementAnglesAndLenses: BlogArticle = {
  slug: 'camera-movement-angles-and-lenses',
  category: 'Prompt craft',
  title: 'How to Control Camera Movement, Angles, and Lens in AI Video',
  excerpt: 'Stop asking for "cinematic" and start directing: exact prompt language for dollies, orbits, cranes, focal lengths, and angles that video models actually follow.',
  readTime: '9 min read',
  date: '2026-07-23',
  ogImage: '/blog/og/camera-movement-angles-and-lenses.jpg',
  blocks: [
    { type: 'p', text: 'Most disappointing AI clips fail at the camera, not the subject. "Cinematic shot of a car" gives the model permission to invent everything about framing and motion, so you get a slow float toward nothing in particular. The fix is to direct the camera the way a shot list does: one move, one angle, one lens feel, stated plainly.' },
    { type: 'p', text: 'This guide uses three real generations of the same subject — a red convertible on a salt flat at sunrise — where only the final camera sentence changes. Everything below was generated with ManifoldGen preview-tier clips; the prompts are copyable.' },

    { type: 'h2', text: 'One subject, three camera lines' },
    {
      type: 'example',
      example: {
        label: 'Shot 1 — dolly-in, low front angle',
        prompt: 'A vintage red convertible parked on a cracked salt flat at sunrise, distant mountains. Slow dolly-in from a low front three-quarter angle toward the grille, shallow depth of field, warm sunrise rim light, constant smooth speed.',
        media: [{ kind: 'video', src: '/blog/media/camera-movement-angles-and-lenses/salt-flat-dolly-in.webm', poster: '/blog/media/camera-movement-angles-and-lenses/salt-flat-dolly-in.jpg', aspect: '16:9', seconds: 4 }],
        note: 'The camera clause sits immediately after the subject, names the move (dolly-in), the starting position (low front three-quarter), the destination (toward the grille), and the quality of motion (constant smooth speed). That is four instructions doing all the work.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Shot 2 — 180-degree orbit',
        prompt: 'A vintage red convertible parked on a cracked salt flat at sunrise, distant mountains. Smooth 180-degree orbit around the car at eye level, constant radius and speed, parallax between car and mountains, warm sunrise light.',
        media: [{ kind: 'video', src: '/blog/media/camera-movement-angles-and-lenses/salt-flat-orbit.webm', poster: '/blog/media/camera-movement-angles-and-lenses/salt-flat-orbit.jpg', aspect: '16:9', seconds: 4 }],
        note: 'Orbits need an explicit arc ("180-degree") plus "constant radius and speed". Without the radius constraint, models tend to drift outward and the parallax you asked for collapses into a wobble.',
      },
    },
    {
      type: 'example',
      example: {
        label: 'Shot 3 — crane up reveal',
        prompt: 'A vintage red convertible parked on a cracked salt flat at sunrise, distant mountains. Crane rise from hood height revealing the endless empty salt flat behind the car, wide 24mm lens, warm sunrise light, smooth vertical lift.',
        media: [{ kind: 'video', src: '/blog/media/camera-movement-angles-and-lenses/salt-flat-crane-up.webm', poster: '/blog/media/camera-movement-angles-and-lenses/salt-flat-crane-up.jpg', aspect: '16:9', seconds: 4 }],
        note: 'A crane shot is two compositions: where it starts and what the rise reveals. Say both. "Revealing X" is the single most reliable phrase for giving a vertical move a purpose.',
      },
    },

    { type: 'h2', text: 'The camera vocabulary models respect' },
    { type: 'p', text: 'Video models are trained on captioned footage, so film-set verbs outperform adjectives. These are the moves worth naming, strongest first:' },
    { type: 'list', items: [
      'Dolly / push-in / pull-out — camera physically moves toward or away from the subject. Add "slow" unless you want energy; add a target ("toward her hands") to stop generic drifting.',
      'Orbit / arc — camera circles the subject. Specify degrees (90, 180) and "constant radius".',
      'Crane / pedestal rise, boom down — vertical movement. Pair with "revealing..." for the payoff.',
      'Tracking / truck — lateral move alongside the action. Name what it follows ("tracking shot from the front at walking pace").',
      'Pan / tilt — rotation on the spot. Cheapest-looking move in AI video; keep arcs small and motivated.',
      'Handheld — adds micro-shake and documentary credibility. "Slight camera shake" is usually enough; more looks drunk.',
      'Zoom — avoid it. Models render optical zooms as warps. Ask for a dolly instead.',
    ] },

    { type: 'h2', text: 'Lens language is depth-of-field language' },
    { type: 'p', text: 'You cannot make a model rent a specific lens, but focal-length words reliably set field of view and compression because captions use them that way:' },
    { type: 'list', items: [
      '14–24mm — wide interiors, establishing shots, slight edge distortion. Use for scale, not faces.',
      '35mm — natural reportage. The default when you want realism without commentary.',
      '50mm — neutral, honest perspective. Good baseline product and dialogue coverage.',
      '85mm+ — portraits: compressed background, shallow focus. Combine with "eyes in sharp focus".',
      'Macro — extreme close detail. Great for food, texture, and product b-roll.',
    ] },
    { type: 'p', text: 'Angle words stack with lenses: eye-level reads neutral, low angle grants power, high angle diminishes, overhead turns subjects graphic, and Dutch angle signals unease. One per shot. "Low aerial push" and "eye-level macro" are fine; three angles in one sentence is not.' },

    { type: 'h2', text: 'A reusable camera block' },
    { type: 'code', text: `[Subject and setting]. [One primary action].
[Camera move] from [start position/height] toward [target],
[one angle], [focal length] lens, [depth of field],
[lighting], constant smooth speed, settles on [end frame].` },
    { type: 'p', text: 'The last clause — where the shot settles — matters more than people expect. A defined end state keeps the model from wandering after it completes the move, which is why so many good clips end on a stable composition rather than mid-glide. For deeper shot vocabulary, see the cinematic camera presets in the tools.' },

    { type: 'callout', title: 'The one-move rule', text: 'One camera move per shot. A clip that dollies while craning and orbiting reads as a glitch, not a technique. If the scene needs two moves, generate two shots and cut them together — it is cheaper than fighting the model.' },

    { type: 'h2', text: 'Fixing bad motion' },
    { type: 'list', items: [
      'Camera drifts aimlessly — your move has no target or speed. Add "toward [thing]" and "constant smooth speed".',
      'Geometry melts mid-move — the move is too big for the clip length. Halve the degrees or distance, or raise duration.',
      'Model ignored the move — the camera clause is buried. Move it directly after the subject line and cut competing adjectives.',
      'Motion feels cheap — you asked for zoom or fast pan. Swap zoom for dolly; cut pan speed in half.',
      'Everything moves like jelly — too many modifiers fighting ("dynamic sweeping dramatic"). Pick one verb and let physics words do the styling.',
    ] },
    { type: 'p', text: 'Run all three variants side by side in Studio before spending credits on longer renders — same prompt, four seconds, then scale the winner.' },
  ],
};
