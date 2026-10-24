import type { StudioFxType } from './registry';

export const FX_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform sampler2D u_prev;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hasPrev;
uniform float u_mix;
uniform float u_p[8];
in vec2 v_uv;
out vec4 outColor;
const float TAU = 6.28318530718;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float aspect() { return u_resolution.x / max(u_resolution.y, 1.0); }
vec2 mirrorUV(vec2 uv) { return 1.0 - abs(1.0 - mod(uv, 2.0)); }
vec4 src(vec2 uv) { return texture(u_image, clamp(uv, 0.0, 1.0)); }
vec4 prev(vec2 uv) { return u_hasPrev > 0.5 ? texture(u_prev, clamp(uv, 0.0, 1.0)) : src(uv); }
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec3 hueRotate(vec3 c, float turns) {
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec3 yiq = toYIQ * c;
  float h = turns * TAU;
  yiq.yz = mat2(cos(h), sin(h), -sin(h), cos(h)) * yiq.yz;
  return toRGB * yiq;
}
`;

const FOOTER = `
void main() {
  vec4 base = texture(u_image, v_uv);
  vec4 result = effect(v_uv);
  outColor = clamp(mix(base, result, clamp(u_mix, 0.0, 1.0)), 0.0, 1.0);
}`;

const BODIES: Record<StudioFxType, string> = {
  feedback: `
vec4 effect(vec2 uv) {
  vec4 current = src(uv);
  float angle = radians(u_p[2]);
  vec2 centered = (uv - 0.5) * vec2(aspect(), 1.0);
  centered = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * centered / (1.0 + u_p[1]);
  vec4 trail = prev(centered / vec2(aspect(), 1.0) + 0.5);
  vec3 tinted = u_p[3] > 0.0 ? hueRotate(trail.rgb, u_p[3]) : trail.rgb;
  return vec4(max(current.rgb, tinted * u_p[0]), max(current.a, trail.a * u_p[0]));
}`,
  datamosh: `
vec4 effect(vec2 uv) {
  vec4 current = src(uv);
  if (u_hasPrev < 0.5) return current;
  vec2 cell = vec2(max(u_p[1], 0.005));
  cell.y *= aspect();
  vec2 id = floor(uv / cell);
  float epoch = floor(u_time * 2.0);
  if (hash(id + vec2(epoch * 0.37, epoch * 1.13)) > u_p[0]) return current;
  vec2 motion = (vec2(noise(id * 0.35 + epoch), noise(id * 0.35 + 9.1 + epoch)) - 0.5) * u_p[2] * 2.0;
  vec4 smeared = prev(uv - motion);
  return vec4(smeared.rgb, current.a);
}`,
  kaleidoscope: `
vec4 effect(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(aspect(), 1.0);
  float radius = length(p) / max(u_p[2], 0.05);
  float segment = TAU / max(2.0, floor(u_p[0] + 0.5));
  float angle = mod(atan(p.y, p.x) + radians(u_p[1]), segment);
  angle = abs(angle - segment * 0.5);
  vec2 q = vec2(cos(angle), sin(angle)) * radius;
  return src(mirrorUV(q / vec2(aspect(), 1.0) + 0.5));
}`,
  mirror: `
vec4 effect(vec2 uv) {
  vec2 q = uv;
  float mode = floor(u_p[0] + 0.5);
  bool second = u_p[1] > 0.5;
  if (mode != 1.0) q.x = second ? max(q.x, 1.0 - q.x) : min(q.x, 1.0 - q.x);
  if (mode != 0.0) q.y = second ? min(q.y, 1.0 - q.y) : max(q.y, 1.0 - q.y);
  return src(q);
}`,
  wave: `
vec4 effect(vec2 uv) {
  float axis = floor(u_p[3] + 0.5);
  float t = u_time * u_p[2];
  vec2 offset = vec2(0.0);
  if (axis != 1.0) offset.x = sin(uv.y * u_p[1] * TAU + t) * u_p[0];
  if (axis != 0.0) offset.y = sin(uv.x * u_p[1] * TAU + t * 1.13) * u_p[0];
  return src(mirrorUV(uv + offset));
}`,
  surprise: `
