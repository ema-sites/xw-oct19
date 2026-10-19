/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-game-tile.
 * Source: https://www.alc.ca/content/alc/en.html
 * Base block: cards
 *
 * Source DOM:
 *   main.cmp-container--game-tiles > div.cmp-container > div.game-tile.parbase > article.game-tile
 *     div.game-tile-image-container  (tile image: inline background-image live, <img> in scrape)
 *       optional .jackpot-lottomax / .jackpot-lotto649 (.prize-bar, .max-plus-bar, .gold-ball img)
 *       optional .game-flag.new ("[new-en]" badge placeholder -> "NEW")
 *     div.game-tile-content
 *       h3.game-tile-title, .game-tile-description p, p.next-jackpot-date, p.next-jackpot-prize,
 *       a.button (CTA)
 *
 * Target (xwalk cards-game-tile-item model):
 *   one row per tile: [image (+ imageAlt) | text]
 *   text = optional lead p (badge / jackpot), h3, description, details, CTA p
 */
function bgUrl(el) {
  if (!el) return null;
  const style = el.getAttribute('style') || '';
  const m = /background(?:-image)?\s*:[^;]*url\(\s*(['"]?)(.*?)\1\s*\)/i.exec(style);
  return m ? m[2].replace(/&quot;/g, '') : null;
}

function clean(text) {
  return (text || '').replace(/[​-‍﻿]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

function para(document, text) {
  const p = document.createElement('p');
  p.textContent = text;
  return p;
}

export default function parse(element, { document }) {
  let tiles = Array.from(element.querySelectorAll('div.game-tile.parbase > article.game-tile'));
  if (!tiles.length) tiles = Array.from(element.querySelectorAll('article.game-tile'));

  const cells = [];

  tiles.forEach((tile) => {
    const media = tile.querySelector('.game-tile-image-container');
    const content = tile.querySelector('.game-tile-content') || tile;
    const titleEl = content.querySelector('.game-tile-title, h3');
    const title = clean(titleEl && titleEl.textContent);

    // Image cell
    const imageCell = document.createDocumentFragment();
    let img = null;
    if (media) {
      img = Array.from(media.children).find((c) => c.tagName === 'IMG' || c.tagName === 'PICTURE') || null;
      if (!img) {
        const src = bgUrl(media);
        if (src) {
          img = document.createElement('img');
          img.src = src;
        }
      }
    }
    if (img) {
      const realImg = img.tagName === 'PICTURE' ? img.querySelector('img') : img;
      if (realImg && !realImg.getAttribute('alt')) realImg.alt = title;
      imageCell.appendChild(document.createComment(' field:image '));
      imageCell.appendChild(img);
    }

    // Text cell
    const parts = [];

    if (media) {
      // Lead paragraph: NEW badge or jackpot band
      const flag = media.querySelector('.game-flag');
      const jackpot = media.querySelector('[class*="jackpot-"]');
      if (flag) {
        const raw = clean(flag.textContent);
        const label = /new/i.test(raw) || flag.classList.contains('new') ? 'NEW' : raw.replace(/^\[|\]$/g, '').replace(/-en$/i, '').toUpperCase();
        if (label) parts.push(para(document, label));
      } else if (jackpot) {
        const prizeBar = jackpot.querySelector('.prize-bar');
        const bits = [];
        if (prizeBar) bits.push(clean(prizeBar.textContent));
        const extra = jackpot.querySelector('.max-plus-bar');
        if (extra) bits.push(clean(Array.from(extra.querySelectorAll('span')).map((s) => clean(s.textContent)).join(' ')));
        const text = bits.filter(Boolean).join(' ');
        const goldBall = jackpot.querySelector('.gold-ball img');
        if (text || goldBall) {
          const p = para(document, text);
          if (goldBall) {
            const gb = document.createElement('img');
            gb.src = goldBall.getAttribute('src');
            gb.alt = goldBall.getAttribute('alt') || 'Gold Ball Jackpot';
            p.appendChild(document.createTextNode(' '));
            p.appendChild(gb);
          }
          parts.push(p);
        }
      }
    }

    if (title) {
      const h3 = document.createElement('h3');
      h3.textContent = title;
      parts.push(h3);
    }

    content.querySelectorAll('.game-tile-description p').forEach((p) => {
      if (clean(p.textContent)) parts.push(p);
    });

    const date = content.querySelector('.next-jackpot-date');
    if (date && clean(date.textContent)) parts.push(para(document, clean(date.textContent)));
    const prize = content.querySelector('.next-jackpot-prize');
    if (prize && clean(prize.textContent)) parts.push(para(document, clean(prize.textContent)));
    content.querySelectorAll('.prize-info').forEach((p) => {
      if (clean(p.textContent)) parts.push(para(document, clean(p.textContent)));
    });

    const cta = Array.from(content.querySelectorAll('a.button[href]')).pop();
    if (cta) {
      const p = document.createElement('p');
      const link = document.createElement('a');
      link.href = cta.getAttribute('href');
      link.textContent = clean(cta.textContent) || clean(cta.getAttribute('title'));
      p.appendChild(link);
      parts.push(p);
    }

    const textCell = document.createDocumentFragment();
    if (parts.length) {
      textCell.appendChild(document.createComment(' field:text '));
      parts.forEach((el) => textCell.appendChild(el));
    }

    if (img || parts.length) {
      cells.push([imageCell, textCell]);
    }
  });

  const block = WebImporter.Blocks.createBlock(document, { name: 'cards-game-tile', cells });
  element.replaceWith(block);
}
