import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_ADJUSTMENTS,
  FILM_LOOKS,
  applyFilmLook,
  autoExposure,
  autoWhiteBalance,
  bakeGradeLUT,
  curveEvaluator,
  decodeLUTData,
  encodeLUTData,
  frameStats,
  gradeColor,
  gradeResources,
  parseCube,
  reinhardMatchLUT,
  resampleLUT,
  rgbToLab,
  labToRgb,
  rgbToWheel,
  sampleLUT,
  serializeCube,
  wheelToRGB,
  type StudioAdjustments,
} from '../lib/studio-grade';
import { decodeStudioLUTs, encodeStudioLUTs, migrateStudioDocument, STUDIO_PROJECT_VERSION, type PortableStudioDocument } from '../lib/studio-projects';
import { clipWindow, transitionState, wipeRect } from '../lib/studio-composite';
import { createFxLayer, normalizeFxLayers } from '../lib/studio-fx/registry';

const identityLUT = (size: number) => {
  const data = new Float32Array(size * size * size * 3);
  let offset = 0;
  for (let b = 0; b < size; b += 1) for (let g = 0; g < size; g += 1) for (let r = 0; r < size; r += 1) {
    data[offset++] = r / (size - 1);
    data[offset++] = g / (size - 1);
    data[offset++] = b / (size - 1);
  }
  return data;
};

const grid = (steps: number) => {
  const points: [number, number, number][] = [];
  for (let r = 0; r < steps; r += 1) for (let g = 0; g < steps; g += 1) for (let b = 0; b < steps; b += 1) points.push([r / (steps - 1), g / (steps - 1), b / (steps - 1)]);
  return points;
};

const solid = (r: number, g: number, b: number, count = 64) => {
  const data = new Uint8ClampedArray(count * 4);
  for (let index = 0; index < count; index += 1) data.set([r, g, b, 255], index * 4);
  return { data, width: count, height: 1 };
};

describe('.cube parse/serialize', () => {
  test('round trips a 17 point LUT within serialization precision', () => {
    const graded: StudioAdjustments = { ...DEFAULT_ADJUSTMENTS, contrast: 0.2, liftB: 0.05, gainR: 0.1 };
    const data = bakeGradeLUT(graded, null, 17);
    const text = serializeCube({ title: 'Test "grade"', size: 17, data });
    expect(text.startsWith('TITLE "Test grade"\nLUT_3D_SIZE 17\n')).toBe(true);
    const parsed = parseCube(text);
    expect(parsed.size).toBe(17);
    expect(parsed.title).toBe('Test grade');
    expect(parsed.data.length).toBe(data.length);
    let maxError = 0;
    for (let index = 0; index < data.length; index += 1) maxError = Math.max(maxError, Math.abs(parsed.data[index] - data[index]));
    expect(maxError).toBeLessThan(1e-6);
  });

  test('parses comments, CRLF, and 33/65 sizes', () => {
    for (const size of [33, 65]) {
      const data = identityLUT(size);
      const text = `# comment\r\n${serializeCube({ size, data }).replace(/\n/g, '\r\n')}`;
      const parsed = parseCube(text);
      expect(parsed.size).toBe(size);
      expect(sampleLUT(parsed, 0.3, 0.6, 0.9).map((value) => Math.round(value * 1000) / 1000)).toEqual([0.3, 0.6, 0.9]);
    }
  });

  test('remaps DOMAIN and converts 1D LUTs', () => {
    const domain = `LUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 2 2 2\n${Array.from(identityLUT(2)).reduce((rows: string[], value, index, all) => (index % 3 ? rows : [...rows, `${all[index]} ${all[index + 1]} ${all[index + 2]}`]), []).join('\n')}`;
    const parsed = parseCube(domain);
    expect(sampleLUT(parsed, 0.5, 0.5, 0.5)[0]).toBeCloseTo(0.25, 3);
    const oneD = parseCube('LUT_1D_SIZE 2\n0 0 0\n0.5 1 1\n');
    expect(oneD.size).toBe(33);
    expect(sampleLUT(oneD, 1, 1, 1)).toEqual([0.5, 1, 1]);
  });

  test('rejects malformed files', () => {
    expect(() => parseCube('LUT_3D_SIZE 2\n0 0 0\n')).toThrow();
    expect(() => parseCube('0 0 0')).toThrow();
  });
});