vec4 effect(vec2 uv) {
  float k = u_p[0] * exp(-4.0 * fract(u_time * u_p[3]));
  vec2 c = vec2(u_p[1], u_p[2]);
  vec2 q = c + (uv - c) / (1.0 + 0.07 * k);
  float sp = 0.006 * k;
  vec3 col = vec3(src(q + vec2(sp, 0.0)).r, src(q).g, src(q - vec2(sp, 0.0)).b);
  float l = luma(col);
  col = mix(vec3(l), col, 1.0 - 0.35 * min(k, 1.0));
  col = (col - 0.5) * (1.0 + 0.32 * min(k, 1.5)) + 0.5;
  vec2 d = (uv - c) * vec2(aspect(), 1.0);
  float a = atan(d.y, d.x);
  float n = hash(vec2(floor((a / TAU + 0.5) * 70.0), floor(u_time * 12.0)));
  float line = step(0.6, n) * smoothstep(0.2, 0.45, length(d)) * min(k, 1.0) * 0.75;
  return vec4(mix(col, vec3(1.0), line), 1.0);
}`,
  speedLines: `
vec4 effect(vec2 uv) {
  vec2 d = (uv - vec2(u_p[3], u_p[4])) * vec2(aspect(), 1.0);
  float a = atan(d.y, d.x);
  float tick = floor(u_time * 12.0);
  float n = hash(vec2(floor((a / TAU + 0.5) * u_p[0]), tick));
  float w = 0.5 + 0.5 * hash(vec2(floor((a / TAU + 0.5) * u_p[0] * 0.5), tick + 7.0));
  float line = step(0.55, n) * smoothstep(u_p[1], u_p[1] + 0.25, length(d)) * w;
  return vec4(mix(src(uv).rgb, vec3(1.0), line * u_p[2]), 1.0);
}`,
  lineBoil: `
vec4 effect(vec2 uv) {
  float tick = floor(u_time * u_p[2]);
  vec2 p = uv * vec2(aspect(), 1.0) * u_p[1];
  vec2 d = vec2(noise(p + tick * 3.1), noise(p + vec2(19.7, tick * 1.7))) - 0.5;
  return src(mirrorUV(uv + d * u_p[0] * 2.0));
}`,
  noiseWarp: `
vec4 effect(vec2 uv) {
  float t = u_time * u_p[2];
  vec2 p = uv * vec2(aspect(), 1.0) * u_p[1];
  vec2 d = vec2(noise(p + vec2(t, 0.0)), noise(p + vec2(17.3, t))) - 0.5;
  return src(mirrorUV(uv + d * 2.0 * u_p[0]));
}`,
  pixelate: `
vec4 effect(vec2 uv) {
  vec2 cell = vec2(max(u_p[0], 0.001));
  cell.y *= aspect();
  vec2 center = (floor(uv / cell) + 0.5) * cell;
  vec4 color = src(center);
  if (u_p[1] > 0.5) {
    float r = length((uv - center) / cell);
    color.rgb *= 1.0 - smoothstep(0.42, 0.5, r);
  }
  return color;
}`,
  posterize: `
vec4 effect(vec2 uv) {
  vec4 color = src(uv);
  float levels = max(2.0, floor(u_p[0] + 0.5)) - 1.0;
  float gamma = max(u_p[1], 0.05);
  vec3 g = pow(max(color.rgb, 0.0), vec3(gamma));
  g = floor(g * levels + 0.5) / levels;
  return vec4(pow(g, vec3(1.0 / gamma)), color.a);
}`,
  halftone: `
vec4 effect(vec2 uv) {
  float size = max(u_p[0], 0.002);
  float angle = radians(u_p[1]);
  mat2 rotate = mat2(cos(angle), sin(angle), -sin(angle), cos(angle));
  mat2 unrotate = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 p = rotate * vec2(uv.x, uv.y / aspect());
  vec2 center = (floor(p / size) + 0.5) * size;
  vec2 back = unrotate * center;
  vec4 color = src(vec2(back.x, back.y * aspect()));
  float dist = length(p - center) / size;
  float aa = 0.08;
  if (u_p[2] > 0.5) {
    float radius = sqrt(clamp(luma(color.rgb), 0.0, 1.0)) * 0.62;
    return vec4(color.rgb * (1.0 - smoothstep(radius - aa, radius + aa, dist)), color.a);
  }
  float radius = sqrt(clamp(1.0 - luma(color.rgb), 0.0, 1.0)) * 0.62;
  float ink = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  return vec4(vec3(1.0 - ink), color.a);
}`,
  edges: `
