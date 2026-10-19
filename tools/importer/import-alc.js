/* eslint-disable */
/* global WebImporter */

import carouselHeroParser from './parsers/carousel-hero.js';
import carouselWinnersParser from './parsers/carousel-winners.js';
import cardsGameTileParser from './parsers/cards-game-tile.js';
import alcCleanupTransformer from './transformers/alc-cleanup.js';
import alcSectionsTransformer from './transformers/alc-sections.js';

const PAGE_TEMPLATE = {
  "name": "alc",
  "urls": [
    "https://www.alc.ca/content/alc/en.html"
  ],
  "representativeUrl": "https://www.alc.ca/content/alc/en.html",
  "description": "ALC home page: hero promo carousel, recent winners slider, featured game tiles with promo rail",
  "urlPattern": "/content/alc/*",
  "blocks": [
    {
      "name": "carousel-hero",
      "instances": [
        "div.carousel.list.parbase.hero",
        ".alc-carousel"
      ]
    },
    {
      "name": "carousel-winners",
      "instances": [
        ".winners-carousel",
        ".winners_carousel"
      ]
    },
    {
      "name": "cards-game-tile",
      "instances": [
        ".cmp-container--game-tiles"
      ]
    }
  ],
  "sections": [
    {
      "id": "section-1",
      "name": "Hero promo carousel",
      "selector": [
        "div.carousel.list.parbase.hero"
      ],
      "style": null,
      "blocks": [
        "carousel-hero"
      ],
      "defaultContent": []
    },
    {
      "id": "section-2",
      "name": "Recent winners",
      "selector": [
        ".cmp-section-header--alc-blue"
      ],
      "style": "heading-band-blue",
      "blocks": [
        "carousel-winners"
      ],
      "defaultContent": [
        ".cmp-section-header--alc-blue h2.cmp-section-header__title"
      ]
    },
    {
      "id": "section-3",
      "name": "Featured games and promotions",
      "selector": [
        ".cmp-section-header--alc-green"
      ],
      "style": "heading-band-green, split",
      "blocks": [
        "cards-game-tile"
      ],
      "defaultContent": [
        ".cmp-section-header--alc-green h2.cmp-section-header__title",
        ".cmp-container--hide-column-gutters .cmp-image"
      ]
    }
  ]
};

const parsers = {
  'carousel-hero': carouselHeroParser,
  'carousel-winners': carouselWinnersParser,
  'cards-game-tile': cardsGameTileParser,
};
const transformers = [alcCleanupTransformer, alcSectionsTransformer];

function executeTransformers(hookName, element, payload) {
  const enhancedPayload = { ...payload, template: PAGE_TEMPLATE };
  transformers.forEach((fn) => {
    try { fn(hookName, element, enhancedPayload); }
    catch (e) { console.error(`Transformer failed at ${hookName}:`, e); }
  });
}

function findBlocksOnPage(document, template) {
  const pageBlocks = [];
  template.blocks.forEach((blockDef) => {
    blockDef.instances.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        pageBlocks.push({ name: blockDef.name, selector, element });
      });
    });
  });
  return pageBlocks;
}

export default {
  transform: (payload) => {
    const { document, url, params } = payload;
    const main = document.body;

    executeTransformers('beforeTransform', main, payload);

    const pageBlocks = findBlocksOnPage(document, PAGE_TEMPLATE);
    pageBlocks.forEach((block) => {
      // skip elements already replaced (or nested inside an element already parsed)
      if (!block.element.parentNode || !main.contains(block.element)) return;
      const parser = parsers[block.name];
      if (!parser) return;
      try { parser(block.element, { document, url, params }); }
      catch (e) { console.error(`Failed to parse ${block.name} (${block.selector}):`, e); }
    });

    executeTransformers('afterTransform', main, payload);

    main.appendChild(document.createElement('hr'));
    WebImporter.rules.createMetadata(main, document);
    WebImporter.rules.transformBackgroundImages(main, document);
    WebImporter.rules.adjustImageUrls(main, url, params.originalURL);

    const rawPath = new URL(params.originalURL).pathname
      .replace(/\/$/, '')
      .replace(/\.html?$/, '');
    const path = WebImporter.FileUtils.sanitizePath(rawPath === '' ? '/index' : rawPath);

    return [{
      element: main,
      path,
      report: { title: document.title, template: PAGE_TEMPLATE.name, blocks: [...new Set(pageBlocks.map((b) => b.name))] },
    }];
  },
};
