'use client';

import { useEffect, useRef } from 'react';
import type { CaptionWord } from '@/lib/captions/types';
import { deleteWord, mergeWithPrevious, setWordText, wordID } from '@/lib/captions/words';
import styles from './crazy-captions.module.css';

export function WordFlow({ words, selected, time, levels, offset, onSelect, onChange }: {
  words: CaptionWord[];
  selected: number;
  time: number;
  levels: number[];
  offset: number;
  onSelect: (index: number) => void;
  onChange: (words: CaptionWord[]) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const pending = useRef<{ index: number; caret: number } | null>(null);

  useEffect(() => {
    const target = pending.current;
    if (!target) return;
    pending.current = null;
    const input = refs.current[target.index];
    if (input) {
      input.focus();
      input.setSelectionRange(target.caret, target.caret);
    }
  });

  const update = (index: number, patch: Partial<CaptionWord>) => onChange(words.map((word, i) => (i === index ? { ...word, ...patch } : word)));

  const key = (event: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    const input = event.currentTarget;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const word = words[index];
    if (event.key === 'Enter') {
      event.preventDefault();
      if (words[index + 1]) onChange(words.map((item, i) => (i === index + 1 ? { ...item, breakBefore: !item.breakBefore } : item)));
    } else if (event.key === 'Backspace' && start === 0 && end === 0 && index > 0) {
      event.preventDefault();
      pending.current = { index: index - 1, caret: words[index - 1].text.length };
      onChange(mergeWithPrevious(words, index));
    } else if (event.key === 'Delete' && start === word.text.length && end === start && index < words.length - 1) {
      event.preventDefault();
      pending.current = { index, caret: word.text.length };
      onChange(mergeWithPrevious(words, index + 1));
    } else if (event.key === ' ') {
      event.preventDefault();
      if (start > 0 && start < word.text.length) {
        const ratio = start / word.text.length;
        const cut = word.start + (word.end - word.start) * ratio;
        const chars = [...word.text];
        const left = { ...word, text: chars.slice(0, start).join(''), end: cut };
        const right = { ...word, id: wordID(), text: chars.slice(start).join(''), start: cut, breakBefore: false };
        pending.current = { index: index + 1, caret: 0 };
        onChange([...words.slice(0, index), left, right, ...words.slice(index + 1)]);
      } else {
        const target = start === 0 ? index - 1 : index + 1;
        if (refs.current[target]) {
          pending.current = { index: target, caret: start === 0 ? words[target].text.length : 0 };
          onSelect(target);
        }
      }
    } else if (event.key === 'ArrowLeft' && start === 0 && end === 0 && index > 0) {
      event.preventDefault();
      pending.current = { index: index - 1, caret: words[index - 1].text.length };
      onSelect(index - 1);
    } else if (event.key === 'ArrowRight' && start === word.text.length && end === start && index < words.length - 1) {
      event.preventDefault();
      pending.current = { index: index + 1, caret: 0 };
      onSelect(index + 1);
    }
  };

  return <div className={styles.flow} data-testid="cc-wordflow">
    {words.map((word, i) => {
      const active = time >= word.start + offset && time < word.end + offset;
      return <span key={word.id} className={styles.flowItem}>
        {word.breakBefore && <button type="button" className={styles.breakMark} title="Caption break. Click to remove" onClick={() => update(i, { breakBefore: false })}>↵</button>}
        <input
          ref={(el) => { refs.current[i] = el; }}
          className={styles.chip}
          data-active={active || undefined}
          data-selected={i === selected || undefined}
          data-level={levels[i] || 0}
          data-hidden={word.hidden || undefined}
          value={word.text}
          size={Math.max(1, word.text.length)}
          spellCheck
          aria-label={`Word ${i + 1}`}
          onFocus={() => onSelect(i)}
          onChange={(event) => {
            const value = event.target.value;
            if (/\s/.test(value.trim())) onChange(setWordText(words, i, value));
            else update(i, { text: value.trim() });
          }}
          onBlur={() => { if (!words[i]?.text) onChange(deleteWord(words, i)); }}
          onKeyDown={(event) => key(event, i)}
        />
      </span>;
    })}
  </div>;
}