describe('grade math', () => {
  test('default grade is identity', () => {
    const resources = gradeResources(DEFAULT_ADJUSTMENTS);
    for (const point of grid(5)) {
      const out = gradeColor(point, DEFAULT_ADJUSTMENTS, resources);
      out.forEach((value, channel) => expect(value).toBeCloseTo(point[channel], 5));
    }
  });

  test('lift/gamma/gain follow the shader formula', () => {
    const adjustments = { ...DEFAULT_ADJUSTMENTS, liftM: 0.1, gammaM: 0.5, gainM: 0.2 };
    const out = gradeColor([0.5, 0.5, 0.5], adjustments, gradeResources(adjustments));
    expect(out[0]).toBeCloseTo(Math.pow(1.2 * (0.5 + 0.1 * 0.5), Math.pow(2, -0.5)), 6);
    expect(gradeColor([0, 0, 0], adjustments, gradeResources(adjustments))[0]).toBeCloseTo(Math.pow(0.12, Math.pow(2, -0.5)), 6);
  });

  test('baked 33^3 LUT reproduces the per-pixel CPU grade (GPU parity path)', () => {
    const lut = { size: 17, data: parseCube(serializeCube({ size: 17, data: bakeGradeLUT({ ...DEFAULT_ADJUSTMENTS, saturation: 0.3 }, null, 17) })).data };
    for (const look of FILM_LOOKS) {
      const adjustments: StudioAdjustments = { ...applyFilmLook(DEFAULT_ADJUSTMENTS, look), lutID: 'x', lutIntensity: 0.7 };
      const resources = gradeResources(adjustments, lut);
      const baked = { size: 33, data: bakeGradeLUT(adjustments, lut, 33) };
      let maxError = 0;
      for (const point of grid(9).map((p) => p.map((value) => Math.min(1, value * 0.97 + 0.013)) as [number, number, number])) {
        const direct = gradeColor(point, adjustments, resources);
        const viaLUT = sampleLUT(baked, ...point);
        for (let channel = 0; channel < 3; channel += 1) maxError = Math.max(maxError, Math.abs(direct[channel] - viaLUT[channel]));
      }
      expect(maxError).toBeLessThan(0.03);
    }
  });

  test('monotone curves stay within range and hit control points', () => {
    const curve = curveEvaluator([[0, 0], [0.25, 0.1], [0.75, 0.95], [1, 1]]);
    expect(curve(0.25)).toBeCloseTo(0.1, 6);
    expect(curve(0.75)).toBeCloseTo(0.95, 6);
    let last = -1;
    for (let x = 0; x <= 1; x += 0.01) {
      const y = curve(x);
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      last = y;
    }
  });

  test('wheel mapping is invertible', () => {
    const rgb = wheelToRGB(0.3, -0.4, 0.2);
    expect(rgb[0] + rgb[1] + rgb[2]).toBeCloseTo(0, 4);
    const [x, y] = rgbToWheel(...rgb, 0.2);
    expect(x).toBeCloseTo(0.3, 3);
    expect(y).toBeCloseTo(-0.4, 3);
  });

  test('Lab round trip and Reinhard transfer moves means', () => {
    const lab = rgbToLab(0.2, 0.5, 0.8);
    labToRgb(...lab).forEach((value, index) => expect(value).toBeCloseTo([0.2, 0.5, 0.8][index], 4));
    const source = frameStats(solid(60, 60, 60));
    const reference = frameStats(solid(200, 120, 60));
    const lut = { size: 17, data: reinhardMatchLUT(source, reference, 17) };
    const out = sampleLUT(lut, 60 / 255, 60 / 255, 60 / 255);
    const mapped = rgbToLab(...out);
    expect(mapped[0]).toBeCloseTo(reference.labMean[0], 0);
    expect(out[0]).toBeGreaterThan(out[2]);
  });

  test('auto white balance neutralizes a cast and auto exposure hits target', () => {
    const cast = solid(150, 120, 90);
    const balance = { ...DEFAULT_ADJUSTMENTS, ...autoWhiteBalance(cast, DEFAULT_ADJUSTMENTS) };
    const stats = frameStats(cast, balance, gradeResources(balance));
    expect(Math.abs(stats.mean[0] - stats.mean[2])).toBeLessThan(0.02);
    const dark = solid(30, 30, 30);
    const exposed = { ...DEFAULT_ADJUSTMENTS, ...autoExposure(dark, DEFAULT_ADJUSTMENTS) };
    expect(frameStats(dark, exposed, gradeResources(exposed)).luma).toBeCloseTo(0.46, 1);
  });

  test('LUT storage encoding is lossless to 16 bits and resamples', () => {
    const data = identityLUT(5);
    const decoded = decodeLUTData(encodeLUTData(data), 5);
    for (let index = 0; index < data.length; index += 1) expect(Math.abs(decoded[index] - data[index])).toBeLessThan(1e-4);
    const resampled = resampleLUT({ size: 65, data: identityLUT(65) }, 33);
    expect(resampled.length).toBe(33 * 33 * 33 * 3);
    expect(resampled[3]).toBeCloseTo(1 / 32, 5);
  });
});

