import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';

/*
 * carousel-winners: one winner per slide.
 * Authoring: one row per slide -> [portrait image | text | game logo image].
 * Text cell: heading (winner name), location paragraph, "Winner" label
 * paragraph, the prize amount paragraph and a CTA link.
 * Decoration splits the text cell into an "info" group (name, location, CTA)
 * and a "prize" group (game logo + label, amount).
 */

const PREFIX = 'carousel-winners';
const AMOUNT_RE = /^[$€£]?\s?\d[\d,.\s]*(?:\$)?$/;
const LABEL_RE = /^winner/i;

function isLinkOnly(el) {
  const links = [...el.querySelectorAll('a')];
  if (!links.length || el.querySelector('picture, img')) return false;
  const linkText = links.map((a) => a.textContent).join('').replace(/\s+/g, '');
  return el.textContent.replace(/\s+/g, '') === linkText;
}

/*
 * Split a prize amount ("$500,000") into digit groups rendered as separate
 * boxes. The original text stays available to assistive technology.
 */
function splitAmount(el) {
  const text = el.textContent.trim();
  const match = text.match(/^([$€£]?)\s?([\d,\s]+?)\s?(\$?)$/);
  if (!match) return;
  const currency = match[1] || match[3];
  const groups = match[2].split(/[,\s]+/).filter(Boolean);
  if (!groups.length) return;

  const label = document.createElement('span');
  label.className = `${PREFIX}-amount-label`;
  label.textContent = text;
  const digits = document.createElement('span');
  digits.className = `${PREFIX}-amount-digits`;
  digits.setAttribute('aria-hidden', 'true');
  groups.forEach((group, idx) => {
    const box = document.createElement('span');
    box.className = `${PREFIX}-amount-group`;
    if (idx === 0 && currency) {
      const symbol = document.createElement('span');
      symbol.className = `${PREFIX}-amount-currency`;
      symbol.textContent = currency;
      box.append(symbol);
    }
    box.append(group);
    digits.append(box);
  });
  el.replaceChildren(label, digits);
}

function buildContent(cell, logo) {
  const info = document.createElement('div');
  info.className = `${PREFIX}-info`;
  const prize = document.createElement('div');
  prize.className = `${PREFIX}-prize`;

  let inPrize = false;
  [...cell.children].forEach((el) => {
    const text = el.textContent.trim();
    if (isLinkOnly(el)) {
      el.classList.add(`${PREFIX}-cta`);
      info.append(el);
      return;
    }
    if (el.querySelector('picture, img') || LABEL_RE.test(text)) {
      inPrize = true;
      el.classList.add(`${PREFIX}-game`);
      if (logo && !el.querySelector('picture, img')) el.prepend(logo, ' ');
      prize.append(el);
      return;
    }
    if (AMOUNT_RE.test(text)) {
      inPrize = true;
      el.classList.add(`${PREFIX}-amount`);
      splitAmount(el);
      prize.append(el);
      return;
    }
    if (/^h[1-6]$/i.test(el.tagName)) {
      el.classList.add(`${PREFIX}-name`);
      info.append(el);
      return;
    }
    if (inPrize) {
      el.classList.add(`${PREFIX}-label`);
      prize.append(el);
    } else {
      if (!info.querySelector(`.${PREFIX}-location`) && info.querySelector(`.${PREFIX}-name`)) {
        el.classList.add(`${PREFIX}-location`);
      }
      info.append(el);
    }
  });

  cell.replaceChildren(info);
  if (prize.children.length) cell.append(prize);
}

function updateActiveSlide(block, slideIndex) {
  block.dataset.activeSlide = slideIndex;
  block.querySelectorAll(`.${PREFIX}-slide`).forEach((slide, idx) => {
    const active = idx === slideIndex;
    slide.setAttribute('aria-hidden', !active);
    slide.querySelectorAll('a').forEach((link) => {
      if (active) link.removeAttribute('tabindex');
      else link.setAttribute('tabindex', '-1');
    });
  });
  block.querySelectorAll(`.${PREFIX}-indicator button`).forEach((button, idx) => {
    if (idx === slideIndex) {
      button.setAttribute('disabled', 'true');
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-current');
    }
  });
}

function showSlide(block, slideIndex, behavior = 'smooth') {
  const slides = block.querySelectorAll(`.${PREFIX}-slide`);
  if (!slides.length) return;
  let index = slideIndex;
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  block.querySelector(`.${PREFIX}-slides`).scrollTo({ top: 0, left: slides[index].offsetLeft, behavior });
}