vec4 effect(vec2 uv) {
  vec2 px = vec2(1.0) / u_resolution * max(1.0, u_resolution.y / 720.0);
  float tl = luma(src(uv + px * vec2(-1.0, 1.0)).rgb);
  float tc = luma(src(uv + px * vec2(0.0, 1.0)).rgb);
  float tr = luma(src(uv + px * vec2(1.0, 1.0)).rgb);
  float ml = luma(src(uv + px * vec2(-1.0, 0.0)).rgb);
  float mr = luma(src(uv + px * vec2(1.0, 0.0)).rgb);
  float bl = luma(src(uv + px * vec2(-1.0, -1.0)).rgb);
  float bc = luma(src(uv + px * vec2(0.0, -1.0)).rgb);
  float br = luma(src(uv + px * vec2(1.0, -1.0)).rgb);
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -bl - 2.0 * bc - br + tl + 2.0 * tc + tr;
  float edge = smoothstep(u_p[1], u_p[1] + 0.12, length(vec2(gx, gy))) * u_p[0];
  vec4 color = src(uv);
  float mode = floor(u_p[2] + 0.5);
  if (mode == 1.0) return vec4(color.rgb * edge * 2.2, color.a);
  if (mode == 2.0) return vec4(vec3(1.0 - edge), color.a);
  vec3 toon = floor(color.rgb * 5.0 + 0.5) / 5.0;
  return vec4(mix(toon, vec3(0.0), edge), color.a);
}`,
  chromatic: `
vec4 effect(vec2 uv) {
  vec2 d = uv - 0.5;
  vec4 color = src(uv);
  return vec4(src(0.5 + d * (1.0 + u_p[0] * 2.0)).r, color.g, src(0.5 + d * (1.0 - u_p[0] * 2.0)).b, color.a);
}`,
  rgbShift: `
vec4 effect(vec2 uv) {
  float jitter = u_p[2] > 0.0 ? (hash(vec2(floor(u_time * 24.0), 3.0)) - 0.5) * 2.0 * u_p[2] : 0.0;
  float angle = radians(u_p[1]);
  vec2 offset = vec2(cos(angle), sin(angle) * aspect()) * u_p[0] * (1.0 + jitter);
  vec4 color = src(uv);
  return vec4(src(uv + offset).r, color.g, src(uv - offset).b, color.a);
}`,
  bloom: `
vec4 effect(vec2 uv) {
  vec4 color = src(uv);
  vec3 glow = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < 40; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 40.0) * u_p[2];
    float a = fi * 2.39996323;
    vec3 s = src(uv + vec2(cos(a), sin(a) * aspect()) * r).rgb;
    float w = 1.0 - fi / 60.0;
    glow += s * smoothstep(u_p[0], u_p[0] + 0.2, luma(s)) * w;
    total += w;
  }
  glow = glow / total * u_p[1] * 1.6;
  return vec4(1.0 - (1.0 - color.rgb) * (1.0 - clamp(glow, 0.0, 1.0)), color.a);
}`,
  lightLeak: `
vec4 effect(vec2 uv) {
  vec4 color = src(uv);
  float t = u_time * u_p[2];
  vec2 p = uv * vec2(aspect(), 1.0);
  float n = noise(p * 1.4 + vec2(t * 0.7, -t * 0.4)) * 0.6 + noise(p * 3.6 - vec2(t * 0.3, t * 0.9)) * 0.4;
  float sweep = smoothstep(0.35, 1.05, uv.x * 0.8 + n * 0.7 + sin(t * 1.3) * 0.18);
  float flicker = 0.85 + 0.15 * hash(vec2(floor(u_time * 24.0), 7.0));
  vec3 tint = hsv2rgb(vec3(fract(u_p[1] / 360.0), 0.85, 1.0));
  vec3 leak = clamp(tint * pow(sweep * (0.6 + n), 1.6) * u_p[0] * flicker, 0.0, 1.0);
  return vec4(1.0 - (1.0 - color.rgb) * (1.0 - leak), color.a);
}`,
  crt: `
