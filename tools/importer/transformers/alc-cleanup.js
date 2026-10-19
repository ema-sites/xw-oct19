/* eslint-disable */
/* global WebImporter */

/**
 * ALC (www.alc.ca) cleanup transformer.
 * Removes non-authorable chrome: header/footer experience fragments, skip links,
 * mobile html-promo, modals (common, MFA/login flow), hidden "Download our App"
 * banner, countdown timers, tracking pixels/iframes and loaders.
 * Selectors taken from migration-work/cleaned.html.
 */
export default function transform(hookName, element, payload) {
  if (hookName === 'beforeTransform') {
    // Elements that would interfere with block parsing / section detection.
    WebImporter.DOMUtils.remove(element, [
      // Header experience fragment (first experiencefragment in aem-Grid)
      'div.experiencefragment',
      '.cmp-experiencefragment--header',
      // MFA / login flow modal (lives in header XF; also remove defensively)
      '#loginFlow',
      '.multi-step-flow',
      // Skip-to-content link
      '.cmp-page__skiptomaincontent',
      // Mobile-only html promo banner (hidden on desktop)
      'div.html-promo',
      // Common modals (jackpot modal, browser-check modal)
      'div.common-modals',
      '.alc-modal',
      // Countdown timers ("Time Remaining") inside hero slides
      '.next-draw-timer',
      // Hidden "Download our App" mobile banner in the right rail
      '.alc-mobile-banner',
      '#banner-mobile-hide-content',
    ]);

    // Responsive pictures fall back to the mobile rendition (imageM) in <img src>;
    // use the desktop source (imageD, min-width 1200px) so the authored image is full size.
    element.querySelectorAll('picture').forEach((picture) => {
      const img = picture.querySelector('img');
      const desktop = picture.querySelector('source[media*="1200px"]');
      const srcset = desktop && desktop.getAttribute('srcset');
      if (img && srcset) img.setAttribute('src', srcset.split(',')[0].trim().split(/\s+/)[0]);
    });

    // Remove the banner wrapper only if it is empty after the mobile banner removal
    element.querySelectorAll('.cmp-container--hide-column-gutters div.banner').forEach((el) => {
      if (!el.textContent.trim() && !el.querySelector('img, picture, a')) el.remove();
    });
  }

  if (hookName === 'afterTransform') {
    WebImporter.DOMUtils.remove(element, [
      // Footer experience fragment
      'footer.experiencefragment',
      '.cmp-experiencefragment--footer',
      // Any remaining global chrome
      'header',
      'nav',
      // Tracking pixels, iframes, loaders, survey placeholders
      'iframe',
      '#ajaxLoaderContainer',
      '#ZN_3Eu2u7P45FmpwJ5',
      'img[width="1"][height="1"]',
      // Non-content elements
      'script',
      'style',
      'noscript',
      'link',
      'meta',
      'button',
    ]);

    // Strip tracking / component data attributes
    element.querySelectorAll('*').forEach((el) => {
      [...el.attributes].forEach((attr) => {
        if (
          attr.name.startsWith('data-cmp-')
          || attr.name.startsWith('data-track')
          || attr.name.startsWith('data-analytics')
          || attr.name === 'onclick'
        ) {
          el.removeAttribute(attr.name);
        }
      });
    });
  }
}
