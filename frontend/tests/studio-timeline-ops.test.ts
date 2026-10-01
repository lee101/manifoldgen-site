import { describe, expect, test } from 'bun:test';
import { adjacentEdge, fitZoom, rippleRemove, type TimelineClip } from '../lib/studio-timeline-ops';

const clip = (id: string, kind: TimelineClip['kind'], timelineStart: number, seconds: number): TimelineClip => ({ id, kind, timelineStart, trimStart: 0, trimEnd: seconds });

describe('rippleRemove', () => {
  test('shifts later visuals left by the removed length', () => {
    const result = rippleRemove([clip('a', 'video', 0, 2), clip('b', 'video', 2, 3), clip('c', 'image', 5, 1)], ['b']);
    expect(result.map((item) => [item.id, item.timelineStart])).toEqual([['a', 0], ['c', 2]]);
  });

  test('leaves audio in place when only visuals are removed', () => {
    const result = rippleRemove([clip('a', 'video', 0, 2), clip('m', 'audio', 3, 4), clip('b', 'video', 2, 2)], ['a']);
    expect(result.find((item) => item.id === 'm')?.timelineStart).toBe(3);
    expect(result.find((item) => item.id === 'b')?.timelineStart).toBe(0);
  });

  test('merges adjacent removed spans instead of double-shifting', () => {
    const result = rippleRemove([clip('a', 'video', 0, 2), clip('b', 'video', 2, 2), clip('c', 'video', 4, 2)], ['a', 'b']);
    expect(result).toHaveLength(1);
    expect(result[0].timelineStart).toBe(0);
  });

  test('clips overlapping the removed span do not move', () => {
    const result = rippleRemove([clip('a', 'video', 0, 4), clip('b', 'video', 1, 2), clip('c', 'video', 6, 1)], ['b']);
    expect(result.find((item) => item.id === 'a')?.timelineStart).toBe(0);
    expect(result.find((item) => item.id === 'c')?.timelineStart).toBe(4);
  });

  test('never moves before zero and ignores unknown ids', () => {
    expect(rippleRemove([clip('a', 'video', 0, 1)], ['missing'])).toEqual([clip('a', 'video', 0, 1)]);
  });
});

describe('adjacentEdge', () => {
  const clips = [clip('a', 'video', 1, 2), clip('b', 'audio', 5, 1)];
  test('finds next and previous cut points across tracks', () => {
    expect(adjacentEdge(clips, 0, 1)).toBe(1);
    expect(adjacentEdge(clips, 1, 1)).toBe(3);
    expect(adjacentEdge(clips, 3, 1)).toBe(5);
    expect(adjacentEdge(clips, 6, -1)).toBe(5);
    expect(adjacentEdge(clips, 5, -1)).toBe(3);
  });

  test('returns null past the last or before the first edge', () => {
    expect(adjacentEdge(clips, 6, 1)).toBeNull();
    expect(adjacentEdge(clips, 1, -1)).toBeNull();
    expect(adjacentEdge([], 0, 1)).toBeNull();
  });
});

describe('fitZoom', () => {
  test('fills the viewport', () => {
    expect(fitZoom(10, 640)).toBeCloseTo(0.94, 2);
  });

  test('clamps to the zoom range and guards bad input', () => {
    expect(fitZoom(0.5, 4000)).toBe(2.5);
    expect(fitZoom(100000, 400)).toBe(0.05);
    expect(fitZoom(0, 400)).toBe(1);
    expect(fitZoom(10, 0)).toBe(1);
  });
});