vec4 effect(vec2 uv) {
  vec2 c = uv - 0.5;
  vec2 q = uv + c * dot(c, c) * u_p[1] * 2.0;
  if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) return vec4(0.0, 0.0, 0.0, 1.0);
  vec4 color = src(q);
  float lines = max(u_p[3], 50.0);
  float scan = 0.5 + 0.5 * cos(q.y * lines * TAU);
  color.rgb *= 1.0 - u_p[0] * (1.0 - scan) * 0.75;
  color.rgb *= 1.0 + u_p[0] * 0.18;
  float column = mod(floor(q.x * lines * aspect() * 3.0), 3.0);
  vec3 mask = vec3(column == 0.0 ? 1.0 : 0.35, column == 1.0 ? 1.0 : 0.35, column == 2.0 ? 1.0 : 0.35);
  color.rgb *= mix(vec3(1.0), mask * 1.45, u_p[2]);
  float edge = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
  color.rgb *= smoothstep(0.0, 0.015 + u_p[1] * 0.06, edge);
  return color;
}`,
  vhs: `
vec4 effect(vec2 uv) {
  float frame = floor(u_time * 24.0);
  float row = 1.0 - uv.y;
  float band = 1.0 - smoothstep(0.0, 0.07, abs(row - fract(u_time * 0.11)));
  float jitter = (hash(vec2(floor(row * 240.0), frame)) - 0.5) * 0.012 * u_p[0];
  float x = uv.x + jitter * (0.4 + band * 4.0 * u_p[1]) + sin(row * 38.0 + u_time * 3.0) * 0.0018 * u_p[0];
  vec2 q = vec2(x, uv.y);
  const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
  const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
  vec4 sharp = src(q);
  vec3 yiq = toYIQ * sharp.rgb;
  vec2 chroma = vec2(0.0);
  for (int i = 0; i < 6; i++) chroma += (toYIQ * src(q - vec2(float(i) * 0.0035 * u_p[2], 0.0)).rgb).yz;
  yiq.yz = mix(yiq.yz, chroma / 6.0, clamp(u_p[2] * 1.4, 0.0, 1.0));
  vec3 color = toRGB * yiq;
  color = mix(color, vec3(luma(color)), 0.15 * u_p[0]) + 0.03 * u_p[0];
  color += (hash(uv * u_resolution + frame) - 0.5) * 0.09 * u_p[0];
  color += band * hash(vec2(floor(uv.x * 160.0), floor(row * 400.0) + frame)) * 0.35 * u_p[1];
  return vec4(color, sharp.a);
}`,
  lumaKey: `
vec4 effect(vec2 uv) {
  vec4 color = src(uv);
  float alpha = smoothstep(u_p[0], u_p[0] + max(u_p[1], 0.001), luma(color.rgb));
  if (u_p[2] > 0.5) alpha = 1.0 - smoothstep(1.0 - u_p[0] - max(u_p[1], 0.001), 1.0 - u_p[0], luma(color.rgb));
  return vec4(color.rgb, color.a * alpha);
}`,
  chromaKey: `
vec2 cbcr(vec3 c) { return vec2(-0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b, 0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b); }
vec4 effect(vec2 uv) {
  vec4 color = src(uv);
  float base = distance(cbcr(color.rgb), cbcr(vec3(u_p[0], u_p[1], u_p[2]))) - u_p[3] * 0.5;
  float mask = pow(clamp(base / max(u_p[4], 0.001), 0.0, 1.0), 1.5);
  float spill = pow(clamp(base / max(u_p[5], 0.001), 0.0, 1.0), 1.5);
  vec3 rgb = mix(vec3(luma(color.rgb)), color.rgb, spill);
  return vec4(rgb, color.a * mask);
}`,
};

export function fxFragmentSource(type: StudioFxType) {
  return `${HEADER}${BODIES[type]}${FOOTER}`;
}
