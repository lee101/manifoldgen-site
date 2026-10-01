import { describe, expect, test } from 'bun:test';
import { filmstripFrameIndex, filmstripGrid, filmstripTiles } from '../lib/studio-filmstrip';

describe('filmstripGrid', () => {
  test('samples about every half second and caps the frame count', () => {
    expect(filmstripGrid(4)).toEqual({ count: 8, step: 0.5 });
    expect(filmstripGrid(600).count).toBe(48);
    expect(filmstripGrid(0.1).count).toBe(1);
  });

  test('tolerates invalid durations', () => {
    expect(filmstripGrid(Number.NaN).count).toBe(2);
    expect(filmstripGrid(-3).count).toBe(2);
  });
});

describe('filmstripFrameIndex', () => {
  test('maps source time to the nearest earlier frame and clamps', () => {
    const grid = filmstripGrid(4);
    expect(filmstripFrameIndex(grid, 0)).toBe(0);
    expect(filmstripFrameIndex(grid, 1.26)).toBe(2);
    expect(filmstripFrameIndex(grid, 99)).toBe(grid.count - 1);
    expect(filmstripFrameIndex(grid, -5)).toBe(0);
  });
});

describe('filmstripTiles', () => {
  test('covers the clip width and samples inside the trimmed range', () => {
    const tiles = filmstripTiles(10, 3, 64, 58);
    expect(tiles.length).toBe(Math.ceil((3 * 64) / 58));
    for (const time of tiles) {
      expect(time).toBeGreaterThanOrEqual(10);
      expect(time).toBeLessThanOrEqual(13);
    }
  });

  test('always renders at least one tile', () => {
    expect(filmstripTiles(0, 0.01, 64, 58)).toHaveLength(1);
  });
});
