import type { Props } from './rig';

export const BODY_TYPES = {
  genman: { headsTall: 7.8, height: 1.82, shoulder: 1.15, hip: 0.92, limb: 1.03, sex: 1 },
  genwoman: { headsTall: 7.4, height: 1.66, shoulder: 0.92, hip: 1.12, limb: 1, sex: 0 },
  'tall man': { headsTall: 8.1, height: 1.97, shoulder: 1.18, hip: 0.9, limb: 1.1, sex: 1 },
  'stocky man': { headsTall: 7.0, height: 1.74, shoulder: 1.32, hip: 1.15, limb: 0.92, sex: 1 },
  'slim woman': { headsTall: 8.0, height: 1.72, shoulder: 0.82, hip: 0.85, limb: 1.08, sex: 0 },
  'short woman': { headsTall: 7.0, height: 1.52, shoulder: 0.9, hip: 1.18, limb: 0.93, sex: 0 },
  'curvy woman': { headsTall: 7.2, height: 1.64, shoulder: 0.95, hip: 1.32, limb: 0.96, sex: 0 },
  'teen boy': { headsTall: 7.2, height: 1.62, shoulder: 0.88, hip: 0.85, limb: 1.02, sex: 0.75 },
  'teen girl': { headsTall: 7.2, height: 1.58, shoulder: 0.82, hip: 0.95, limb: 1.02, sex: 0.25 },
  child: { headsTall: 6.5, height: 1.25, shoulder: 0.78, hip: 0.82, limb: 0.85, sex: 0.5 },
  neutral: { headsTall: 7.5, height: 1.7, shoulder: 1, hip: 1, limb: 1, sex: 0.5 },
} satisfies Record<string, Props>;

export type BodyType = keyof typeof BODY_TYPES;
export const BODY_TYPE_NAMES = Object.keys(BODY_TYPES) as BodyType[];
