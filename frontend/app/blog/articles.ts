export type BlogMediaItem = {
  kind: 'video' | 'image';
  src: string;
  poster?: string;
  aspect?: '16:9' | '9:16' | '1:1';
  seconds?: number;
  caption?: string;
};

export type BlogExample = {
  label?: string;
  prompt: string;
  input?: BlogMediaItem;
  media: BlogMediaItem[];
  note?: string;
};

export type BlogBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'list'; items: string[]; ordered?: boolean }
  | { type: 'code'; text: string }
  | { type: 'callout'; title: string; text: string }
  | { type: 'table'; head: string[]; rows: string[][] }
  | { type: 'links'; items: { label: string; href: string }[] }
  | { type: 'example'; example: BlogExample }

export type BlogArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
  ogImage: string;
  blocks: BlogBlock[];
};

import { howToMakeAiVideoFromScript } from './content/how-to-make-ai-video-from-script';
import { howToMakeAiVideoLookReal } from './content/how-to-make-ai-video-look-real';
import { aiContentForTiktok } from './content/ai-content-for-tiktok';
import { documentaryVideosWithAi } from './content/documentary-videos-with-ai';
import { turnPhotoIntoAiVideo } from './content/turn-photo-into-ai-video';
import { aiProductVideosWithoutAStudio } from './content/ai-product-videos-without-a-studio';
import { startFacelessChannelWithAi } from './content/start-faceless-channel-with-ai';
import { consistentCharactersAndLocations } from './content/consistent-characters-and-locations';
import { cameraMovementAnglesAndLenses } from './content/camera-movement-angles-and-lenses';
import { cutedslLatentTeleportation } from './content/cutedsl-latent-teleportation-faster-generation';
import { promptingVideoMotionCameraLanguage } from './content/prompting-video-motion-camera-language';
import { promptingImagesCompositionLight } from './content/prompting-images-composition-light';
import { bestAiVideoGeneratorsTested2026 } from './content/best-ai-video-generators-tested-2026';
import { mostReliableAiVideoGenerators2026 } from './content/most-reliable-ai-video-generators-2026';
import { bestAiPrevizToolsForFilmmakers } from './content/best-ai-previz-tools-filmmakers';
import { seedanceKlingVeoComparison } from './content/seedance-vs-kling-vs-veo';
import { bestAiVideoModelForAnime } from './content/best-ai-video-model-for-anime';
import { bestAiVideoModelForProductAds } from './content/best-ai-video-model-for-product-ads';
import { aiVideoApiCostGuide } from './content/ai-video-api-cost-guide-2026';
import { howToUseKling3 } from './content/how-to-use-kling-3';
import { howToUseKling26 } from './content/how-to-use-kling-2-6';
import { howToUseVeo31 } from './content/how-to-use-veo-3-1';
import { howToUseSeedance25 } from './content/how-to-use-seedance-2-5';
import { howToUseSeedance4k } from './content/how-to-use-seedance-4k';
import { h3ShortFilmsEmberHollowOrbit } from './content/h3-short-films-ember-hollow-orbit';
import { h3ControlVideoStyleTransfer } from './content/h3-control-video-style-transfer';

export const articles: BlogArticle[] = [
  h3ControlVideoStyleTransfer,
  h3ShortFilmsEmberHollowOrbit,
  seedanceKlingVeoComparison,
  bestAiVideoModelForAnime,
  bestAiVideoModelForProductAds,
  aiVideoApiCostGuide,
  howToUseKling3,
  howToUseKling26,
  howToUseVeo31,
  howToUseSeedance25,
  howToUseSeedance4k,
  aiContentForTiktok,
  documentaryVideosWithAi,
  turnPhotoIntoAiVideo,
  aiProductVideosWithoutAStudio,
  bestAiVideoGeneratorsTested2026,
  mostReliableAiVideoGenerators2026,
  bestAiPrevizToolsForFilmmakers,
  howToMakeAiVideoFromScript,
  howToMakeAiVideoLookReal,
  aiContentForTiktok,
  startFacelessChannelWithAi,
  consistentCharactersAndLocations,
  cameraMovementAnglesAndLenses,
  cutedslLatentTeleportation,
  promptingVideoMotionCameraLanguage,
  promptingImagesCompositionLight,
];

export function articleBySlug(slug: string) {
  return articles.find((article) => article.slug === slug);
}
