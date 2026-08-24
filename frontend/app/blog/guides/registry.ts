import type { Guide, GuideSectionId } from './types';
import whyAiCharacterFaceChanges from './content/why-ai-character-face-changes';
import keepAiCharacterConsistent from './content/keep-ai-character-consistent';
import turnPhotoIntoConsistentAiPersona from './content/turn-photo-into-consistent-ai-persona';
import keepAiPersonaConsistent from './content/keep-ai-persona-consistent';
import createConsistentAiInfluencer from './content/create-consistent-ai-influencer';
import consistentCharactersAndLocations from './content/consistent-characters-and-locations-across-shots';
import soulIdExplained from './content/soul-id-explained';
import fromComfyuiToOneClick from './content/from-comfyui-to-one-click';
import filmmakingPrinciples from './content/filmmaking-principles-for-ai-shots';
import directingAiAgentsWell from './content/directing-ai-agents-well';
import makeMoneyWithAi from './content/make-money-with-ai';
import hundredCreativeAds from './content/100-creative-ads-without-a-team';
import aiUgcAds from './content/ai-ugc-ads-that-convert';
import facelessChannel10k from './content/faceless-youtube-channel-10k-month';
import recreate39500Channel from './content/recreate-39500-month-faceless-channel';
import automatedAiBusiness from './content/automated-ai-business';
import ecommerceProductPhotos from './content/ecommerce-product-photos-without-a-studio';

export type { Guide, GuideBlock, GuideSectionId } from './types';

export const guides: Guide[] = [
  whyAiCharacterFaceChanges,
  keepAiCharacterConsistent,
  turnPhotoIntoConsistentAiPersona,
  keepAiPersonaConsistent,
  createConsistentAiInfluencer,
  consistentCharactersAndLocations,
  soulIdExplained,
  fromComfyuiToOneClick,
  filmmakingPrinciples,
  directingAiAgentsWell,
  makeMoneyWithAi,
  hundredCreativeAds,
  aiUgcAds,
  facelessChannel10k,
  recreate39500Channel,
  automatedAiBusiness,
  ecommerceProductPhotos,
];

export const guideSections: { id: GuideSectionId; title: string; blurb: string }[] = [
  { id: 'money', title: 'Make money with AI', blurb: 'Playbooks that turn generation into income.' },
  { id: 'foundations', title: 'Foundations', blurb: 'Why faces drift, and the workflow that stops it.' },
  { id: 'personas', title: 'Personas & influencers', blurb: 'From a single photo to a repeatable on-camera identity.' },
  { id: 'continuity', title: 'Scenes & continuity', blurb: 'Characters and locations that hold across sequences.' },
  { id: 'craft', title: 'Craft & pipelines', blurb: 'Graph thinking, film grammar, and directing agents.' },
];

export function relatedGuides(guide: Guide, count = 3): Guide[] {
  const sameSection = guides.filter((g) => g.slug !== guide.slug && g.section === guide.section);
  const others = guides.filter((g) => g.slug !== guide.slug && g.section !== guide.section);
  return [...sameSection, ...others].slice(0, count);
}
