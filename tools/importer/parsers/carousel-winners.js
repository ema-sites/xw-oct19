/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-winners.
 * Source: https://www.alc.ca/content/alc/en.html
 * Base block: carousel
 *
 * Source DOM (slick slider):
 *   div.winners-carousel > .carousel-inner-container > .slick-slider > .slick-list > .slick-track
 *     > div.slick-slide (skip .slick-cloned) > div > div.slide
 *       .winner-image (portrait as inline background-image)
 *       .winner-info > h3 (name), span.h2 (location), a.all-winners (CTA)
 *       .prize-details > p.game-title (img.winning-game-logo + span "Winner"),
 *                        p.prize-amount (digit groups in spans)
 *
 * Target (xwalk carousel-winners-item model):
 *   one row per slide: [media_image (+ media_imageAlt) | content_text]
 */
function bgUrl(el) {
  if (!el) return null;
  const style = el.getAttribute('style') || '';
  const m = /background(?:-image)?\s*:[^;]*url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(style);
  return m ? m[2].replace(/&quot;/g, '') : null;
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

export default function parse(element, { document }) {
  let slides = Array.from(element.querySelectorAll('.slick-track > .slick-slide:not(.slick-cloned)'));
  if (!slides.length) {
    // Un-initialised slider fallback: slides are direct .slide containers
    slides = Array.from(element.querySelectorAll('.slide')).filter((s) => !s.closest('.slick-cloned'));
  }

  const cells = [];

  slides.forEach((slideWrap) => {
    const slide = slideWrap.querySelector('.slide') || slideWrap;
    const name = clean(slide.querySelector('.winner-info h3, h3') && slide.querySelector('.winner-info h3, h3').textContent);

    // Portrait image cell
    const imageCell = document.createDocumentFragment();
    const portraitEl = slide.querySelector('.winner-image');
    let portrait = portraitEl ? portraitEl.querySelector('img') : null;
    if (!portrait) {
      const src = bgUrl(portraitEl);
      if (src) {
        portrait = document.createElement('img');
        portrait.src = src;
      }
    }
    if (portrait) {
      portrait.alt = portrait.getAttribute('alt') || name;
      imageCell.appendChild(document.createComment(' field:media_image '));
      imageCell.appendChild(portrait);
    }

    // Text cell
    const textCell = document.createDocumentFragment();
    const parts = [];

    if (name) {
      const h3 = document.createElement('h3');
      h3.textContent = name;
      parts.push(h3);
    }

    const location = slide.querySelector('.winner-info .h2');
    if (location && clean(location.textContent)) {
      const p = document.createElement('p');
      p.textContent = clean(location.textContent);
      parts.push(p);
    }

    // Game logo cell (own reference field; images inside richtext don't map to JCR)
    const logoCell = document.createDocumentFragment();
    const gameTitle = slide.querySelector('.prize-details .game-title');
    if (gameTitle) {
      const p = document.createElement('p');
      const logo = gameTitle.querySelector('img');
      if (logo) {
        const img = document.createElement('img');
        img.src = logo.getAttribute('src');
        img.alt = logo.getAttribute('alt') || 'game logo';
        logoCell.appendChild(document.createComment(' field:logo '));
        logoCell.appendChild(img);
      }
      const ribbon = gameTitle.querySelector('.winning-game-ribbon');
      p.appendChild(document.createTextNode(clean(ribbon ? ribbon.textContent : 'Winner')));
      parts.push(p);
    }

    const prize = slide.querySelector('.prize-details .prize-amount');
    if (prize) {
      // digit groups are split across spans (and the "$" is CSS-generated), so rebuild
      const digits = clean(prize.textContent).replace(/[^\d]/g, '');
      const amount = digits
        ? `$${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
        : clean(prize.textContent);
      if (amount) {
        const p = document.createElement('p');
        p.textContent = amount;
        parts.push(p);
      }
    }

    const cta = slide.querySelector('.winner-info a[href], a.all-winners');
    if (cta) {
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = cta.getAttribute('href').replace(/\.html\.html/, '.html');
      link.textContent = clean(cta.textContent) || 'See all winners';
      p.appendChild(link);
      parts.push(p);
    }

    if (parts.length) {
      textCell.appendChild(document.createComment(' field:content_text '));
      parts.forEach((el) => textCell.appendChild(el));
    }

    if (portrait || parts.length) {
      cells.push([imageCell, textCell, logoCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'carousel-winners', cells });
  element.replaceWith(block);
}
