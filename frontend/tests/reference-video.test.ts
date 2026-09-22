import { describe, expect, test } from 'bun:test';
import {
  REFERENCE_VIDEO_MAX_AUDIOS,
  REFERENCE_VIDEO_MAX_IMAGES,
  REFERENCE_VIDEO_MAX_VIDEOS,
  buildReferenceVideoBody,
  clampResolutionForModel,
  resolutionsForModel,
} from '../app/tools/reference-video/ReferenceVideoTool';

const base = {
  prompt: 'Recreate @Video1 shot for shot with the robot from @Image1.',
  imageUrls: ['https://example.com/robot.png'],
  videoUrls: ['https://example.com/performance.mp4'],
  audioUrls: ['https://example.com/song.mp3'],
  model: 'mini' as const,
  resolution: '720p',
  duration: 0,
  aspectRatio: 'auto' as const,
  includeAudio: false,
  preserveAudio: true,
};

describe('reference video request body', () => {
  test('posts the service body shape', () => {
    expect(buildReferenceVideoBody(base)).toEqual({
      service: 'reference-video',
      prompt: 'Recreate @Video1 shot for shot with the robot from @Image1.',
      reference_image_urls: ['https://example.com/robot.png'],
      reference_video_urls: ['https://example.com/performance.mp4'],
      reference_audio_urls: ['https://example.com/song.mp3'],
      model: 'mini',
      resolution: '720p',
      duration: 0,
      aspect_ratio: 'auto',
      include_audio: false,
      preserve_audio: true,
    });
  });

  test('caps references at 9 images, 3 videos and 3 audios', () => {
    expect(REFERENCE_VIDEO_MAX_IMAGES).toBe(9);
    expect(REFERENCE_VIDEO_MAX_VIDEOS).toBe(3);
    expect(REFERENCE_VIDEO_MAX_AUDIOS).toBe(3);
    const body = buildReferenceVideoBody({
      ...base,
      imageUrls: Array.from({ length: 12 }, (_, i) => `https://example.com/img${i}.png`),
      videoUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/vid${i}.mp4`),
      audioUrls: Array.from({ length: 5 }, (_, i) => `https://example.com/song${i}.mp3`),
    });
    expect(body.reference_image_urls).toHaveLength(9);
    expect(body.reference_video_urls).toHaveLength(3);
    expect(body.reference_audio_urls).toHaveLength(3);
  });

  test('trims the prompt and drops blank urls', () => {
    const body = buildReferenceVideoBody({ ...base, prompt: '  hello  ', imageUrls: ['  ', 'https://example.com/a.png'], videoUrls: [], audioUrls: [] });
    expect(body.prompt).toBe('hello');
    expect(body.reference_image_urls).toEqual(['https://example.com/a.png']);
  });

  test('duration is 0 to match the reference or clamped to 4..15', () => {
    expect(buildReferenceVideoBody({ ...base, duration: 0 }).duration).toBe(0);
    expect(buildReferenceVideoBody({ ...base, duration: 8 }).duration).toBe(8);
    expect(buildReferenceVideoBody({ ...base, duration: 2 }).duration).toBe(4);
    expect(buildReferenceVideoBody({ ...base, duration: 40 }).duration).toBe(15);
    expect(buildReferenceVideoBody({ ...base, duration: -3 }).duration).toBe(0);
  });
});

describe('reference video model to resolution filtering', () => {
  test('mini offers 480p and 720p, pro adds 1080p', () => {
    expect(resolutionsForModel('mini')).toEqual(['480p', '720p']);
    expect(resolutionsForModel('pro')).toEqual(['480p', '720p', '1080p']);
  });

  test('switching to mini clamps 1080p back to 720p', () => {
    expect(clampResolutionForModel('mini', '1080p')).toBe('720p');
    expect(clampResolutionForModel('mini', '480p')).toBe('480p');
    expect(clampResolutionForModel('pro', '1080p')).toBe('1080p');
    expect(clampResolutionForModel('pro', '2K')).toBe('720p');
  });
});
