'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, placeholder, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import styles from './TranscriptEditor.module.css';

export type TranscriptEditorHandle = { insert: (text: string) => void; focus: () => void };

type TranscriptEditorProps = {
  value: string;
  onChange: (value: string) => void;
  voices: readonly string[];
  cues: readonly string[];
  multiSpeaker: boolean;
};

const HOT_CUES = /angry|anger|furious|rage|shout|urgency|urgent|fear|panic|command/i;
const SOFT_CUES = /whisper|gentle|calm|tender|sad|pensive|empathetic/i;
const BRIGHT_CUES = /happy|excited|joy|playful|laugh|determination|upbeat/i;
const SPEAKER_PALETTE = ['mg-speaker-one', 'mg-speaker-two', 'mg-speaker-three', 'mg-speaker-four', 'mg-speaker-five', 'mg-speaker-six'];

function speakerClass(name: string) {
  const numbered = /^speaker\s+(\d+)$/i.exec(name.trim());
  if (numbered) return SPEAKER_PALETTE[(Number(numbered[1]) - 1) % SPEAKER_PALETTE.length];
  let hash = 0;
  for (const character of name.toLowerCase()) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return SPEAKER_PALETTE[Math.abs(hash) % SPEAKER_PALETTE.length];
}

function scriptDecorations(view: EditorView, voices: readonly string[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const voicePattern = voices.length ? new RegExp(`\\b(?:${voices.join('|')})\\b`, 'gi') : null;

  for (const { from, to } of view.visibleRanges) {
    let position = from;
    while (position <= to) {
      const line = view.state.doc.lineAt(position);
      const text = line.text;
      const tokens: Array<{ from: number; to: number; className: string }> = [];
      const heading = /^(#{1,3})(\s+)(.*)$/.exec(text);
      const speaker = /^\s*([A-Za-z][A-Za-z0-9 .'-]{0,38})(:)/.exec(text);

      if (heading) {
        tokens.push({ from: line.from, to: line.from + heading[1].length, className: 'mg-markdown-mark' });
        if (heading[3]) tokens.push({ from: line.from + heading[1].length + heading[2].length, to: line.to, className: 'mg-markdown-heading' });
      } else if (speaker) {
        const nameStart = line.from + speaker[0].indexOf(speaker[1]);
        tokens.push({ from: nameStart, to: nameStart + speaker[1].length + 1, className: speakerClass(speaker[1]) });
      }

      const cuePattern = /\[[A-Za-z][A-Za-z0-9 _-]{0,30}\]/g;
      for (const match of text.matchAll(cuePattern)) {
        const cue = match[0];
        const className = HOT_CUES.test(cue) ? 'mg-cue-hot' : SOFT_CUES.test(cue) ? 'mg-cue-soft' : BRIGHT_CUES.test(cue) ? 'mg-cue-bright' : 'mg-cue-neutral';
        tokens.push({ from: line.from + (match.index ?? 0), to: line.from + (match.index ?? 0) + cue.length, className });
      }

      if (voicePattern) {
        voicePattern.lastIndex = 0;
        for (const match of text.matchAll(voicePattern)) {
          const start = line.from + (match.index ?? 0);
          if (!tokens.some((token) => start < token.to && start + match[0].length > token.from)) {
            tokens.push({ from: start, to: start + match[0].length, className: 'mg-voice-name' });
          }
        }
      }

      const boldPattern = /\*\*([^*\n]+)\*\*/g;
      for (const match of text.matchAll(boldPattern)) {
        const start = line.from + (match.index ?? 0);
        const end = start + match[0].length;
        if (!tokens.some((token) => start < token.to && end > token.from)) tokens.push({ from: start, to: end, className: 'mg-markdown-bold' });
      }

      tokens.sort((a, b) => a.from - b.from || a.to - b.to);
      for (const token of tokens) builder.add(token.from, token.to, Decoration.mark({ class: token.className }));
      if (line.to >= to || line.number === view.state.doc.lines) break;
      position = line.to + 1;
    }
  }
  return builder.finish();
}

function highlighting(voices: readonly string[]) {
  return ViewPlugin.fromClass(class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = scriptDecorations(view, voices); }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) this.decorations = scriptDecorations(update.view, voices);
    }
  }, { decorations: (plugin) => plugin.decorations });
}

