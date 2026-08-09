export type H3Aspect = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
export type H3Size = 'preview' | 'balanced' | 'native';

type ImageGenerationResponse = {
  saved_image_url?: string;
  saved_image?: { file_path?: string };
  result?: {
    image_url?: string;
    images?: Array<{ image_url?: string }>;
    gallery_image?: { file_path?: string };
  };
};

const NATIVE_DIMENSIONS: Record<H3Aspect, readonly [number, number]> = {
  '16:9': [1344, 768],
  '9:16': [768, 1344],
  '1:1': [768, 768],
  '4:3': [1024, 768],
  '3:4': [768, 1024],
  '21:9': [1344, 576],
};

const SIZE_AREA_SCALE: Record<H3Size, number> = {
  preview: 0.58,
  balanced: 0.78,
  native: 1,
};

// Keep this in lockstep with lee101/h3-cog's dimensions() function. H3 scales
// pixel area, then rounds each edge to the model's required 32px grid.
export function h3Dimensions(aspect: H3Aspect, size: H3Size): readonly [number, number] {
  const [nativeWidth, nativeHeight] = NATIVE_DIMENSIONS[aspect];
  const linearScale = Math.sqrt(SIZE_AREA_SCALE[size]);
  const align = (value: number) => Math.max(32, Math.round((value * linearScale) / 32) * 32);
  return [align(nativeWidth), align(nativeHeight)];
}

function publicURL(value: string, origin: string): string {
  return new URL(value, `${origin.replace(/\/$/, '')}/`).href;
}

export function loopAnchorURL(data: ImageGenerationResponse, origin: string): string {
  const savedPath = data.saved_image?.file_path || data.result?.gallery_image?.file_path;
  const candidate =
    data.saved_image_url ||
    (savedPath ? `/images/${savedPath.replace(/^\/+/, '')}` : '') ||
    data.result?.image_url ||
    data.result?.images?.find((image) => image.image_url)?.image_url ||
    '';
  if (!candidate) {
    throw new Error('Loop keyframe was generated but no public image URL was returned');
  }
  const url = publicURL(candidate, origin);
  if (!/^https?:$/.test(new URL(url).protocol)) {
    throw new Error('Loop keyframe URL must use HTTP or HTTPS');
  }
  return url;
}
