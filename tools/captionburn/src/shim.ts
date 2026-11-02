/**
 * Minimal DOM shim so frontend/lib/captions can run under bun.
 * Installed via bunfig preload, before any engine module initialises
 * (CaptionEngine creates its measurement surfaces at import time).
 */
import { createCanvas } from '@napi-rs/canvas';

const documentShim = {
  createElement(tag: string) {
    if (tag !== 'canvas') throw new Error(`captionburn: unsupported element <${tag}>`);
    return createCanvas(8, 8);
  },
};

Object.defineProperty(globalThis, 'document', { value: documentShim, configurable: true });
