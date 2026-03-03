import type { EllysPlugin } from '@/core/plugin-types';
import { ViewTransitions } from './view-transitions';

const spaRouter: EllysPlugin = {
  name: 'spa-router',
  description: 'SPA navigation with view transitions and prefetching',
  loadStrategy: 'eager',

  async init(ctx) {
    new ViewTransitions(() => {
      ctx.emit('navigate');
      window.dispatchEvent(new CustomEvent('ellyseum:navigate'));
    });
  },
};

export default spaRouter;
