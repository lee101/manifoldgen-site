import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_EXPORT_SETTINGS, clipEnd, exportFormatDetails, exportSize, fitWithin, outputFrameRate, timelineComposition } from '../lib/studio-export';
import { renderMediaURL, renderSettings, softwareMaxSize } from '../lib/studio-render-job';
import { DEFAULT_DESIGN_SIZE, STUDIO_ASSET_KEYS, STUDIO_DOCUMENT_KEYS, STUDIO_LUT_KEYS, STUDIO_TEXT_KEYS, documentAudioTrackVolume, documentDesignSize, normalizeDesignSize } from '../lib/studio-document';
import { MAX_VISUAL_TRACKS, stackOverlappingVisuals } from '../lib/studio-timeline-ops';
import { DEFAULT_ADJUSTMENTS } from '../lib/studio-grade';
import { FX_DEFINITIONS } from '../lib/studio-fx/registry';
import { BLEND_MODES, TRANSITIONS } from '../lib/studio-composite';
import { STUDIO_FONTS } from '../lib/studio-text';
import { migrateStudioDocument, type PortableStudioDocument } from '../lib/studio-projects';

type SchemaNode = { properties?: Record<string, SchemaNode>; items?: SchemaNode; additionalProperties?: SchemaNode | boolean; enum?: unknown[]; 'x-input-only'?: boolean };
const schema = JSON.parse(readFileSync(join(import.meta.dir, '../../server/studio_schema.json'), 'utf8')) as { document: SchemaNode; example: PortableStudioDocument; limits: Record<string, number> };
const assetSchema = schema.document.properties!.assets.items!;
const keys = (node: SchemaNode) => Object.entries(node.properties || {}).filter(([, value]) => !value['x-input-only']).map(([key]) => key).sort();
const sorted = (values: Iterable<unknown>) => [...values].map(String).sort();

