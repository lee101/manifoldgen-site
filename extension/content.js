(() => {
  if (window.top !== window || document.getElementById('manifoldgen-everywhere')) return;

  const host = document.createElement('div');
  host.id = 'manifoldgen-everywhere';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .mg-toolbar { position: fixed; display: flex; align-items: center; gap: 5px; max-width: calc(100vw - 16px); padding: 7px; border: 1px solid rgba(255,255,255,.16); border-radius: 15px; background: rgba(18,17,28,.95); box-shadow: 0 14px 44px rgba(0,0,0,.34); backdrop-filter: blur(18px); pointer-events: auto; font: 600 11px/1.1 system-ui,sans-serif; }
    .mg-toolbar button, .mg-image button { border: 0; border-radius: 9px; padding: 8px 9px; color: #f9f7ff; background: rgba(255,255,255,.09); cursor: pointer; white-space: nowrap; font: inherit; }
    .mg-toolbar button:hover, .mg-image button:hover { background: #7166e8; }
    .mg-brand { padding: 7px 7px 7px 4px; color: #8be8d7; letter-spacing: .12em; font-size: 10px; }
    .mg-netwrck { color: #ffbd69 !important; }
    .mg-image { position: fixed; display: flex; gap: 5px; padding: 5px; border: 1px solid rgba(255,255,255,.14); border-radius: 11px; background: rgba(18,17,28,.95); box-shadow: 0 10px 28px rgba(0,0,0,.3); pointer-events: auto; font: 600 10px/1.1 system-ui,sans-serif; }
    .mg-image button { padding: 7px 8px; background: #7166e8; }
  `;
  shadow.append(style);
  document.documentElement.append(host);

  const send = (action, source, imageURL = '') => chrome.runtime.sendMessage({ type: 'manifold-action', action, source, imageURL });
  let selectionToolbar;
  let imageToolbar;
  let hoveredImage;

  function removeSelectionToolbar() { selectionToolbar?.remove(); selectionToolbar = undefined; }
  function removeImageToolbar() { imageToolbar?.remove(); imageToolbar = undefined; hoveredImage = undefined; }

  function showSelectionToolbar() {
    const selection = window.getSelection();
    const source = selection?.toString().replace(/\s+/g, ' ').trim();
    if (!source || !selection?.rangeCount) return removeSelectionToolbar();
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    removeSelectionToolbar();
    selectionToolbar = document.createElement('div');
    selectionToolbar.className = 'mg-toolbar';
    selectionToolbar.style.left = `${Math.max(8, Math.min(window.innerWidth - 620, rect.left))}px`;
    selectionToolbar.style.top = `${Math.max(8, rect.top - 53)}px`;
    selectionToolbar.innerHTML = '<span class="mg-brand">MANIFOLD</span><button data-action="manifold-image">Image</button><button data-action="manifold-video">Video</button><span class="mg-brand mg-netwrck">NETWRCK</span><button data-action="netwrck-character" class="mg-netwrck">Character</button><button data-action="netwrck-gallery" class="mg-netwrck">Gallery</button>';
    selectionToolbar.addEventListener('mousedown', (event) => event.preventDefault());
    selectionToolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const action = button.dataset.action;
      if (action === 'netwrck-character') send('netwrck-character-text', source);
      else if (action === 'netwrck-gallery') send('netwrck-gallery-text', source);
      else send(action, source);
      removeSelectionToolbar();
    });
    shadow.append(selectionToolbar);
  }

  function showImageToolbar(image) {
    if (image === hoveredImage && imageToolbar) return;
    hoveredImage = image;
    removeImageToolbar();
    hoveredImage = image;
    const rect = image.getBoundingClientRect();
    imageToolbar = document.createElement('div');
    imageToolbar.className = 'mg-image';
    imageToolbar.style.left = `${Math.max(8, Math.min(window.innerWidth - 290, rect.left))}px`;
    imageToolbar.style.top = `${Math.max(8, rect.top + 8)}px`;
    imageToolbar.innerHTML = '<button data-action="manifold-image-video">Animate</button><button data-action="netwrck-character-image">Character</button><button data-action="netwrck-gallery-image">Gallery</button>';
    imageToolbar.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const imageURL = image.currentSrc || image.src;
      if (!/^https?:/i.test(imageURL)) return;
      send(button.dataset.action, image.alt || 'A striking visual', imageURL);
      removeImageToolbar();
    });
    shadow.append(imageToolbar);
  }

  document.addEventListener('mouseup', () => window.setTimeout(showSelectionToolbar, 0), true);
  document.addEventListener('mousedown', (event) => {
    if (!event.target.closest?.('#manifoldgen-everywhere')) removeSelectionToolbar();
  }, true);
  document.addEventListener('mouseover', (event) => {
    const image = event.target.closest?.('img');
    if (image?.src && image.width > 140 && image.height > 90) showImageToolbar(image);
  }, true);
  document.addEventListener('mouseout', (event) => {
    if (!hoveredImage || hoveredImage.contains(event.relatedTarget)) return;
    window.setTimeout(() => { if (!imageToolbar?.matches(':hover')) removeImageToolbar(); }, 180);
  }, true);
})();
