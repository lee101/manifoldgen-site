import { describe, expect, test } from 'bun:test';
import { generatorRequest, videoGenerator } from '../lib/video-generators';

const values = { prompt: 'p', duration: 10, aspectRatio: '16:9', resolution: '1080p', includeAudio: false };

describe('Kling 4.0 generators', () => {
  test('route to the Kling 4 model ids', () => {
    expect(videoGenerator('kling-4')?.model).toBe('kling-4.0-text-to-video');
    expect(videoGenerator('kling-4-image')?.model).toBe('kling-4.0-image-to-video');
    expect(videoGenerator('kling-4-reference')?.model).toBe('kling-4.0-reference-to-video');
    expect(videoGenerator('kling-4-edit')?.model).toBe('kling-4.0-video-edit');
  });

  test('request shapes per mode', () => {
    const image = generatorRequest(videoGenerator('kling-4-image')!, { ...values, imageURL: 'https://x/a.png' });
    expect(image).toMatchObject({ service: 'video_generate', image_url: 'https://x/a.png', resolution: '1080p', duration: 10 });
    const ref = generatorRequest(videoGenerator('kling-4-reference')!, { ...values, imageURL: 'https://x/a.png' });
    expect(ref).toMatchObject({ reference_image_urls: ['https://x/a.png'] });
    const edit = generatorRequest(videoGenerator('kling-4-edit')!, { ...values, videoURL: 'https://x/v.mp4' });
    expect(edit).toMatchObject({ video_url: 'https://x/v.mp4' });
    expect(edit).not.toHaveProperty('image_url');
  });
});