describe('project migration', () => {
  const v5: PortableStudioDocument = {
    version: 5,
    selectedID: 'a',
    assets: [{
      id: 'a', name: 'clip', kind: 'video', duration: 4, width: 1920, height: 1080, trimStart: 0, trimEnd: 4, timelineStart: 0,
      volume: 1, fadeIn: 0, fadeOut: 0, stageX: 0, stageY: 0, contentType: 'video/mp4', size: 1, lastModified: 1,
      adjustments: { exposure: 0.4, contrast: 0.1 } as StudioAdjustments,
    }],
    history: { undo: [{ selectedID: 'a', selectedIDs: ['a'], playhead: 0, assets: [] }], redo: [] },
  };

  test('v5 documents gain grade defaults and compositing fields', () => {
    const migrated = migrateStudioDocument(v5);
    expect(migrated.version).toBe(STUDIO_PROJECT_VERSION);
    expect(STUDIO_PROJECT_VERSION).toBe(6);
    const asset = migrated.assets[0];
    expect(asset.adjustments.exposure).toBe(0.4);
    expect(asset.adjustments.gainM).toBe(0);
    expect(asset.adjustments.lutIntensity).toBe(1);
    expect(asset.adjustments.glitchSpeed).toBe(0.5);
    expect(asset.opacity).toBe(1);
    expect(asset.blendMode).toBe('normal');
    expect(asset.crop).toBeUndefined();
    expect(migrated.history?.undo).toHaveLength(1);
    expect(migrated.luts).toEqual({});
  });

  test('v6 documents keep grade, fx, LUT and composite data', () => {
    const fx = [createFxLayer('chromaKey', 'k1'), { id: 'bad', type: 'nope', enabled: true, params: {} }];
    const lut = { id: 'lut1', name: 'Look', size: 5, data: identityLUT(5) };
    const assets = [{ ...v5.assets[0], opacity: 2, blendMode: 'screen' as const, crop: { left: 0.1, top: 0, right: 0, bottom: 0 }, transition: { type: 'dip' as const, duration: 9 }, adjustments: { ...DEFAULT_ADJUSTMENTS, lutID: 'lut1', fx: fx as never, curves: { master: [[0, 0.1], [1, 1]], red: [[0, 0], [1, 1]], green: [[0, 0], [1, 1]], blue: [[0, 0], [1, 1]] } } as StudioAdjustments }];
    const migrated = migrateStudioDocument({ ...v5, version: 6, assets, luts: encodeStudioLUTs({ lut1: lut, unused: { ...lut, id: 'unused' } }, assets) });
    const asset = migrated.assets[0];
    expect(asset.opacity).toBe(1);
    expect(asset.blendMode).toBe('screen');
    expect(asset.crop?.left).toBe(0.1);
    expect(asset.transition).toEqual({ type: 'dip', duration: 5 });
    expect(asset.adjustments.fx?.map((layer) => layer.type)).toEqual(['chromaKey']);
    expect(asset.adjustments.curves?.master[0]).toEqual([0, 0.1]);
    expect(Object.keys(migrated.luts || {})).toEqual(['lut1']);
    const decoded = decodeStudioLUTs(migrated.luts);
    expect(decoded.lut1.size).toBe(5);
    expect(sampleLUT(decoded.lut1, 0.5, 0.25, 1)[1]).toBeCloseTo(0.25, 3);
  });

  test('fx normalization fills defaults and drops unknown params', () => {
    const [layer] = normalizeFxLayers([{ id: 'p', type: 'pixelate', params: { size: 0.05, bogus: 3 } }]);
    expect(layer.params).toEqual({ mix: 1, size: 0.05, round: 0 });
    expect(layer.enabled).toBe(true);
  });
});

describe('transitions', () => {
  const clips = [
    { id: 'a', kind: 'video' as const, timelineStart: 0, trimStart: 0, trimEnd: 4, visualTrack: 0 },
    { id: 'b', kind: 'video' as const, timelineStart: 4, trimStart: 0, trimEnd: 4, visualTrack: 0, transition: { type: 'crossfade' as const, duration: 1 } },
  ];

  test('crossfade windows are centered on the cut', () => {
    expect(clipWindow(clips[0], clips)).toMatchObject({ start: 0, end: 4.5 });
    expect(clipWindow(clips[1], clips)).toMatchObject({ start: 3.5, end: 8 });
    expect(transitionState(clips[1], clips, 4)?.alpha).toBeCloseTo(0.5, 6);
    expect(transitionState(clips[0], clips, 4.2)?.alpha).toBe(1);
    expect(transitionState(clips[1], clips, 3.4)).toBeNull();
  });

  test('dip fades out then in and wipes reveal progressively', () => {
    const dip = [clips[0], { ...clips[1], transition: { type: 'dip' as const, duration: 1 } }];
    expect(transitionState(dip[0], dip, 3.75)?.alpha).toBeCloseTo(0.5, 6);
    expect(transitionState(dip[1], dip, 3.9)).toBeNull();
    expect(transitionState(dip[1], dip, 4.25)?.alpha).toBeCloseTo(0.5, 6);
    const wipe = [clips[0], { ...clips[1], transition: { type: 'wipe-right' as const, duration: 1 } }];
    expect(transitionState(wipe[1], wipe, 4)?.wipe?.progress).toBeCloseTo(0.5, 6);
    expect(wipeRect('wipe-left', 0.25, 100, 50)).toEqual({ x: 75, y: 0, width: 25, height: 50 });
  });
});
