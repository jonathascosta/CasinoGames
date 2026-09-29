import { h } from '@casinogames/ui';
import type { Page, Router } from '../router/router.ts';
import type { Services } from '../services.ts';
import { brand, createTopBar } from '../shell/topbar.ts';
import { siteFooter } from './lobby.ts';
import './lobby.css';

export function notFoundPage(services: Services, router: Router): Page {
  return {
    title: 'Table not found',
    mount(outlet) {
      const topbar = createTopBar(services, brand(router.href('/')));
      outlet.append(
        h(
          'div',
          { class: 'lobby' },
          topbar.element,
          h(
            'section',
            { class: 'hero' },
            h('span', { class: 'cg-eyebrow' }, 'Error 404'),
            h('h1', { class: 'hero__title' }, 'No table here'),
            h('p', { class: 'hero__text' }, 'The address does not match any table in this demo.'),
            h(
              'a',
              { class: 'cg-btn cg-btn--primary', href: router.href('/') },
              'Back to the lobby',
            ),
          ),
          siteFooter(),
        ),
      );
      return () => {
        topbar.destroy();
      };
    },
  };
}
