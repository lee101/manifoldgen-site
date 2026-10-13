import { PoseStudio } from '../lib/pose-studio';
import { mountPoseStudioUI, type PoseStudioUIOptions } from '../lib/pose-studio/ui-dom';

const app = {
  mount(el: HTMLElement, options: PoseStudioUIOptions = {}) {
    return mountPoseStudioUI(el, options);
  },
  PoseStudio,
  version: '1.0.0',
};
(window as unknown as { PoseStudioApp: typeof app }).PoseStudioApp = app;
