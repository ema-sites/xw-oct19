// media query match that indicates desktop width
const isDesktop = window.matchMedia('(width >= 900px)');

/**
 * Fetches the nav fragment. Metadata-independent: /content first (local preview),
 * then the site root (DA / EDS preview + live).
 * @returns {Promise<Element|null>} wrapper element holding the nav sections
 */
async function fetchNav() {
  let resp = await fetch('/content/nav.plain.html');
  if (!resp.ok) resp = await fetch('/nav.plain.html');
  if (!resp.ok) return null;
  const html = await resp.text();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  // images in the fragment are relative to the fragment location
  const base = new URL(resp.url);
  wrapper.querySelectorAll('img[src]').forEach((img) => {
    img.src = new URL(img.getAttribute('src'), base).href;
    img.loading = 'lazy';
  });
  return wrapper;
}

function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Builds a site search form from a link: href = form action, text = placeholder.
 * @param {Element} section nav section holding the search link
 */
function buildSearch(section) {
  const link = section.querySelector('a');
  if (!link) return;
  const form = document.createElement('form');
  form.className = 'nav-search-form';
  form.action = link.getAttribute('href');
  form.method = 'get';
  form.setAttribute('role', 'search');
  const label = document.createElement('label');
  label.className = 'nav-visually-hidden';
  label.htmlFor = 'nav-search-input';
  label.textContent = 'Search';
  const input = document.createElement('input');
  input.type = 'search';
  input.name = 'q';
  input.id = 'nav-search-input';
  input.placeholder = link.textContent.trim();
  input.maxLength = 2048;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.className = 'nav-search-submit';
  submit.setAttribute('aria-label', 'Search');
  form.append(label, input, submit);
  section.replaceChildren(form);
}

/**
 * Tags each tool link with a class derived from its label so it can be styled.
 * @param {Element} section nav tools section
 */
function decorateTools(section) {
  section.querySelectorAll(':scope li').forEach((li) => {
    const a = li.querySelector('a');
    if (!a) return;
    li.classList.add(`nav-tool-${slugify(a.textContent)}`);
    a.setAttribute('aria-label', a.textContent.trim());
  });
}

/**
 * Turns a dropdown <li> into a trigger + megamenu panel.
 * Panel content: first list = cards (image link + optional CTA),
 * trailing paragraph + list = side column of links.
 * @param {Element} li top level nav item with nested content
 * @param {number} idx index for ids
 */
function buildPanel(li, idx) {
  const trigger = li.querySelector(':scope > a');
  const panel = document.createElement('div');
  panel.className = 'nav-panel';
  panel.id = `nav-panel-${idx}`;

  const lists = [...li.querySelectorAll(':scope > ul')];
  const [cardList, ...linkLists] = lists;
  if (cardList) {
    cardList.className = 'nav-panel-cards';
    cardList.querySelectorAll(':scope > li').forEach((card) => {
      card.className = 'nav-card';
      const links = [...card.querySelectorAll('a')];
      const imgLink = links.find((a) => a.querySelector('img'));
      if (imgLink) {
        imgLink.classList.add('nav-card-image');
        // mobile accordion lists each card by its image alt text
        const name = document.createElement('a');
        name.className = 'nav-card-name';
        name.href = imgLink.href;
        name.textContent = imgLink.querySelector('img').alt;
        card.prepend(name);
      }
      const cta = links.find((a) => !a.querySelector('img'));
      if (!cta) {
        card.classList.add('nav-card-promo');
      } else if (cta.closest('strong')) {
        cta.className = 'button nav-card-button';
      } else {
        cta.className = 'nav-card-link';
      }
    });
    panel.append(cardList);
  }

  const side = document.createElement('div');
  side.className = 'nav-panel-side';
  [...li.children].forEach((child) => {
    if (child === trigger || child === cardList) return;
    if (child.tagName === 'P') child.className = 'nav-panel-heading';
    if (child.tagName === 'UL') child.className = 'nav-panel-links';
    side.append(child);
  });
  if (linkLists.length || side.children.length) panel.append(side);

  li.classList.add('nav-drop');
  li.append(panel);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panel.id);
  trigger.setAttribute('role', 'button');
}

// tools repeated inside the mobile drawer (by label slug): top row and footer
const DRAWER_TOP_TOOLS = ['create-account', 'sign-in'];
const DRAWER_BOTTOM_TOOLS = ['help', 'francais'];

/**
 * Builds the mobile-only drawer rows from the desktop tools and search form.
 * @param {Element} tools nav tools section
 * @param {Element} search nav search section
 * @returns {{ top: Element, bottom: Element }}
 */
