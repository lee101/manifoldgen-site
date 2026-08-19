const MANIFOLD_URL = 'https://manifoldgen.com';
const NETWRCK_URL = 'https://netwrck.com';
const IMAGES3_URL = 'https://images3.netwrck.com';

const menuItems = [
  { id: 'manifold-video', title: 'ManifoldGen · Create video from selection', contexts: ['selection'] },
  { id: 'manifold-image', title: 'ManifoldGen · Create image from selection', contexts: ['selection'] },
  { id: 'netwrck-character-text', title: 'Netwrck · Create character from selection', contexts: ['selection'] },
  { id: 'netwrck-gallery-text', title: 'Netwrck · Create gallery art from selection', contexts: ['selection'] },
  { id: 'manifold-image-video', title: 'ManifoldGen · Animate this image', contexts: ['image'] },
  { id: 'netwrck-character-image', title: 'Netwrck · Create character from image', contexts: ['image'] },
  { id: 'netwrck-gallery-image', title: 'Netwrck · Post image to gallery', contexts: ['image'] },
];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const item of menuItems) chrome.contextMenus.create(item);
  });
});

function openURL(base, params = {}) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim()) url.searchParams.set(key, String(value).trim());
  }
  chrome.tabs.create({ url: url.toString() });
}

function titleFromSource(text, fallback = 'Untitled visual') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length <= 72 ? clean : `${clean.slice(0, 69).trimEnd()}…`;
}

function promptFromSource(text, fallback = 'A striking visual moment') {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return (clean || fallback).slice(0, 2000);
}

function manifoldImagePrompt(source) {
  return `Create an original cinematic editorial image inspired by: “${source}”. Refined composition, intentional negative space, tactile detail, controlled color, soft directional light, premium art-direction, no text, no logos, no watermark.`;
}

function netwrckCharacterPrompt(source) {
  return `A compelling original AI character portrait inspired by “${source}”. Front-facing three-quarter portrait, expressive eyes, clear silhouette, distinctive clothing and one memorable prop, polished digital illustration with cinematic lighting, clean uncluttered background, no text, no logo, no watermark.`;
}

function galleryCaption(source) {
  const title = titleFromSource(source, 'A quiet visual study');
  return `${title}. An original visual study shaped with cinematic light, tactile detail, and a restrained editorial palette.`;
}

function normalizeImageURL(value) {
  if (!value) return '';
  try {
    return new URL(value, IMAGES3_URL).toString();
  } catch {
    return '';
  }
}

async function generateImage(prompt, width = 1024, height = 1024) {
  const query = new URLSearchParams({ prompt, width: String(width), height: String(height) });
  const response = await fetch(`${IMAGES3_URL}/create_and_upload_image?${query}`);
  if (!response.ok) throw new Error(`images3 returned ${response.status}`);
  const data = await response.json();
  const imageURL = normalizeImageURL(data.path || data.image_url || data.url);
  if (!imageURL) throw new Error('images3 returned no image URL');
  return imageURL;
}

function openManifoldVideo(prompt, imageURL = '') {
  openURL(`${MANIFOLD_URL}/studio`, {
    generate: 'video',
    prompt,
    image_url: imageURL,
    name: titleFromSource(prompt, 'Web inspiration'),
  });
}

async function openManifoldImage(source) {
  const prompt = manifoldImagePrompt(source);
  try {
    const imageURL = await generateImage(prompt);
    openURL(`${MANIFOLD_URL}/studio`, { image_url: imageURL, name: titleFromSource(source, 'Web inspiration') });
  } catch {
    openURL(`${MANIFOLD_URL}/studio`, { generate: 'image', prompt });
  }
}

async function openNetwrckCharacter(source, imageURL = '') {
  const prompt = netwrckCharacterPrompt(source);
  let avatarURL = imageURL;
  if (!avatarURL) {
    try { avatarURL = await generateImage(prompt, 768, 1024); } catch { avatarURL = ''; }
  }
  openURL(`${NETWRCK_URL}/`, {
    create_character: '1',
    avatar_url: avatarURL,
    name: titleFromSource(source, 'New character'),
    description: `An original character inspired by ${titleFromSource(source, 'this idea')}. Distinctive, expressive, and ready for an ongoing conversation.`,
    greeting: `Hey there. I’m ${titleFromSource(source, 'your new character')}. What kind of story are we stepping into?`,
  });
}

async function openNetwrckGallery(source, imageURL = '') {
  let mediaURL = imageURL;
  if (!mediaURL && source) {
    try { mediaURL = await generateImage(manifoldImagePrompt(source)); } catch { mediaURL = ''; }
  }
  openURL(`${NETWRCK_URL}/gallery`, {
    compose: '1',
    media_url: mediaURL,
    media_type: mediaURL ? 'image' : '',
    text: galleryCaption(source),
  });
}

async function handleAction(action, source, imageURL = '') {
  const cleanSource = promptFromSource(source);
  if (action === 'manifold-video') return openManifoldVideo(`A cinematic shot inspired by “${cleanSource}”. Preserve the core subject while introducing subtle natural motion, a deliberate camera move, and a clean resolved ending.`);
  if (action === 'manifold-image') return openManifoldImage(cleanSource);
  if (action === 'manifold-image-video') return openManifoldVideo('Animate this source image with a restrained cinematic camera move and natural subject motion.', imageURL);
  if (action === 'netwrck-character-text') return openNetwrckCharacter(cleanSource);
  if (action === 'netwrck-character-image') return openNetwrckCharacter('A character based on this source image', imageURL);
  if (action === 'netwrck-gallery-text') return openNetwrckGallery(cleanSource);
  if (action === 'netwrck-gallery-image') return openNetwrckGallery('An original visual from the web', imageURL);
}

chrome.contextMenus.onClicked.addListener((info) => {
  const source = info.selectionText?.trim() || info.linkUrl || '';
  const imageURL = /^https?:/i.test(info.srcUrl || '') ? info.srcUrl : '';
  void handleAction(String(info.menuItemId), source, imageURL);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'manifold-action') return;
  void handleAction(message.action, message.source || '', message.imageURL || '');
});

chrome.action.onClicked.addListener(() => openURL(`${MANIFOLD_URL}/studio`, { new: '1' }));
