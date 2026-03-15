// ============================================
// SCRAPER PRO v2 - content.js
// Handles all page interactions
// ============================================

let isSelecting = false;
let hoveredEl = null;

// ---- Inject styles ----
const style = document.createElement('style');
style.textContent = `
  .sp-hover {
    outline: 3px dashed #4f46e5 !important;
    outline-offset: 3px !important;
    cursor: crosshair !important;
    background-color: rgba(79,70,229,0.12) !important;
  }
  .sp-selected {
    outline: 3px solid #22c55e !important;
    outline-offset: 3px !important;
    background-color: rgba(34,197,94,0.12) !important;
  }
  #sp-toolbar {
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #0a0a0f !important;
    border: 1px solid #4f46e5 !important;
    border-radius: 12px !important;
    padding: 14px 16px !important;
    font-family: 'Segoe UI', system-ui, sans-serif !important;
    box-shadow: 0 8px 40px rgba(79,70,229,0.4) !important;
    min-width: 240px !important;
    display: none !important;
    color: #e8e8f0 !important;
  }
  #sp-toolbar.show { display: block !important; }
  #sp-toolbar h4 {
    color: #a78bfa !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    margin: 0 0 8px 0 !important;
  }
  #sp-counter {
    background: #1a1a30 !important;
    border: 1px solid #2a2a50 !important;
    color: #a78bfa !important;
    border-radius: 6px !important;
    padding: 6px 10px !important;
    font-size: 12px !important;
    margin-bottom: 8px !important;
    text-align: center !important;
  }
  #sp-hint {
    color: #707090 !important;
    font-size: 12px !important;
    margin-bottom: 10px !important;
  }
  #sp-stop {
    background: #ef4444 !important;
    color: white !important;
    border: none !important;
    border-radius: 6px !important;
    padding: 8px 16px !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    cursor: pointer !important;
    width: 100% !important;
  }
  #sp-stop:hover { background: #dc2626 !important; }
`;
document.head.appendChild(style);

// ---- Floating toolbar ----
const toolbar = document.createElement('div');
toolbar.id = 'sp-toolbar';
toolbar.innerHTML = `
  <h4>🕷️ ScraperPro — Selecting</h4>
  <div id="sp-counter">0 fields selected</div>
  <div id="sp-hint">👆 Click any element to select it</div>
  <button id="sp-stop">✅ Done — Open Popup</button>
`;
document.body.appendChild(toolbar);

document.getElementById('sp-stop').addEventListener('click', () => {
  stopSelecting();
  chrome.runtime.sendMessage({ action: 'stoppedSelecting' });
});

// ---- Message listener ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'startSelecting') startSelecting();
  if (msg.action === 'stopSelecting') stopSelecting();
  if (msg.action === 'clearAll') clearHighlights();

  if (msg.action === 'scrapeData') {
    sendResponse({ data: scrapeAll(msg.selectors) });
  }

  if (msg.action === 'scrapePrice') {
    const el = document.querySelector(msg.selector);
    sendResponse({ price: el ? el.innerText.trim() : null });
  }

  if (msg.action === 'getPageHTML') {
    // Send trimmed HTML for AI analysis (avoid huge pages)
    const clone = document.body.cloneNode(true);
    // Remove scripts/styles for cleaner AI parsing
    clone.querySelectorAll('script, style, noscript').forEach(e => e.remove());
    sendResponse({ html: clone.innerHTML.substring(0, 12000) });
  }

  return true;
});

// ---- Selection mode ----
function startSelecting() {
  isSelecting = true;
  document.body.style.cursor = 'crosshair';
  toolbar.classList.add('show');
  document.addEventListener('mouseover', onHover);
  document.addEventListener('mouseout', onHoverOut);
  document.addEventListener('click', onClick, true);
}

function stopSelecting() {
  isSelecting = false;
  document.body.style.cursor = '';
  toolbar.classList.remove('show');
  document.removeEventListener('mouseover', onHover);
  document.removeEventListener('mouseout', onHoverOut);
  document.removeEventListener('click', onClick, true);
  if (hoveredEl) { hoveredEl.classList.remove('sp-hover'); hoveredEl = null; }
}

