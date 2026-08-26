import { useCallback, useRef } from 'react';

export type PromptKind = 'image' | 'video' | 'music' | 'sfx' | 'speech';

export interface PromptHistoryEntry {
  id: string;
  kind: PromptKind;
  text: string;
  at: number;
}

const MAX_ENTRIES = 200;

const authScope = process.env.NEXT_PUBLIC_MANIFOLDGEN_AUTH_SCOPE?.trim();

/** Per-account storage key; scoped like lib/auth when a dev frontend targets production. */
export function promptHistoryUserKey(email: string, apiKey: string): string {
  const who = email.trim() || apiKey.slice(-12);
  return authScope ? `${authScope}:${who}` : who;
}

function storageKey(userKey: string) {
  return `mg_prompt_history:${userKey}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function persist(userKey: string, entries: PromptHistoryEntry[]) {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(storageKey(userKey), JSON.stringify(entries));
  } catch {
    // Quota or privacy mode: history becomes session-only.
  }
}

export function loadPromptHistory(userKey: string): PromptHistoryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is PromptHistoryEntry =>
      !!entry && typeof entry === 'object'
      && typeof (entry as PromptHistoryEntry).id === 'string'
      && typeof (entry as PromptHistoryEntry).text === 'string'
      && typeof (entry as PromptHistoryEntry).at === 'number'
      && typeof (entry as PromptHistoryEntry).kind === 'string');
  } catch {
    return [];
  }
}

/** Newest first. Collapses a repeated newest prompt to the top instead of duplicating it. */
export function recordPrompt(userKey: string, kind: PromptKind, text: string): PromptHistoryEntry[] {
  const trimmed = text.trim();
  if (!trimmed) return loadPromptHistory(userKey);
  const current = loadPromptHistory(userKey);
  if (current[0]?.kind === kind && current[0]?.text === trimmed) {
    return current;
  }
  const entry: PromptHistoryEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    text: trimmed,
    at: Date.now(),
  };
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  persist(userKey, next);
  return next;
}

export function updatePromptEntry(userKey: string, id: string, text: string): PromptHistoryEntry[] {
  const trimmed = text.trim();
  const next = loadPromptHistory(userKey)
    .map((entry) => (entry.id === id && trimmed ? { ...entry, text: trimmed } : entry))
    .filter((entry) => entry.text);
  persist(userKey, next);
  return next;
}

export function deletePromptEntry(userKey: string, id: string): PromptHistoryEntry[] {
  const next = loadPromptHistory(userKey).filter((entry) => entry.id !== id);
  persist(userKey, next);
  return next;
}

export function clearPromptHistory(userKey: string): PromptHistoryEntry[] {
  persist(userKey, []);
  return [];
}

/**
 * Terminal-style history cycling for a controlled textarea. ArrowUp with the
 * caret at the very start walks to older entries; ArrowDown at the very end
 * walks back, restoring the in-progress draft past the newest entry. Editing
 * the field between presses restarts from the draft.
 */
export function usePromptHistoryCycler(
  items: PromptHistoryEntry[],
  apply: (text: string) => void,
): (event: React.KeyboardEvent<HTMLTextAreaElement>) => void {
  const state = useRef({ cursor: -1, draft: '', applied: '' });
  return useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = event.currentTarget;
    const s = state.current;
    if (s.applied && el.value !== s.applied) {
      s.cursor = -1;
      s.applied = '';
    }
    if (event.key === 'ArrowUp') {
      if (!items.length || el.selectionStart !== 0 || el.selectionEnd !== 0) return;
      event.preventDefault();
      if (s.cursor === -1) {
        s.draft = el.value;
        s.cursor = 0;
      } else {
        s.cursor = Math.min(s.cursor + 1, items.length - 1);
      }
      s.applied = items[s.cursor].text;
      apply(s.applied);
    } else if (event.key === 'ArrowDown') {
      if (s.cursor === -1 || el.selectionStart !== el.selectionEnd || el.selectionEnd !== el.value.length) return;
      event.preventDefault();
      s.cursor -= 1;
      s.applied = s.cursor < 0 ? s.draft : items[s.cursor].text;
      apply(s.applied);
    }
  }, [items, apply]);
}