function completionSource(voices: readonly string[], cues: readonly string[], multiSpeaker: boolean) {
  return (context: CompletionContext): CompletionResult | null => {
    const cue = context.matchBefore(/\[[A-Za-z0-9 _-]*$/);
    if (cue) return {
      from: cue.from,
      options: cues.map((label) => ({ label, type: 'keyword', detail: 'performance cue', apply: `${label} ` })),
      validFor: /^\[[A-Za-z0-9 _-]*$/,
    };

    const line = context.state.doc.lineAt(context.pos);
    const before = line.text.slice(0, context.pos - line.from);
    if (/^\s*[A-Za-z0-9 .'-]*$/.test(before)) {
      const found = new Set<string>();
      for (let number = 1; number <= context.state.doc.lines; number += 1) {
        const match = /^\s*([A-Za-z][A-Za-z0-9 .'-]{0,38}):/.exec(context.state.doc.line(number).text);
        if (match) found.add(match[1]);
      }
      const labels = multiSpeaker ? ['Speaker 1', 'Speaker 2', ...found] : ['Narrator', ...found];
      const firstCharacter = before.search(/[^\s]/);
      return {
        from: line.from + (firstCharacter < 0 ? before.length : firstCharacter),
        options: [...new Set(labels)].map((label, index) => ({ label: `${label}:`, type: 'class', detail: index < 2 ? 'cast member' : 'character', apply: `${label}: ` })),
      };
    }

    const word = context.matchBefore(/[A-Za-z][A-Za-z-]*$/);
    if (!word) return context.explicit ? { from: context.pos, options: voices.map((label) => ({ label, type: 'variable', detail: 'Gemini voice' })) } : null;
    const typed = context.state.sliceDoc(word.from, word.to).toLowerCase();
    if (!context.explicit && (typed.length < 2 || !voices.some((voice) => voice.toLowerCase().startsWith(typed)))) return null;
    return { from: word.from, options: voices.map((label) => ({ label, type: 'variable', detail: 'Gemini voice' })), validFor: /^[A-Za-z-]*$/ };
  };
}

const editorTheme = EditorView.theme({
  '&': { minHeight: '310px', backgroundColor: '#17191d', color: '#e7e9ec', fontSize: '13px' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { minHeight: '310px', fontFamily: 'var(--font-ibm-plex-mono), ui-monospace, monospace', lineHeight: '1.82' },
  '.cm-content': { padding: '15px 4px 22px', caretColor: '#f4f7f6' },
  '.cm-line': { padding: '0 13px' },
  '.cm-gutters': { backgroundColor: '#121417', color: '#6d747e', borderRight: '1px solid #2c3036' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: '#202329' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { backgroundColor: '#3a4d68 !important' },
  '.cm-cursor': { borderLeftColor: '#f4f7f6', borderLeftWidth: '2px' },
  '.cm-placeholder': { color: '#7d838c', fontStyle: 'italic' },
  '.cm-tooltip': { backgroundColor: '#202329', color: '#eef0f2', border: '1px solid #555c67', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 16px 42px rgba(0,0,0,.46)' },
  '.cm-tooltip-autocomplete > ul > li': { padding: '5px 10px' },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: '#35435d', color: '#fff' },
  '.cm-completionDetail': { color: '#b1b6bf', fontStyle: 'normal' },
  '.mg-speaker-one': { color: '#82b8ff', fontWeight: '750' },
  '.mg-speaker-two': { color: '#ffad82', fontWeight: '750' },
  '.mg-speaker-three': { color: '#b7e46c', fontWeight: '750' },
  '.mg-speaker-four': { color: '#d5a6ff', fontWeight: '750' },
  '.mg-speaker-five': { color: '#70dfce', fontWeight: '750' },
  '.mg-speaker-six': { color: '#f0cf70', fontWeight: '750' },
  '.mg-voice-name': { color: '#70d8ef', fontWeight: '700', textDecoration: 'underline', textDecorationColor: '#397886', textUnderlineOffset: '3px' },
  '.mg-cue-hot': { color: '#ff9aa5', backgroundColor: '#3c1f25', borderRadius: '4px', fontWeight: '700' },
  '.mg-cue-soft': { color: '#cfb7ff', backgroundColor: '#2c2540', borderRadius: '4px', fontWeight: '700' },
  '.mg-cue-bright': { color: '#ffda85', backgroundColor: '#3a3020', borderRadius: '4px', fontWeight: '700' },
  '.mg-cue-neutral': { color: '#99e2c7', backgroundColor: '#1d352f', borderRadius: '4px', fontWeight: '700' },
  '.mg-markdown-mark': { color: '#929aa6', fontWeight: '700' },
  '.mg-markdown-heading': { color: '#f1d083', fontWeight: '800' },
  '.mg-markdown-bold': { color: '#f3f4f6', fontWeight: '800' },
}, { dark: true });

const TranscriptEditor = forwardRef<TranscriptEditorHandle, TranscriptEditorProps>(function TranscriptEditor({ value, onChange, voices, cues, multiSpeaker }, ref) {
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  useImperativeHandle(ref, () => ({
    insert(text) {
      const view = viewRef.current;
      if (!view) return;
      const { from, to } = view.state.selection.main;
      const spacer = from > 0 && !/\s/.test(view.state.sliceDoc(from - 1, from)) ? ' ' : '';
      const insert = `${spacer}${text} `;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, scrollIntoView: true });
      view.focus();
    },
    focus() { viewRef.current?.focus(); },
  }), []);

  useEffect(() => {
    if (!parentRef.current) return;
    const view = new EditorView({
      parent: parentRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          editorTheme,
          highlighting(voices),
          placeholder('Speaker 1: [caution] Begin the scene…'),
          autocompletion({ override: [completionSource(voices, cues, multiSpeaker)], activateOnTyping: true, maxRenderedOptions: 40 }),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({ 'aria-label': 'Voice transcript editor', 'data-testid': 'gemini-transcript-input', spellcheck: 'true' }),
          EditorView.updateListener.of((update) => { if (update.docChanged) changeRef.current(update.state.doc.toString()); }),
        ],
      }),
    });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
  }, [cues, multiSpeaker, voices]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  }, [value]);

  return <div className={styles.field}>
    <div className={styles.label}><span>Transcript · {value.length} characters</span><span>Ctrl / ⌘ Space · autocomplete</span></div>
    <div ref={parentRef} className={styles.shell} data-testid="gemini-transcript" />
    <div className={styles.legend}><span className={styles.speaker1}>Speaker 1</span><span className={styles.speaker2}>Speaker 2</span><span className={styles.voice}>Voice name</span><span className={styles.cue}>[emotion]</span></div>
  </div>;
});

export default TranscriptEditor;
