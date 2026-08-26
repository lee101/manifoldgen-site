'use client';

import { Fragment, useEffect, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

export function hapticFeedback(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is unavailable or blocked.
  }
}

export function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).catch(() => undefined);
    return true;
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  input.remove();
  return copied;
}

export function downloadMedia(url: string) {
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = '';
  anchor.rel = 'noopener';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export type PressPoint = { x: number; y: number };

// Per-row handler factory for lists: create once with useMemo, spread the
// returned object onto each row. Avoids hooks-in-loop while giving every row
// its own press tracking keyed by the target value. Fires with the pointer
// position so callers can anchor a context menu at the cursor or finger.
export function createLongPressRegistry<T>(onFire: (target: T, at: PressPoint) => void, delayMs = 450) {
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;
  let firedAt = 0;
  const clear = () => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  return (target: T) => ({
    onPointerDown(event: ReactPointerEvent) {
      if (event.pointerType !== 'touch') return;
      clear();
      startX = event.clientX;
      startY = event.clientY;
      timer = window.setTimeout(() => {
        timer = null;
        firedAt = Date.now();
        hapticFeedback();
        onFire(target, { x: startX, y: startY });
      }, delayMs);
    },
    onPointerMove(event: ReactPointerEvent) {
      if (timer === null) return;
      if (Math.abs(event.clientX - startX) > 10 || Math.abs(event.clientY - startY) > 10) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture(event: { preventDefault: () => void; stopPropagation: () => void }) {
      if (Date.now() - firedAt < 650) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onContextMenu(event: ReactMouseEvent<HTMLElement>) {
      event.preventDefault();
      firedAt = Date.now();
      onFire(target, { x: event.clientX, y: event.clientY });
    },
  });
}

export type ContextMenuItem = {
  label: string;
  detail?: string;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export type ContextMenuGroup = {
  label?: string;
  // Compact three-column row for browser-style actions.
  row?: boolean;
  items: ContextMenuItem[];
};

// Cursor-anchored replacement for native right-click menus. Never fullscreen:
// the panel hugs the pointer and clamps to the viewport like a native menu.
// Escape, scroll, resize, blur, click-away, and another right-click close it so
// browser navigation shortcuts stay reachable.
export function MediaContextMenu({
  x,
  y,
  label,
  groups,
  onClose,
}: {
  x: number;
  y: number;
  label: string;
  groups: ContextMenuGroup[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const close = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    document.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80]"
      onPointerDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        data-testid="media-context-menu"
        role="menu"
        aria-label={label.slice(0, 120)}
        className="fixed max-h-[calc(100dvh-16px)] w-60 overflow-x-hidden overflow-y-auto rounded-lg border border-[#353a44] bg-[#14171c]/[.98] p-[5px] shadow-[0_16px_50px_rgba(0,0,0,.55)] backdrop-blur-md"
        style={{ left: x, top: y }}
        ref={(el) => {
          if (!el) return;
          el.style.left = `${Math.max(8, Math.min(x, window.innerWidth - el.offsetWidth - 8))}px`;
          el.style.top = `${Math.max(8, Math.min(y, window.innerHeight - el.offsetHeight - 8))}px`;
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {groups.map((group, index) => (
          <Fragment key={group.label || index}>
            {index > 0 && <div role="separator" className="mx-[3px] my-1 h-px bg-white/10" />}
            {group.label && (
              <p className="px-2 pb-0.5 pt-1 text-[9px] font-extrabold uppercase tracking-[.12em] text-white/35">{group.label}</p>
            )}
            <div className={group.row ? 'grid grid-cols-3 gap-[2px]' : 'grid gap-[1px]'}>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    onClose();
                    item.onClick?.();
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium ${
                    group.row ? 'flex-col justify-center gap-0.5 py-2' : ''
                  } ${item.danger ? 'text-red-300 hover:bg-red-500/15' : 'text-white hover:bg-white/10'} disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent`}
                >
                  {item.icon}
                  <span className="min-w-0">
                    <b className="block truncate font-semibold">{item.label}</b>
                    {item.detail && !group.row && (
                      <small className="block truncate text-[10px] font-normal leading-tight text-white/40">{item.detail}</small>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

const GALLERY_CDN_HOST = 'manifoldgenstatic.manifoldgen.com';

// Gallery bytes live on a separate CDN origin; route fetches through our
// same-origin proxy so CORS can never fail the clipboard write.
function sameOriginGalleryURL(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.hostname === GALLERY_CDN_HOST && parsed.pathname.startsWith('/gallery/')) {
      return `/api/gallery-assets/${parsed.pathname.slice('/gallery/'.length)}?v=1`;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

async function fetchImageBlob(url: string): Promise<Blob> {
  const response = await fetch(sameOriginGalleryURL(url), { cache: 'force-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.blob();
}

async function imageBlobAsPNG(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((encoded) => (encoded ? resolve(encoded) : reject(new Error('PNG encode failed'))), 'image/png');
  });
}

// Clipboard write starts synchronously with a Promise-valued PNG so Safari
// keeps the user-gesture window open while the bytes load.
export async function copyImageToClipboard(url: string): Promise<boolean> {
  if (!url || !window.isSecureContext || typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': fetchImageBlob(url).then(imageBlobAsPNG) })]);
    return true;
  } catch {
    return false;
  }
}
