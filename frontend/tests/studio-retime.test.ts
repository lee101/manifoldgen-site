import { describe, expect, test } from 'bun:test';
import { parseSpeed, retimeBlocker, retimedDuration, speedLabel } from '../lib/studio-retime';

describe('studio retime', () => {
  test('parses speeds including negative reverse', () => {
    expect(parseSpeed('-1')).toBe(-1);
    expect(parseSpeed('0.5x')).toBe(0.5);
    expect(parseSpeed(' 2× ')).toBe(2);
    expect(parseSpeed('-2.5')).toBe(-2.5);
    expect(parseSpeed('0')).toBeNull();
    expect(parseSpeed('0.05')).toBeNull();
    expect(parseSpeed('9')).toBeNull();
    expect(parseSpeed('abc')).toBeNull();
  });

  test('labels and durations', () => {
    expect(speedLabel(-1)).toBe('Reverse 1×');
    expect(speedLabel(0.25)).toBe('0.25×');
    expect(retimedDuration(8, 2)).toBe(4);
    expect(retimedDuration(4, -0.5)).toBe(8);
  });

  test('blockers', () => {
    const ok = { speed: -1, stabilize: false, smooth: false };
    expect(retimeBlocker(ok, 10, 'video')).toBe('');
    expect(retimeBlocker(ok, 10, 'image')).toContain('no motion');
    expect(retimeBlocker({ ...ok, speed: 1 }, 10, 'video')).toContain('Choose');
    expect(retimeBlocker(ok, 90, 'video')).toContain('60s');
    expect(retimeBlocker({ speed: 2, stabilize: false, smooth: false }, 90, 'video')).toBe('');
    expect(retimeBlocker({ speed: 1, stabilize: true, smooth: false }, 90, 'video')).toContain('60s');
  });
});