function buildDrawerExtras(tools, search) {
  const makeList = (slugs, className) => {
    const ul = document.createElement('ul');
    ul.className = `nav-drawer-${className} nav-mobile-only`;
    slugs.forEach((slug) => {
      const li = tools && tools.querySelector(`.nav-tool-${slug}`);
      if (li) ul.append(li.cloneNode(true));
    });
    return ul;
  };
  const top = makeList(DRAWER_TOP_TOOLS, 'top');
  const bottom = document.createElement('div');
  bottom.className = 'nav-drawer-bottom nav-mobile-only';
  const form = search && search.querySelector('form');
  if (form) {
    const clone = form.cloneNode(true);
    const input = clone.querySelector('input');
    const label = clone.querySelector('label');
    input.id = 'nav-drawer-search-input';
    label.htmlFor = input.id;
    bottom.append(clone);
  }
  bottom.append(makeList(DRAWER_BOTTOM_TOOLS, 'links'));
  return { top, bottom };
}

function closeAllPanels(sections, except = null) {
  sections.querySelectorAll('.nav-drop > a[aria-expanded="true"]').forEach((trigger) => {
    if (trigger !== except) trigger.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Opens / closes the mobile menu.
 * @param {Element} nav nav element
 * @param {boolean|null} force true to open, false to close
 */
function toggleMenu(nav, force = null) {
  const expanded = nav.getAttribute('aria-expanded') === 'true';
  const open = force !== null ? force : !expanded;
  const button = nav.querySelector('.nav-hamburger button');
  nav.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-expanded', open ? 'true' : 'false');
  button.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  document.body.style.overflowY = open && !isDesktop.matches ? 'hidden' : '';
  document.body.classList.toggle('nav-open', open && !isDesktop.matches);
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  const fragment = await fetchNav();
  block.textContent = '';
  if (!fragment) return;

  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Main');
  const sectionsEls = [...fragment.children];
  const classes = ['brand', 'search', 'tools', 'sections'];
  sectionsEls.forEach((section, i) => {
    if (classes[i]) section.className = `nav-${classes[i]}`;
  });

  const brand = sectionsEls[0];
  const search = sectionsEls[1];
  const tools = sectionsEls[2];
  const sections = sectionsEls[3];

  if (search) buildSearch(search);
  if (tools) decorateTools(tools);
  if (sections) {
    const topList = sections.querySelector(':scope > ul');
    if (topList) topList.className = 'nav-list';
    sections.querySelectorAll(':scope > ul > li').forEach((li, idx) => {
      li.classList.add('nav-item');
      if (li.querySelector(':scope > ul')) buildPanel(li, idx);
    });

    sections.addEventListener('click', (e) => {
      const trigger = e.target.closest('.nav-drop > a');
      if (!trigger) return;
      e.preventDefault();
      const open = trigger.getAttribute('aria-expanded') !== 'true';
      closeAllPanels(sections, trigger);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  // top bar: brand, search, tools; bottom bar: primary sections
  const top = document.createElement('div');
  top.className = 'nav-top';
  const topInner = document.createElement('div');
  topInner.className = 'nav-top-inner';
  [brand, search, tools].filter(Boolean).forEach((el) => topInner.append(el));
  top.append(topInner);

  const hamburger = document.createElement('div');
  hamburger.className = 'nav-hamburger';
  hamburger.innerHTML = `<button type="button" aria-controls="nav-menu" aria-expanded="false" aria-label="Open navigation">
      <span class="nav-hamburger-icon"><span></span></span>
      <span class="nav-hamburger-label">Menu</span>
    </button>`;
  topInner.prepend(hamburger);

  const bar = document.createElement('div');
  bar.className = 'nav-bar';
  bar.id = 'nav-menu';
  const drawer = buildDrawerExtras(tools, search);
  bar.append(drawer.top);
  if (sections) bar.append(sections);
  bar.append(drawer.bottom);

  nav.append(top, bar);
  nav.setAttribute('aria-expanded', 'false');
  hamburger.querySelector('button').addEventListener('click', () => toggleMenu(nav));

  // close panels / menu on outside click and Escape
  document.addEventListener('click', (e) => {
    if (!isDesktop.matches) {
      if (nav.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target)) toggleMenu(nav, false);
      return;
    }
    if (sections && !sections.contains(e.target)) closeAllPanels(sections);
  });
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    const openTrigger = sections && sections.querySelector('.nav-drop > a[aria-expanded="true"]');
    if (openTrigger) {
      closeAllPanels(sections);
      openTrigger.focus();
    } else if (!isDesktop.matches && nav.getAttribute('aria-expanded') === 'true') {
      toggleMenu(nav, false);
      hamburger.querySelector('button').focus();
    }
  });

  // reset state when crossing the desktop breakpoint
  isDesktop.addEventListener('change', () => {
    toggleMenu(nav, false);
    if (sections) closeAllPanels(sections);
  });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
