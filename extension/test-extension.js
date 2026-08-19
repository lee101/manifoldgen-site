#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = __dirname;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.background.service_worker, 'background.js');
assert.ok(manifest.permissions.includes('contextMenus'));
assert.ok(manifest.content_scripts.some((script) => script.js.includes('content.js')));

for (const file of [manifest.background.service_worker, ...manifest.content_scripts.flatMap((script) => script.js)]) {
  assert.ok(fs.existsSync(path.join(root, file)), `manifest entry is missing: ${file}`);
}
for (const size of [16, 32, 48, 128]) {
  assert.ok(fs.existsSync(path.join(root, manifest.icons[String(size)])), `icon ${size} is missing`);
}

const listeners = {};
const opened = [];
const menus = [];
const chrome = {
  runtime: {
    onInstalled: { addListener(fn) { listeners.installed = fn; } },
    onMessage: { addListener(fn) { listeners.message = fn; } },
  },
  contextMenus: {
    removeAll(callback) { menus.length = 0; callback(); },
    create(item) { menus.push(item); },
    onClicked: { addListener(fn) { listeners.clicked = fn; } },
  },
  tabs: { create({ url }) { opened.push(new URL(url)); } },
  action: { onClicked: { addListener(fn) { listeners.action = fn; } } },
};
const context = vm.createContext({ chrome, URL, URLSearchParams, fetch: async () => { throw new Error('offline test'); } });
vm.runInContext(fs.readFileSync(path.join(root, 'background.js'), 'utf8'), context, { filename: 'background.js' });

listeners.installed();
assert.equal(menus.length, 7);
assert.equal(new Set(menus.map((item) => item.id)).size, menus.length);

const longSelection = `${'Detailed scene with amber light and drifting mist. '.repeat(8)}Final instruction.`;
listeners.clicked({ menuItemId: 'manifold-video', selectionText: longSelection });
assert.equal(opened.at(-1).origin, 'https://manifoldgen.com');
assert.equal(opened.at(-1).pathname, '/studio');
assert.equal(opened.at(-1).searchParams.get('generate'), 'video');
assert.ok(opened.at(-1).searchParams.get('prompt').includes('Final instruction.'), 'video prompt must not be title-truncated');

listeners.clicked({ menuItemId: 'manifold-image-video', srcUrl: 'https://cdn.example/source.jpg' });
assert.equal(opened.at(-1).searchParams.get('image_url'), 'https://cdn.example/source.jpg');
assert.equal(opened.at(-1).searchParams.get('generate'), 'video');

listeners.clicked({ menuItemId: 'manifold-image', selectionText: 'A glass city at dawn' });
setImmediate(() => {
  assert.equal(opened.at(-1).searchParams.get('generate'), 'image', 'offline image fallback should open the generator');
  assert.match(opened.at(-1).searchParams.get('prompt'), /glass city at dawn/i);
  listeners.action();
  assert.equal(opened.at(-1).searchParams.get('new'), '1');
  console.log('Extension manifest and workflow tests passed.');
});
