import { describe, expect, test } from 'bun:test';
import {
  decodeMediaDrag,
  encodeMediaDrag,
  galleryProxyURL,
  isStreamingPlaceholder,
  mediaKindFromURL,
  streamingPlaceholder,
} from '../lib/studio-media-drag';

describe('media drag payload', () => {
  test('round-trips', () => {
    const payload = { kind: 'video' as const, url: 'https://x.test/a.mp4', name: 'a', duration: 4.5, attribution: 'Community video' };
    expect(decodeMediaDrag(encodeMediaDrag(payload))).toEqual({ ...payload, assetID: undefined });
  });

  test('keeps the project asset id', () => {
    expect(decodeMediaDrag(encodeMediaDrag({ kind: 'image', url: 'blob:x', name: 'n', assetID: 'abc' }))?.assetID).toBe('abc');
  });

  test('rejects malformed payloads', () => {
    for (const raw of ['', 'not json', '{}', '{"kind":"audio","url":"u","name":"n"}', '{"kind":"video","url":"","name":"n"}', '{"kind":"video","url":"u"}', 'null', '[]']) {
      expect(decodeMediaDrag(raw)).toBeNull();
    }
  });

  test('drops non-positive or non-finite durations', () => {
    expect(decodeMediaDrag('{"kind":"video","url":"u","name":"n","duration":-1}')?.duration).toBeUndefined();
    expect(decodeMediaDrag('{"kind":"video","url":"u","name":"n","duration":"5"}')?.duration).toBeUndefined();
  });
});

describe('galleryProxyURL', () => {
  test('routes gallery CDN objects through the same-origin proxy', () => {
    expect(galleryProxyURL('https://manifoldgenstatic.manifoldgen.com/gallery/originals/a.mp4')).toBe('/api/gallery-assets/originals/a.mp4?v=1');
  });

  test('leaves other hosts and paths alone', () => {
    expect(galleryProxyURL('https://other.test/gallery/a.mp4')).toBe('https://other.test/gallery/a.mp4');
    expect(galleryProxyURL('https://manifoldgenstatic.manifoldgen.com/other/a.mp4')).toBe('https://manifoldgenstatic.manifoldgen.com/other/a.mp4');
    expect(galleryProxyURL('/relative/a.mp4')).toBe('/relative/a.mp4');
  });
});

describe('mediaKindFromURL', () => {
  test('classifies by extension ignoring the query string', () => {
    expect(mediaKindFromURL('https://x.test/a.MP4?token=1')).toBe('video');
    expect(mediaKindFromURL('https://x.test/a.webp')).toBe('image');
    expect(mediaKindFromURL('https://x.test/a.mp3')).toBe('audio');
    expect(mediaKindFromURL('https://x.test/a')).toBeNull();
    expect(mediaKindFromURL('https://x.test/a.mp4.html')).toBeNull();
  });
});

describe('streaming placeholders', () => {
  test('are tracked by identity, not by size', () => {
    const placeholder = streamingPlaceholder('a.mp4', 'video/mp4');
    expect(isStreamingPlaceholder(placeholder)).toBe(true);
    expect(isStreamingPlaceholder(new File([], 'a.mp4', { type: 'video/mp4' }))).toBe(false);
  });
});