function bindEvents(block) {
  block.querySelectorAll(`.${PREFIX}-indicator button`).forEach((button) => {
    button.addEventListener('click', (e) => {
      showSlide(block, parseInt(e.currentTarget.parentElement.dataset.targetSlide, 10));
    });
  });
  block.querySelector(`.${PREFIX}-prev`).addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide || '0', 10) - 1);
  });
  block.querySelector(`.${PREFIX}-next`).addEventListener('click', () => {
    showSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        updateActiveSlide(block, parseInt(entry.target.dataset.slideIndex, 10));
      }
    });
  }, { threshold: 0.5 });
  block.querySelectorAll(`.${PREFIX}-slide`).forEach((slide) => observer.observe(slide));
}

function createSlide(row, idx, id) {
  const slide = document.createElement('li');
  slide.className = `${PREFIX}-slide`;
  slide.dataset.slideIndex = idx;
  slide.id = `${PREFIX}-${id}-slide-${idx}`;
  moveInstrumentation(row, slide);

  const cells = [...row.children];
  // image-only cells: the first is the portrait, the next one the game logo
  const imageCells = cells.filter((c) => c.querySelector('picture, img') && !c.textContent.trim());
  const [imageCell, logoCell] = imageCells;
  const logo = logoCell ? logoCell.querySelector('picture') || logoCell.querySelector('img') : null;
  cells.forEach((cell) => {
    if (cell === logoCell) return;
    if (cell === imageCell) {
      cell.className = `${PREFIX}-portrait`;
      cell.querySelectorAll('picture > img').forEach((img) => {
        const optimized = createOptimizedPicture(img.src, img.alt, false, [{ width: '400' }]);
        moveInstrumentation(img, optimized.querySelector('img'));
        img.closest('picture').replaceWith(optimized);
      });
    } else {
      cell.className = `${PREFIX}-content`;
      buildContent(cell, logo);
    }
    slide.append(cell);
  });
  if (logoCell) {
    // keep the logo authorable even when no "Winner" label paragraph exists
    // (the slide is still detached here, so check containment, not isConnected)
    if (logo && !slide.contains(logo)) {
      const content = slide.querySelector(`.${PREFIX}-content`);
      let prize = content && content.querySelector(`.${PREFIX}-prize`);
      if (content && !prize) {
        prize = document.createElement('div');
        prize.className = `${PREFIX}-prize`;
        content.append(prize);
      }
      if (prize) {
        const p = document.createElement('p');
        p.className = `${PREFIX}-game`;
        p.append(logo);
        prize.prepend(p);
      }
    }
    moveInstrumentation(logoCell, logo);
    logoCell.remove();
  }

  const heading = slide.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    if (!heading.id) heading.id = `${slide.id}-title`;
    slide.setAttribute('aria-labelledby', heading.id);
  }
  return slide;
}

let carouselWinnersId = 0;

export default async function decorate(block) {
  carouselWinnersId += 1;
  const id = carouselWinnersId;
  block.id = `${PREFIX}-${id}`;
  const rows = [...block.querySelectorAll(':scope > div')];
  const isSingle = rows.length < 2;

  const placeholders = await fetchPlaceholders();
  block.setAttribute('role', 'region');
  const { carousel: roleLabel } = placeholders;
  block.setAttribute('aria-roledescription', roleLabel || 'Carousel');

  const container = document.createElement('div');
  container.className = `${PREFIX}-slides-container`;
  const slidesWrapper = document.createElement('ul');
  slidesWrapper.className = `${PREFIX}-slides`;

  rows.forEach((row, idx) => {
    slidesWrapper.append(createSlide(row, idx, id));
    row.remove();
  });
  container.append(slidesWrapper);
  block.replaceChildren(container);

  if (isSingle) return;

  const nav = document.createElement('div');
  nav.className = `${PREFIX}-navigation`;
  nav.innerHTML = `
    <button type="button" class="${PREFIX}-prev" aria-label="${placeholders.previousSlide || 'Previous Slide'}"></button>
    <button type="button" class="${PREFIX}-next" aria-label="${placeholders.nextSlide || 'Next Slide'}"></button>
  `;
  container.append(nav);

  const indicatorsNav = document.createElement('nav');
  indicatorsNav.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');
  const indicators = document.createElement('ol');
  indicators.className = `${PREFIX}-indicators`;
  rows.forEach((_, idx) => {
    const li = document.createElement('li');
    li.className = `${PREFIX}-indicator`;
    li.dataset.targetSlide = idx;
    li.innerHTML = `<button type="button" aria-label="${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${rows.length}"></button>`;
    indicators.append(li);
  });
  indicatorsNav.append(indicators);
  block.append(indicatorsNav);

  updateActiveSlide(block, 0);
  bindEvents(block);
}
