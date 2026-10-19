import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/*
 * cards-game-tile: game/promo tiles with image on top.
 * Authoring: one row per card -> [image | text].
 * Text cell (in order): optional lead paragraph before the heading, heading
 * (title), description, optional draw details, CTA link (last paragraph).
 * A short text-only lead paragraph (e.g. "NEW") becomes a corner badge; any
 * other lead paragraph (e.g. jackpot amount) becomes a band over the bottom of
 * the image.
 */

const PREFIX = 'cards-game-tile';

function isLinkOnly(el) {
  const links = [...el.querySelectorAll('a')];
  if (!links.length || el.querySelector('picture, img')) return false;
  const linkText = links.map((a) => a.textContent).join('').replace(/\s+/g, '');
  return el.textContent.replace(/\s+/g, '') === linkText;
}

function isBadge(el) {
  const text = el.textContent.trim();
  return !el.querySelector('picture, img, a') && text.length > 0 && text.length <= 12 && !/\d/.test(text);
}

/*
 * Jackpot band: "$90,000,000 est. x $100,000" -> amount (navy/yellow) +
 * diagonal divider + extra (royal blue). Text-only bands only.
 */
function decorateBand(el) {
  if (el.children.length) return;
  const match = el.textContent.trim().match(/^(\S*?\$[\d,.]+)(\s+est\.?)?\s*(.*)$/i);
  if (!match) return;
  const [, amount, est, extra] = match;
  const amountEl = document.createElement('span');
  amountEl.className = `${PREFIX}-band-amount`;
  amountEl.textContent = amount;
  if (est) {
    const estEl = document.createElement('small');
    estEl.className = `${PREFIX}-band-est`;
    estEl.textContent = est.trim();
    amountEl.append(estEl);
  }
  const decor = document.createElement('span');
  decor.className = `${PREFIX}-band-decor`;
  decor.setAttribute('aria-hidden', 'true');
  const extraEl = document.createElement('span');
  extraEl.className = `${PREFIX}-band-extra`;
  extraEl.textContent = extra;
  el.replaceChildren(amountEl, decor, extraEl);
}

function decorateBody(body, imageWrap) {
  const children = [...body.children];
  const headingIdx = children.findIndex((el) => /^H[1-6]$/.test(el.tagName));

  // lead paragraphs before the heading -> badge or jackpot band on the image
  if (headingIdx > 0) {
    children.slice(0, headingIdx).forEach((el) => {
      if (isBadge(el)) {
        el.classList.add(`${PREFIX}-badge`);
      } else {
        el.classList.add(`${PREFIX}-band`);
        decorateBand(el);
      }
      if (imageWrap) imageWrap.append(el);
    });
  }

  const heading = children[headingIdx];
  if (heading) heading.classList.add(`${PREFIX}-title`);

  // trailing link-only paragraph -> CTA
  const remaining = [...body.children];
  const last = remaining[remaining.length - 1];
  if (last && last !== heading && isLinkOnly(last)) {
    last.classList.add(`${PREFIX}-cta`);
  }

  // paragraphs after the heading: first = description, the rest = draw details
  const kids = [...body.children];
  const start = heading ? kids.indexOf(heading) + 1 : 0;
  const texts = kids.slice(start).filter((el) => el.tagName === 'P'
    && !el.classList.contains(`${PREFIX}-cta`));
  texts.forEach((el, i) => el.classList.add(i ? `${PREFIX}-details` : `${PREFIX}-description`));
}

export default function decorate(block) {
  const ul = document.createElement('ul');
  [...block.children].forEach((row) => {
    const li = document.createElement('li');
    li.className = `${PREFIX}-card`;
    moveInstrumentation(row, li);
    while (row.firstElementChild) li.append(row.firstElementChild);

    let imageWrap;
    let body;
    [...li.children].forEach((div) => {
      const onlyImage = div.querySelector('picture') && !div.textContent.trim();
      if (onlyImage && !imageWrap) {
        div.className = `${PREFIX}-image`;
        imageWrap = div;
      } else {
        div.className = `${PREFIX}-body`;
        body = body || div;
      }
    });
    if (body) decorateBody(body, imageWrap);
    ul.append(li);
  });

  ul.querySelectorAll(`.${PREFIX}-image > picture > img, .${PREFIX}-image > p > picture > img`).forEach((img) => {
    const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]);
    moveInstrumentation(img, optimized.querySelector('img'));
    img.closest('picture').replaceWith(optimized);
  });

  block.replaceChildren(ul);
}
