export const RESIZE_PRESETS = [
  { size: '1024x1024', label: 'Square' },
  { size: '1080x1920', label: 'Story / vertical' },
  { size: '1920x1080', label: 'Widescreen' },
  { size: '1080x1350', label: 'Portrait post' },
  { size: '1200x630', label: 'Social preview' },
] as const;

export function validResizeSize(size: string): boolean {
  return /^[1-9]\d*x[1-9]\d*$/.test(size) && size.split('x').every((part) => Number(part) >= 64 && Number(part) <= 2048);
}

export function resizePrice(sizeCount: number): number {
  return Math.round((0.06 + 0.18 * sizeCount) * 100) / 100;
}

export function utilityImageURLs(data: Record<string, unknown>): string[] {
  const result = data.result as { data?: { url?: string }[] } | undefined;
  const original = (result?.data || []).map((row) => row.url).filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url));
  const saved = Array.isArray(data.saved_image_urls) ? data.saved_image_urls : [];
  return original.map((url, index) => saved.length === original.length && typeof saved[index] === 'string' && /^https?:\/\//.test(saved[index] as string) ? saved[index] as string : url);
}
