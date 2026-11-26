const animations = document.querySelectorAll('.logo-gyroscope');
let paused = false;

function setPaused(value) {
  paused = value;
  animations.forEach(image => { image.src = paused ? 'assets/planetary-gyroscope-still.png' : 'assets/planetary-gyroscope.gif'; });
  document.documentElement.classList.toggle('motion-paused', paused);
  document.querySelectorAll('[data-animated-src]').forEach(image => { image.src = paused ? image.dataset.stillSrc : image.dataset.animatedSrc; });
}

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
setPaused(reducedMotion.matches);
reducedMotion.addEventListener('change', event => setPaused(event.matches));

const navLinks = [...document.querySelectorAll('nav a')];
const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    for (const link of navLinks) {
      const active = link.hash === `#${entry.target.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
}, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
document.querySelectorAll('main > section').forEach(section => observer.observe(section));

// Decorative text follows each panel's actual dimensions.
const outlines = [...document.querySelectorAll('.frame')].map(panel => {
  const outline = document.createElement(panel.tagName === 'UL' ? 'li' : 'span');
  outline.className = 'ascii-outline';
  outline.setAttribute('aria-hidden', 'true');
  const edges = ['top', 'right', 'bottom', 'left'].map(side => {
    const edge = document.createElement('span');
    edge.className = `ascii-edge ascii-${side}`;
    outline.append(edge);
    return edge;
  });
  panel.append(outline);
  return { panel, edges };
});
let phase = 0;
function drawOutline({panel, edges}) {
  const columns = Math.max(2, Math.floor(panel.clientWidth / 8));
  const rows = Math.max(1, Math.floor(panel.clientHeight / 16) - 2);
  const glyphs = '-=+*:;~<>/\\|![]{}#%@';
  const symbol = (index, salt) => {
    if (paused) return index % 5 === 0 ? '+' : '-';
    const wave = Math.sin(index * 1.73 + phase * .31 + salt) * 43758.5453;
    return glyphs[Math.floor((wave - Math.floor(wave)) * glyphs.length)];
  };
  const horizontal = salt => Array.from({length: columns - 2}, (_, i) => symbol(i, salt)).join('');
  edges[0].textContent = '+' + horizontal(0) + '+';
  edges[2].textContent = '+' + horizontal(19) + '+';
  const vertical = Array.from({length: rows}, (_, i) => paused ? '|' : symbol(i, 37)).join('\n');
  edges[1].textContent = vertical;
  edges[3].textContent = vertical;
}
const resizeOutlines = new ResizeObserver(entries => {
  for (const entry of entries) drawOutline(outlines.find(item => item.panel === entry.target));
});
outlines.forEach(item => { resizeOutlines.observe(item.panel); drawOutline(item); });
setInterval(() => {
  if (paused || document.hidden) return;
  phase++;
  outlines.forEach(item => {
    const bounds = item.panel.getBoundingClientRect();
    if (bounds.bottom > 0 && bounds.top < innerHeight) drawOutline(item);
  });
}, 120);
reducedMotion.addEventListener('change', () => outlines.forEach(drawOutline));

// Lightweight event beacon for PDF downloads, outbound clicks, and time on page.
const ANALYTICS_ENDPOINT = 'https://edmos7-analytics.edmos7.workers.dev/event';
const pageStart = Date.now();
let durationSent = false;

function sendEvent(type, detail = {}) {
  if (!ANALYTICS_ENDPOINT || ANALYTICS_ENDPOINT.includes('YOUR_SUBDOMAIN')) return;
  const payload = JSON.stringify({
    type,
    path: location.pathname + location.hash,
    ...detail,
    ts: new Date().toISOString(),
  });
  navigator.sendBeacon(ANALYTICS_ENDPOINT, new Blob([payload], { type: 'application/json' }));
}

document.addEventListener('click', event => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  const href = link.getAttribute('href') || '';
  if (href.toLowerCase().endsWith('.pdf')) {
    sendEvent('pdf_download', { target: href, label: link.textContent.trim() });
  } else if (href.startsWith('http') && !href.includes(location.hostname)) {
    sendEvent('outbound_click', { target: href, label: link.textContent.trim() });
  } else if (href.startsWith('#')) {
    sendEvent('section_nav', { target: href });
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && !durationSent) {
    durationSent = true;
    sendEvent('time_on_page', { seconds: Math.round((Date.now() - pageStart) / 1000) });
  }
});
