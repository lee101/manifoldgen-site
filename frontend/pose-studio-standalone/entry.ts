import { PoseStudio, sampleSpec, BODY_TYPES, BASE_IDS } from '../lib/pose-studio';
import { mountPoseStudioUI, type PoseStudioUIOptions } from '../lib/pose-studio/ui-dom';

const app = {
  mount(el: HTMLElement, options: PoseStudioUIOptions = {}) {
    return mountPoseStudioUI(el, options);
  },
  PoseStudio,
  sampleSpec,
  BODY_TYPES,
  BASE_IDS,
  version: '1.0.0',
};
(window as unknown as { PoseStudioApp: typeof app }).PoseStudioApp = app;
