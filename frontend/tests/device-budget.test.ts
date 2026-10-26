import { describe, expect, test } from 'bun:test';
import { deviceTier, exportCaps } from '../lib/device-budget';

describe('device budget', () => {
  test('phones, touch-first and low-memory devices are constrained', () => {
    expect(deviceTier({ mobileUA: true, hardwareConcurrency: 8 })).toBe('constrained');
    expect(deviceTier({ coarsePointer: true })).toBe('constrained');
    expect(deviceTier({ deviceMemory: 4 })).toBe('constrained');
    expect(deviceTier({ hardwareConcurrency: 4 })).toBe('constrained');
  });

  test('desktops and unknown signals are standard', () => {
    expect(deviceTier({ deviceMemory: 8, hardwareConcurrency: 16, coarsePointer: false, mobileUA: false })).toBe('standard');
    expect(deviceTier({})).toBe('standard');
  });

  test('constrained devices cap hardware at 1080p and software at 720p', () => {
    expect(exportCaps('constrained')).toEqual({ hardware: { width: 1920, height: 1080 }, software: { width: 1280, height: 720 } });
    expect(exportCaps('standard').software).toEqual({ width: 1920, height: 1080 });
  });
});
