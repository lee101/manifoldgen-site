export type StudioTextStyle = {
  content: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: 400 | 600 | 800;
  color: string;
  align: 'left' | 'center' | 'right';
};

export const STUDIO_FONTS = [
  { name: 'DM Sans', category: 'Clean sans', stack: 'var(--font-body), sans-serif' },
  { name: 'Space Grotesk', category: 'Modern sans', stack: 'var(--font-space-grotesk), sans-serif' },
  { name: 'Syne', category: 'Display', stack: 'var(--font-display), sans-serif' },
  { name: 'Bebas Neue', category: 'Condensed display', stack: 'var(--font-bebas), Impact, sans-serif' },
  { name: 'Playfair Display', category: 'Editorial serif', stack: 'var(--font-playfair), Georgia, serif' },
  { name: 'Cormorant Garamond', category: 'Elegant serif', stack: 'var(--font-cormorant), Georgia, serif' },
  { name: 'IBM Plex Mono', category: 'Modern mono', stack: 'var(--font-ibm-plex-mono), monospace' },
  { name: 'Inter', category: 'Modern sans', stack: 'Inter, var(--font-body), sans-serif' },
  { name: 'Arial', category: 'Clean sans', stack: 'Arial, Helvetica, sans-serif' },
  { name: 'Trebuchet MS', category: 'Humanist sans', stack: '"Trebuchet MS", Arial, sans-serif' },
  { name: 'Verdana', category: 'Clean sans', stack: 'Verdana, Geneva, sans-serif' },
  { name: 'Impact', category: 'Bold display', stack: 'Impact, Haettenschweiler, sans-serif' },
  { name: 'Georgia', category: 'Editorial serif', stack: 'Georgia, "Times New Roman", serif' },
  { name: 'Times New Roman', category: 'Classic serif', stack: '"Times New Roman", Times, serif' },
  { name: 'Courier New', category: 'Monospace', stack: '"Courier New", Courier, monospace' },
] as const;

export const TEXT_CANVAS = { width: 1920, height: 1080 } as const;

export function studioFontStack(name: string) {
  const configured = STUDIO_FONTS.find((font) => font.name === name)?.stack;
  if (!configured) return `${JSON.stringify(name)}, sans-serif`;
  if (typeof window === 'undefined' || !configured.includes('var(')) return configured;
  return configured.replace(/var\((--[^)]+)\)/g, (_, variable: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || 'sans-serif');
}

export function textFileName(content: string) {
  const stem = content.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 42) || 'text';
  return `${stem}.png`;
}

export async function renderTextFile(style: StudioTextStyle) {
  const canvas = document.createElement('canvas');
  canvas.width = TEXT_CANVAS.width;
  canvas.height = TEXT_CANVAS.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Text rendering is unavailable');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = style.color;
  context.textAlign = style.align;
  context.textBaseline = 'middle';
  const fontStack = studioFontStack(style.fontFamily);
  await document.fonts?.load(`${style.fontWeight} ${style.fontSize}px ${fontStack}`).catch(() => undefined);
  context.font = `${style.fontWeight} ${style.fontSize}px ${fontStack}`;
  const maxWidth = 1600;
  const words = style.content.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
    else line = candidate;
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, 8);
  const lineHeight = style.fontSize * 1.18;
  const startY = canvas.height / 2 - (visible.length - 1) * lineHeight / 2;
  const x = style.align === 'left' ? 160 : style.align === 'right' ? canvas.width - 160 : canvas.width / 2;
  visible.forEach((value, index) => context.fillText(value, x, startY + index * lineHeight, maxWidth));
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not render text')), 'image/png'));
  return new File([blob], textFileName(style.content), { type: 'image/png' });
}