describe('export sizing', () => {
  test('fitWithin keeps even dimensions and an encoder-safe minimum', () => {
    expect(fitWithin(1920, 1080, 1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(1921, 1081, 4096, 4096)).toEqual({ width: 1922, height: 1082 });
    expect(fitWithin(4, 2, 4096, 4096)).toEqual({ width: 32, height: 16 });
  });

  test('exportSize honours presets in both orientations', () => {
    expect(exportSize(1920, 1080, 'source')).toEqual({ width: 1920, height: 1080 });
    expect(exportSize(3840, 2160, '720p')).toEqual({ width: 1280, height: 720 });
    expect(exportSize(1080, 1920, '720p')).toEqual({ width: 720, height: 1280 });
    expect(exportSize(8192, 4096, 'source')).toEqual({ width: 4096, height: 2048 });
  });

  test('format details and frame clock', () => {
    expect(exportFormatDetails('mp4-h264')).toMatchObject({ codec: 'avc', mime: 'video/mp4' });
    expect(exportFormatDetails('webm-vp9')).toMatchObject({ codec: 'vp9', extension: 'webm' });
    expect(exportFormatDetails('webm-av1').codec).toBe('av1');
    expect(outputFrameRate('source')).toBe(30);
    expect(outputFrameRate(24)).toBe(24);
    expect(DEFAULT_EXPORT_SETTINGS).toEqual({ format: 'mp4-h264', resolution: 'source', frameRate: 'source', quality: 'balanced', audio: 'aac' });
  });
});

describe('timeline composition', () => {
  const clip = (id: string, kind: 'video' | 'image' | 'audio', timelineStart: number, trimEnd: number, visualTrack = 0) => ({ id, kind, timelineStart, trimStart: 0, trimEnd, visualTrack });

  test('visuals, base clip and duration match the Studio timeline', () => {
    const assets = [clip('music', 'audio', 0, 12), clip('b', 'video', 4, 3, 1), clip('a', 'video', 0, 4), clip('c', 'image', 0, 2, 2)];
    const composition = timelineComposition(assets);
    expect(composition.visuals.map((asset) => asset.id)).toEqual(['b', 'a', 'c']);
    expect(composition.base?.id).toBe('a');
    expect(composition.duration).toBe(12);
    expect(timelineComposition([clip('t', 'image', 0, 0.2)]).duration).toBe(1);
    expect(clipEnd({ timelineStart: 2, trimStart: 1, trimEnd: 4 })).toBe(5);
  });

  test('overlapping visuals stack into free lanes while sequences share one', () => {
    const stacked = stackOverlappingVisuals([clip('a', 'video', 0, 4), clip('b', 'video', 4, 4), clip('c', 'image', 1, 2), clip('m', 'audio', 0, 9, 5)]);
    expect(stacked.map((asset) => [asset.id, asset.visualTrack])).toEqual([['a', 0], ['b', 0], ['c', 1], ['m', 5]]);
    const crowded = Array.from({ length: 14 }, (_, index) => clip(`x${index}`, 'image', 0, 1));
    expect(Math.max(...stackOverlappingVisuals(crowded).map((asset) => asset.visualTrack))).toBe(MAX_VISUAL_TRACKS - 1);
  });

  test('design size falls back to the first visual and clamps edges', () => {
    expect(documentDesignSize({}, [{ kind: 'audio', width: 1, height: 1 }, { kind: 'video', width: 1280, height: 720 }])).toEqual({ width: 1280, height: 720 });
    expect(documentDesignSize({ canvas: { width: 640, height: 360 } }, [{ kind: 'video', width: 1280, height: 720 }])).toEqual({ width: 640, height: 360 });
    expect(documentDesignSize({}, [])).toEqual(DEFAULT_DESIGN_SIZE);
    expect(normalizeDesignSize({ width: 10, height: 99999 })).toEqual({ width: 64, height: 8192 });
    expect(documentAudioTrackVolume({ audioTrackVolume: 5 })).toBe(2);
    expect(documentAudioTrackVolume({})).toBe(1);
  });
});

describe('render job', () => {
  test('settings fall back to Studio defaults and accept agent fps', () => {
    expect(renderSettings()).toEqual(DEFAULT_EXPORT_SETTINGS);
    expect(renderSettings({ format: 'webm-vp9', frameRate: 24, quality: 'high', resolution: '720p' })).toEqual({ format: 'webm-vp9', resolution: '720p', frameRate: 24, quality: 'high', audio: 'aac' });
    expect(renderSettings({ format: 'gif' as never, frameRate: 120, resolution: '8k' as never }).frameRate).toBe('source');
    expect(softwareMaxSize({ width: 3840, height: 2160 })).toEqual({ width: 3840, height: 2160 });
    expect(softwareMaxSize({ width: 9000, height: 2 })).toBeUndefined();
  });

  test('media URLs must be http(s) and same-origin for server jobs', () => {
    const base = 'http://127.0.0.1:4000/studio/render?job=abc';
    expect(renderMediaURL('/job/abc/media/0', base, true).href).toBe('http://127.0.0.1:4000/job/abc/media/0');
    expect(() => renderMediaURL('file:///etc/passwd', base, false)).toThrow('Unsupported');
    expect(() => renderMediaURL('data:video/mp4;base64,AA', base, false)).toThrow('Unsupported');
    expect(() => renderMediaURL('http://10.0.0.1/a.mp4', base, true)).toThrow('render host');
    expect(renderMediaURL('https://cdn.example/a.mp4', base, false).hostname).toBe('cdn.example');
  });
});

describe('studio schema stays in sync with the editor types', () => {
  test('document, asset, text and LUT fields', () => {
    expect(keys(schema.document)).toEqual(sorted(Object.keys(STUDIO_DOCUMENT_KEYS)));
    expect(keys(assetSchema)).toEqual(sorted(Object.keys(STUDIO_ASSET_KEYS)));
    expect(keys(assetSchema.properties!.text)).toEqual(sorted(Object.keys(STUDIO_TEXT_KEYS)));
    expect(keys(schema.document.properties!.luts.additionalProperties as SchemaNode)).toEqual(sorted(Object.keys(STUDIO_LUT_KEYS)));
  });

  test('adjustments, fx, transitions, blend modes and fonts', () => {
    const adjustments = assetSchema.properties!.adjustments;
    expect(keys(adjustments)).toEqual(sorted([...Object.keys(DEFAULT_ADJUSTMENTS), 'curves', 'lutID', 'fx']));
    expect(sorted(adjustments.properties!.fx.items!.properties!.type.enum!)).toEqual(sorted(FX_DEFINITIONS.map((definition) => definition.type)));
    expect(sorted(assetSchema.properties!.transition.properties!.type.enum!)).toEqual(sorted(TRANSITIONS.map((item) => item.id)));
    expect(sorted(assetSchema.properties!.blendMode.enum!)).toEqual(sorted(BLEND_MODES.map((mode) => mode.id)));
    expect(sorted(assetSchema.properties!.text.properties!.fontFamily.enum!)).toEqual(sorted(STUDIO_FONTS.map((font) => font.name)));
  });

  test('the worked example survives Studio migration', () => {
    const migrated = migrateStudioDocument(schema.example);
    expect(migrated.version).toBe(6);
    expect(migrated.assets.map((asset) => asset.id)).toEqual(['title', 'shot-1', 'shot-2', 'music']);
    expect(migrated.assets[2].transition).toEqual({ type: 'crossfade', duration: 1 });
    expect(migrated.assets[1].adjustments.lutID).toBe('warm');
    expect(schema.limits).toMatchObject({ maxClips: 200, maxSeconds: 600, maxWidth: 3840, maxHeight: 2160, maxFps: 60 });
  });
});
