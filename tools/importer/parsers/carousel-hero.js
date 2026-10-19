/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-hero.
 * Source: https://www.alc.ca/content/alc/en.html
 * Base block: carousel
 *
 * Source DOM (div.carousel.list.parbase.hero > div.alc-carousel > ul.slides):
 *   li.slide > div.fca-carousel-slide-promo > article > a[href] > div.slide-content
 * On the live page the slide artwork is a CSS background on div.slide-content
 * (plus picturefill span[data-src] renditions); the cached scrape has an <img>.
 * Slides are image-only (artwork carries the message); countdown timers
 * (.next-draw-timer) and the controls bar are not authored.
 *
 * Target (xwalk carousel-hero-item model):
 *   one row per slide: [media_image (+ media_imageAlt) | content_text (CTA link)]
 */
function bgUrl(el) {
  if (!el) return null;
  const style = el.getAttribute('style') || '';
  const m = /background(?:-image)?\s*:[^;]*url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(style);
  return m ? m[2].replace(/&quot;/g, '') : null;
}

function slideImage(article, document) {
  const content = article.querySelector('.slide-content') || article;
  const existing = content.querySelector('picture, img');
  if (existing) return existing;
  // Prefer the desktop picturefill rendition, then the inline background.
  const spans = Array.from(content.querySelectorAll('span[data-src]'));
  const desktop = spans.find((s) => /1200/.test(s.getAttribute('data-media') || '')) || spans[spans.length - 1];
  const src = (desktop && desktop.getAttribute('data-src')) || bgUrl(content);
  if (!src) return null;
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  return img;
}

function ctaLabelFromHref(href) {
  // The slide anchor carries no visible text; derive a label from the
  // itm_content tracking param (e.g. "play-now-CTA" -> "Play now").
  const match = /[?&]itm_content=([^&#]+)/.exec(href || '');
  if (match) {
    const words = decodeURIComponent(match[1])
      .replace(/-?cta$/i, '')
      .split(/[-_]+/)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (words) return words.charAt(0).toUpperCase() + words.slice(1);
  }
  return 'Learn more';
}

export default function parse(element, { document }) {
  const root = element.querySelector('.alc-carousel') || element;
  let slides = Array.from(root.querySelectorAll('ul.slides > li.slide'));
  if (!slides.length) slides = Array.from(root.querySelectorAll('li.slide'));

  const cells = [];

  slides.forEach((slide) => {
    const article = slide.querySelector('article.fca-carousel-slide-promo') || slide;
    const img = slideImage(article, document);
    const anchor = article.querySelector('a[href]') || slide.querySelector('a[href]');

    // Image cell
    const imageCell = document.createDocumentFragment();
    if (img) {
      imageCell.appendChild(document.createComment(' field:media_image '));
      imageCell.appendChild(img);
    }

    // Text cell: rebuild the CTA link (source anchor has no visible text)
    const textCell = document.createDocumentFragment();
    if (anchor) {
      const href = anchor.getAttribute('href');
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = href;
      link.textContent = ctaLabelFromHref(href);
      p.appendChild(link);
      textCell.appendChild(document.createComment(' field:content_text '));
      textCell.appendChild(p);
    }

    if (img || anchor) {
      cells.push([imageCell, textCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-hero', cells });
  element.replaceWith(block);
}