function onHover(e) {
  if (!isSelecting) return;
  if (e.target.closest('#sp-toolbar')) return;
  if (hoveredEl) hoveredEl.classList.remove('sp-hover');
  hoveredEl = e.target;
  hoveredEl.classList.add('sp-hover');
}

function onHoverOut(e) {
  if (e.target && !e.target.closest('#sp-toolbar')) {
    e.target.classList.remove('sp-hover');
  }
}

function onClick(e) {
  if (!isSelecting) return;
  if (e.target.closest('#sp-toolbar')) return;
  e.preventDefault();
  e.stopPropagation();

  const el = e.target;
  const selector = getSelector(el);
  const matches = document.querySelectorAll(selector);

  matches.forEach(m => m.classList.add('sp-selected'));

  // Update toolbar counter
  chrome.storage.local.get(['selectors'], (r) => {
    const list = r.selectors || [];
    list.push({ selector, label: el.tagName.toLowerCase(), count: matches.length });
    chrome.storage.local.set({ selectors: list });
    document.getElementById('sp-counter').textContent =
      `${list.length} field(s) · ${matches.length} items found`;
  });

  chrome.runtime.sendMessage({
    action: 'selectorAdded',
    selector,
    label: el.tagName.toLowerCase(),
    count: matches.length
  });
}

// ---- Smart CSS selector generator ----
function getSelector(el) {
  // 1. ID
  if (el.id && !el.id.match(/^\d/)) return `#${el.id}`;

  // 2. Meaningful class
  const classes = Array.from(el.classList)
    .filter(c => !c.startsWith('sp-') && c.length > 1 && !c.match(/^\d/));

  if (classes.length > 0) {
    // Try most specific class combo first
    for (let i = Math.min(classes.length, 3); i > 0; i--) {
      const sel = '.' + classes.slice(0, i).join('.');
      try {
        const hits = document.querySelectorAll(sel);
        if (hits.length > 0 && hits.length < 200) return sel;
      } catch (e) { }
    }
  }

  // 3. Tag + class
  if (classes.length > 0) {
    const sel = el.tagName.toLowerCase() + '.' + classes[0];
    if (document.querySelectorAll(sel).length > 0) return sel;
  }

  // 4. Attribute-based (data-*, aria-*)
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-') || attr.name.startsWith('aria-')) {
      const sel = `[${attr.name}="${attr.value}"]`;
      try {
        if (document.querySelectorAll(sel).length > 0) return sel;
      } catch (e) { }
    }
  }

  // 5. Nth-child fallback
  const parent = el.parentElement;
  if (parent) {
    const idx = Array.from(parent.children).indexOf(el) + 1;
    return `${getSelector(parent)} > ${el.tagName.toLowerCase()}:nth-child(${idx})`;
  }

  return el.tagName.toLowerCase();
}

// ---- Scrape all data ----
function scrapeAll(selectors) {
  let maxLen = 0;
  const cols = selectors.map(s => {
    const els = [...document.querySelectorAll(s.selector)];
    if (els.length > maxLen) maxLen = els.length;
    return { key: s.selector, els };
  });

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const row = {};
    cols.forEach(({ key, els }) => {
      const el = els[i];
      if (!el) { row[key] = ''; return; }
      // Smart value extraction
      if (el.tagName === 'IMG') row[key] = el.src || el.getAttribute('data-src') || '';
      else if (el.tagName === 'A') row[key] = el.href || el.innerText.trim();
      else if (el.tagName === 'INPUT') row[key] = el.value;
      else row[key] = el.innerText.trim();
    });
    rows.push(row);
  }
  return rows;
}

// ---- Clear all highlights ----
function clearHighlights() {
  document.querySelectorAll('.sp-selected, .sp-hover').forEach(el => {
    el.classList.remove('sp-selected', 'sp-hover');
  });
}