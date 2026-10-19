import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { fetchPlaceholders } from '../../scripts/placeholders.js';

/*
 * carousel-hero: full-bleed, image-only promo slides. The artwork carries the
 * message, so the authored CTA link (second cell) is kept for accessibility and
 * stretched over the whole slide. Controls render in a bar ([prev] [dots] [next])
 * that overlays the bottom of the slide on desktop and sits below it on mobile.
 * Slides autoplay (6500ms) like the source.
 *
 * Authoring: one row per slide -> [image | text with CTA link].
 */

const PREFIX = 'carousel-hero';

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
  const target = slides[index];
  block.querySelector(`.${PREFIX}-slides`).scrollTo({ top: 0, left: target.offsetLeft, behavior });
}

function bindEvents(block) {
  block.querySelectorAll(`.${PREFIX}-indicator button`).forEach((button) => {
    button.addEventListener('click', (e) => {
      const li = e.currentTarget.parentElement;
      showSlide(block, parseInt(li.dataset.targetSlide, 10));
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

/* source autoplays every 6500ms (infinite); pause while hovered/focused */
const AUTOPLAY_DELAY = 6500;

function startAutoplay(block) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let timer;
  const stop = () => { clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    timer = setInterval(() => {
      if (document.hidden) return;
      showSlide(block, parseInt(block.dataset.activeSlide || '0', 10) + 1);
    }, AUTOPLAY_DELAY);
  };
  block.addEventListener('mouseenter', stop);
  block.addEventListener('mouseleave', start);
  block.addEventListener('focusin', stop);
  block.addEventListener('focusout', (e) => {
    if (!block.contains(e.relatedTarget)) start();
  });
  start();
}

function createSlide(row, idx, id) {
  const slide = document.createElement('li');
  slide.className = `${PREFIX}-slide`;
  slide.dataset.slideIndex = idx;
  slide.id = `${PREFIX}-${id}-slide-${idx}`;
  moveInstrumentation(row, slide);

  const cells = [...row.children];
  const imageCell = cells.find((c) => c.querySelector('picture, img')) || cells[0];
  const contentCells = cells.filter((c) => c !== imageCell);

  if (imageCell) {
    imageCell.className = `${PREFIX}-slide-image`;
    imageCell.querySelectorAll('picture > img').forEach((img) => {
      const optimized = createOptimizedPicture(img.src, img.alt, idx === 0, [
        { media: '(min-width: 900px)', width: '2000' },
        { width: '900' },
      ]);
      moveInstrumentation(img, optimized.querySelector('img'));
      img.closest('picture').replaceWith(optimized);
    });
    slide.append(imageCell);
  }

  contentCells.forEach((cell) => {
    cell.className = `${PREFIX}-slide-content`;
    const link = cell.querySelector('a[href]');
    if (link) {
      link.classList.add(`${PREFIX}-slide-link`);
      const img = imageCell?.querySelector('img');
      if (img && img.alt && !link.getAttribute('aria-label')) {
        link.setAttribute('aria-label', `${link.textContent.trim()}: ${img.alt}`);
      }
    }
    slide.append(cell);
  });

  return slide;
}

let carouselHeroId = 0;

export default async function decorate(block) {
  carouselHeroId += 1;
  const id = carouselHeroId;
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

  const controls = document.createElement('nav');
  controls.className = `${PREFIX}-controls`;
  controls.setAttribute('aria-label', placeholders.carouselSlideControls || 'Carousel Slide Controls');

  const prev = document.createElement('button');
  prev.type = 'button';
  prev.className = `${PREFIX}-prev`;
  prev.setAttribute('aria-label', placeholders.previousSlide || 'Previous Slide');

  const next = document.createElement('button');
  next.type = 'button';
  next.className = `${PREFIX}-next`;
  next.setAttribute('aria-label', placeholders.nextSlide || 'Next Slide');

  const indicators = document.createElement('ol');
  indicators.className = `${PREFIX}-indicators`;
  rows.forEach((_, idx) => {
    const li = document.createElement('li');
    li.className = `${PREFIX}-indicator`;
    li.dataset.targetSlide = idx;
    li.innerHTML = `<button type="button" aria-label="${placeholders.showSlide || 'Show Slide'} ${idx + 1} ${placeholders.of || 'of'} ${rows.length}"></button>`;
    indicators.append(li);
  });

  controls.append(prev, indicators, next);
  block.append(controls);

  updateActiveSlide(block, 0);
  bindEvents(block);
  startAutoplay(block);
}
