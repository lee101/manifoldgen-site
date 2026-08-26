'use client';

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';

export type SheetAction = {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
};

export function hapticFeedback(ms = 15) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Vibration is unavailable or blocked.
  }
}

export function copyText(value: string) {
  if (navigator.clipboard && window.isSecureContext) {
    void navigator.clipboard.writeText(value).catch(() => undefined);
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

// Per-row handler factory for lists: create once with useMemo, spread the
// returned object onto each row. Avoids hooks-in-loop while giving every row
// its own press tracking keyed by the target value.
export function createLongPressRegistry<T>(onFire: (target: T) => void, delayMs = 450) {
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
        onFire(target);
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
    onContextMenu(event: { preventDefault: () => void }) {
      event.preventDefault();
      firedAt = Date.now();
      onFire(target);
    },
  });
}

// Single-target hook variant with identical semantics.
export function useLongPress(onLongPress: () => void, delayMs = 450) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedAt = useRef(0);

  const clear = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const swallowPostPressClick = useCallback((event: { stopPropagation: () => void; preventDefault: () => void }) => {
    if (Date.now() - firedAt.current < 650) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    onPointerDown: useCallback(
      (event: ReactPointerEvent) => {
        if (event.pointerType !== 'touch') return;
        clear();
        start.current = { x: event.clientX, y: event.clientY };
        timer.current = window.setTimeout(() => {
          timer.current = null;
          start.current = null;
          firedAt.current = Date.now();
          hapticFeedback();
          onLongPress();
        }, delayMs);
      },
      [clear, delayMs, onLongPress],
    ),
    onPointerMove: useCallback(
      (event: ReactPointerEvent) => {
        if (!start.current) return;
        if (Math.abs(event.clientX - start.current.x) > 10 || Math.abs(event.clientY - start.current.y) > 10) clear();
      },
      [clear],
    ),
    onPointerUp: clear,
    onPointerCancel: clear,
    onPointerLeave: clear,
    onClickCapture: swallowPostPressClick,
    onContextMenu: useCallback(
      (event: { preventDefault: () => void }) => {
        event.preventDefault();
        firedAt.current = Date.now();
        onLongPress();
      },
      [onLongPress],
    ),
  };
}

export function MediaActionSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title.slice(0, 80) || 'Media actions'}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#12121a] p-2 shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-2 px-2 pb-1 pt-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-left text-xs leading-snug text-white/55">{title}</p>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-white/60 hover:bg-white/10 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="grid gap-1 pt-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => {
                onClose();
                action.onClick();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-white hover:bg-white/10"
            >
              {action.icon}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
