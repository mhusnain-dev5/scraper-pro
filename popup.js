// ============================================
// SCRAPER PRO v2 - popup.js
// All 4 features: Scraper, Sheets, AI, Tracker, Schedule
// ============================================

// ---- BACKEND URL (Your Railway URL) ----
const BACKEND_URL = 'https://scraper-pro-production.up.railway.app';

// ---- STATE ----
let selectors = [];
let scrapedData = [];
let exportCount = 0;
let isSelecting = false;
let sheetsToken = null;
let autoSync = false;
let aiSuggestedSelectors = [];

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  loadAllData();
  setupTabs();
  setupScraper();
  setupSheets();
  setupAI();
  setupTracker();
  setupSchedule();
  setInterval(loadAllData, 1500);
});

// ---- LOAD ALL DATA ----
function loadAllData() {
  chrome.storage.local.get([
    'selectors', 'scrapedData', 'exportCount',
    'plan', 'sheetsToken', 'trackedPrices',
    'schedules', 'autoSync'
  ], (r) => {
    selectors = r.selectors || [];
    scrapedData = r.scrapedData || [];
    exportCount = r.exportCount || 0;
    sheetsToken = r.sheetsToken || null;
    autoSync = r.autoSync || false;

    document.getElementById('planBadge').textContent = (r.plan || 'free').toUpperCase();
    updateScraperUI();
    updateSheetsUI(r.sheetsToken);
    updateTrackerUI(r.trackedPrices || []);
    updateScheduleUI(r.schedules || []);

    if (r.autoSync !== undefined) {
      document.getElementById('autoSyncToggle').checked = r.autoSync;
    }
    if (selectors.length > 0) {
      document.getElementById('trackSelector').value = selectors[selectors.length - 1].selector;
    }
  });
}

// ---- TAB NAVIGATION ----
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
    });
  });
}

// ============================================
// FEATURE 1: SCRAPER
// ============================================
function setupScraper() {
  document.getElementById('selectBtn').addEventListener('click', () => {
    isSelecting = !isSelecting;
    sendToTab({ action: isSelecting ? 'startSelecting' : 'stopSelecting' });

    const btn = document.getElementById('selectBtn');
    const alert = document.getElementById('selectingAlert');
    if (isSelecting) {
      btn.textContent = '⏹️ Stop Selecting';
      alert.classList.add('show');
      setStatus('Click any element on the page...', 'warn');
    } else {
      btn.textContent = '🎯 Select Elements on Page';
      alert.classList.remove('show');
      setStatus('Ready to scrape');
    }
  });

  document.getElementById('scrapeBtn').addEventListener('click', () => {
    if (!selectors.length) return;
    setStatus('⏳ Scraping...', 'warn');
    sendToTab({ action: 'scrapeData', selectors }, async (res) => {
      if (res?.data) {
        scrapedData = res.data;
        await chrome.storage.local.set({ scrapedData });
        setStatus(`✅ Found ${scrapedData.length} items!`);
        document.getElementById('dataCount').textContent = scrapedData.length;
        document.getElementById('exportCSV').disabled = false;
        document.getElementById('exportJSON').disabled = false;

        if (autoSync && sheetsToken) {
          const sheetId = document.getElementById('sheetIdInput').value;
          if (sheetId) await exportToGoogleSheets(sheetId, scrapedData);
        }
      } else {
        setStatus('⚠️ No data found. Try different elements.', 'error');
      }
    });
  });

  document.getElementById('exportCSV').addEventListener('click', () => {
    if (!scrapedData.length) return;
    downloadCSV(scrapedData);
    exportCount += scrapedData.length;
    chrome.storage.local.set({ exportCount });
    document.getElementById('exportCount').textContent = exportCount;
    setStatus('✅ CSV downloaded!');
  });

  document.getElementById('exportJSON').addEventListener('click', () => {
    if (!scrapedData.length) return;
    downloadJSON(scrapedData);
    exportCount += scrapedData.length;
    chrome.storage.local.set({ exportCount });
    document.getElementById('exportCount').textContent = exportCount;
    setStatus('✅ JSON downloaded!');
  });

  document.getElementById('clearBtn').addEventListener('click', () => {
    selectors = [];
    scrapedData = [];
    chrome.storage.local.set({ selectors: [], scrapedData: [] });
    sendToTab({ action: 'clearAll' });
    isSelecting = false;
    document.getElementById('selectBtn').textContent = '🎯 Select Elements on Page';
    document.getElementById('selectingAlert').classList.remove('show');
    document.getElementById('exportCSV').disabled = true;
    document.getElementById('exportJSON').disabled = true;
    setStatus('Cleared! Ready to start.');
    updateScraperUI();
  });
}

function updateScraperUI() {
  document.getElementById('selectorCount').textContent = selectors.length;
  document.getElementById('dataCount').textContent = scrapedData.length;
  document.getElementById('exportCount').textContent = exportCount;
  document.getElementById('scrapeBtn').disabled = selectors.length === 0;
  renderSelectorsList();
}

// ✅ FIX 1: Removed onclick — using data-index instead
function renderSelectorsList() {
  const list = document.getElementById('selectorsList');
  if (!selectors.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🎯</div><p>No fields selected.<br/>Click "Select Elements" to start.</p></div>`;
    return;
  }
  list.innerHTML = selectors.map((item, i) => `
    <div class="selector-item">
      <span class="sel-name" title="${esc(item.selector)}">${esc(item.selector)}</span>
      <span class="sel-count">${item.count}</span>
      <button class="sel-remove" data-index="${i}">✕</button>
    </div>`).join('');
}

function removeSelector(i) {
  selectors.splice(i, 1);
  chrome.storage.local.set({ selectors });
  updateScraperUI();
}

// ============================================
// FEATURE 2: GOOGLE SHEETS
// ============================================
function setupSheets() {
  document.getElementById('connectSheetsBtn').addEventListener('click', connectGoogleSheets);
  document.getElementById('disconnectSheetsBtn').addEventListener('click', disconnectSheets);
  document.getElementById('exportToSheetBtn').addEventListener('click', () => {
    const sheetId = parseSheetId(document.getElementById('sheetIdInput').value);
    if (!sheetId) return setStatus('⚠️ Enter a valid Sheet ID or URL', 'error');
    if (!scrapedData.length) return setStatus('⚠️ Scrape some data first!', 'error');
    exportToGoogleSheets(sheetId, scrapedData);
  });
  document.getElementById('autoSyncToggle').addEventListener('change', (e) => {
    autoSync = e.target.checked;
    chrome.storage.local.set({ autoSync });
  });
}

async function connectGoogleSheets() {
  try {
    setStatus('🔗 Connecting to Google...', 'warn');
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        setStatus('❌ Connection failed. Try again.', 'error');
        return;
      }
      sheetsToken = token;
      chrome.storage.local.set({ sheetsToken: token });
      updateSheetsUI(token);
      setStatus('✅ Google Sheets connected!');
    });
  } catch (e) {
    setStatus('❌ Error: ' + e.message, 'error');
  }
}

function disconnectSheets() {
  chrome.identity.removeCachedAuthToken({ token: sheetsToken }, () => {
    sheetsToken = null;
    chrome.storage.local.set({ sheetsToken: null });
    updateSheetsUI(null);
    setStatus('Disconnected from Google');
  });
}

function updateSheetsUI(token) {
  const connected = !!token;
  document.getElementById('sheetsDisconnected').style.display = connected ? 'none' : 'block';
  document.getElementById('sheetsConnected').style.display = connected ? 'block' : 'none';
  document.getElementById('exportToSheetBtn').disabled = !connected || !scrapedData.length;
}

async function exportToGoogleSheets(sheetId, data) {
  if (!sheetsToken || !data.length) return;
  setStatus('📤 Exporting to Sheets...', 'warn');

  try {
    const sheetName = document.getElementById('sheetNameInput').value || 'Sheet1';
    const headers = [Object.keys(data[0])];
    const rows = data.map(row => Object.values(row));
    const values = [...headers, ...rows];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sheetsToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      }
    );

    if (res.ok) {
      setStatus(`✅ ${data.length} rows sent to Google Sheets!`);
      exportCount += data.length;
      chrome.storage.local.set({ exportCount });
    } else {
      const err = await res.json();
      setStatus('❌ Sheets error: ' + (err.error?.message || 'Try reconnecting'), 'error');
    }
  } catch (e) {
    setStatus('❌ Network error. Check connection.', 'error');
  }
}

function parseSheetId(input) {
  if (!input) return null;
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

// ============================================
// FEATURE 3: AI SMART SELECTOR
// ============================================
function setupAI() {
  document.getElementById('aiSelectBtn').addEventListener('click', runAISelector);
  document.getElementById('aiApplyBtn').addEventListener('click', applyAISelectors);
}

async function runAISelector() {
  const prompt = document.getElementById('aiPrompt').value.trim();
  if (!prompt) return setStatus('⚠️ Enter what you want to scrape', 'error');

  document.getElementById('aiLoading').classList.add('show');
  document.getElementById('aiResult').classList.remove('show');
  document.getElementById('aiApplyBtn').style.display = 'none';
  document.getElementById('aiSelectBtn').disabled = true;
  setStatus('🧠 AI analyzing page...', 'warn');

  sendToTab({ action: 'getPageHTML' }, async (res) => {
    if (!res?.html) {
      document.getElementById('aiLoading').classList.remove('show');
      document.getElementById('aiSelectBtn').disabled = false;
      setStatus('❌ Could not read page. Refresh and try.', 'error');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-selector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: res.html, prompt })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Backend error ' + response.status);
      }

      const data = await response.json();
      aiSuggestedSelectors = data.selectors || [];

      if (!aiSuggestedSelectors.length) {
        throw new Error('AI could not find matching elements on this page');
      }

      document.getElementById('aiLoading').classList.remove('show');
      document.getElementById('aiSelectBtn').disabled = false;
      document.getElementById('aiResult').textContent =
        aiSuggestedSelectors.map(s =>
          `${s.selector}\n→ ${s.description} (${s.count} items)`
        ).join('\n\n');
      document.getElementById('aiResult').classList.add('show');
      document.getElementById('aiApplyBtn').style.display = 'block';
      setStatus(`✅ AI found ${aiSuggestedSelectors.length} selectors!`);

    } catch (e) {
      document.getElementById('aiLoading').classList.remove('show');
      document.getElementById('aiSelectBtn').disabled = false;
      document.getElementById('aiResult').textContent =
        `❌ ${e.message}\n\nBackend: ${BACKEND_URL}`;
      document.getElementById('aiResult').classList.add('show');
      setStatus('❌ AI error. See details above.', 'error');
    }
  });
}

function applyAISelectors() {
  if (!aiSuggestedSelectors.length) return;
  chrome.storage.local.get(['selectors'], (r) => {
    const existing = r.selectors || [];
    aiSuggestedSelectors.forEach(s => {
      existing.push({ selector: s.selector, label: s.description, count: s.count });
    });
    chrome.storage.local.set({ selectors: existing });
    selectors = existing;
    updateScraperUI();
    document.querySelector('[data-panel="scrape"]').click();
    setStatus(`✅ ${aiSuggestedSelectors.length} AI selectors applied!`);
  });
}

// ============================================
// FEATURE 4: PRICE TRACKER
// ============================================
function setupTracker() {
  document.getElementById('addTrackerBtn').addEventListener('click', addPriceTracker);
}

async function addPriceTracker() {
  const name = document.getElementById('trackName').value.trim();
  const selector = document.getElementById('trackSelector').value.trim();
  const alertPrice = parseFloat(document.getElementById('trackAlertPrice').value);

  if (!name || !selector || isNaN(alertPrice)) {
    setStatus('⚠️ Fill in all tracker fields', 'error');
    return;
  }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const url = tabs[0]?.url || '';
    sendToTab({ action: 'scrapePrice', selector }, async (res) => {
      const currentPrice = res?.price
        ? parseFloat(res.price.replace(/[^0-9.]/g, ''))
        : 0;

      const tracker = {
        id: Date.now(),
        name, url, selector, alertPrice, currentPrice,
        lastChecked: new Date().toISOString()
      };

      const { trackedPrices } = await chrome.storage.local.get(['trackedPrices']);
      const prices = trackedPrices || [];
      prices.push(tracker);
      await chrome.storage.local.set({ trackedPrices: prices });

      document.getElementById('trackName').value = '';
      document.getElementById('trackAlertPrice').value = '';
      updateTrackerUI(prices);
      setStatus(`✅ Now tracking "${name}"!`);
    });
  });
}

// ✅ FIX 2: Removed onclick — using class + data-index instead
function updateTrackerUI(prices) {
  const list = document.getElementById('trackedPricesList');
  if (!prices.length) {
    list.innerHTML = `<div class="empty-state" style="padding:16px;text-align:center;color:#505070;font-size:12px;"><div style="font-size:24px;margin-bottom:6px;">💰</div>No prices tracked yet.</div>`;
    return;
  }
  list.innerHTML = prices.map((p, i) => `
    <div class="price-item">
      <div class="price-item-top">
        <div>
          <div class="price-name">${esc(p.name)}</div>
          <div class="price-alert">Alert below: $${p.alertPrice}</div>
        </div>
        <div style="text-align:right">
          <div class="price-val">$${p.currentPrice || '—'}</div>
          <button class="tracker-remove" data-index="${i}" style="background:none;border:none;color:#ef4444;font-size:10px;cursor:pointer;">Remove</button>
        </div>
      </div>
      <div style="font-size:10px;color:#505070;">
        Last checked: ${new Date(p.lastChecked).toLocaleDateString()}
      </div>
    </div>`).join('');
}

async function removeTracker(i) {
  const { trackedPrices } = await chrome.storage.local.get(['trackedPrices']);
  trackedPrices.splice(i, 1);
  await chrome.storage.local.set({ trackedPrices });
  updateTrackerUI(trackedPrices);
}

// ============================================
// FEATURE 5: SCHEDULER
// ============================================
function setupSchedule() {
  document.getElementById('addScheduleBtn').addEventListener('click', addSchedule);
}

async function addSchedule() {
  const name = document.getElementById('schedName').value.trim();
  const interval = parseInt(document.getElementById('schedInterval').value);
  const sheetId = document.getElementById('schedSheetId').value.trim();

  if (!name) { setStatus('⚠️ Enter a schedule name', 'error'); return; }
  if (!selectors.length) { setStatus('⚠️ Select elements to scrape first', 'error'); return; }

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const schedule = {
      id: Date.now(),
      name,
      url: tabs[0]?.url || '',
      selectors,
      intervalMinutes: interval,
      sheetId: parseSheetId(sheetId),
      lastRun: Date.now(),
      active: true
    };

    const { schedules } = await chrome.storage.local.get(['schedules']);
    const list = schedules || [];
    list.push(schedule);
    await chrome.storage.local.set({ schedules: list });

    document.getElementById('schedName').value = '';
    document.getElementById('schedSheetId').value = '';
    updateScheduleUI(list);
    setStatus(`✅ Schedule "${name}" created!`);
  });
}

// ✅ FIX 3: Removed onclick — using class + data-index instead
function updateScheduleUI(schedules) {
  const list = document.getElementById('schedulesList');
  if (!schedules.length) {
    list.innerHTML = `<div class="empty-state" style="padding:16px;text-align:center;color:#505070;font-size:12px;"><div style="font-size:24px;margin-bottom:6px;">⏰</div>No schedules yet.</div>`;
    return;
  }
  const freqMap = { 60:'Hourly', 360:'Every 6h', 720:'Every 12h', 1440:'Daily', 10080:'Weekly' };
  list.innerHTML = schedules.map((s, i) => `
    <div class="schedule-item">
      <div>
        <div class="sched-name">${esc(s.name)}</div>
        <div class="sched-freq">${freqMap[s.intervalMinutes] || s.intervalMinutes+'min'} · ${s.selectors.length} fields</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <span class="sched-status">Active</span>
        <button class="schedule-remove" data-index="${i}" style="background:none;border:none;color:#ef4444;font-size:12px;cursor:pointer;">✕</button>
      </div>
    </div>`).join('');
}

async function removeSchedule(i) {
  const { schedules } = await chrome.storage.local.get(['schedules']);
  schedules.splice(i, 1);
  await chrome.storage.local.set({ schedules });
  updateScheduleUI(schedules);
}

// ============================================
// HELPERS
// ============================================
function sendToTab(message, callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    try {
      chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
        if (chrome.runtime.lastError) return;
        if (callback) callback(response);
      });
    } catch (e) { }
  });
}

function setStatus(text, type = 'ok') {
  document.getElementById('statusText').textContent = text;
  const dot = document.getElementById('statusDot');
  dot.className = 'dot';
  if (type === 'warn') dot.classList.add('warn');
  if (type === 'error') dot.classList.add('error');
}

function downloadCSV(data) {
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  );
  triggerDownload(new Blob([[headers, ...rows].join('\n')], { type: 'text/csv' }), `scraped-${Date.now()}.csv`);
}

function downloadJSON(data) {
  triggerDownload(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `scraped-${Date.now()}.json`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================
// ✅ FIX 4: Event delegation — handles ALL
// dynamic button clicks without inline onclick
// ============================================
document.addEventListener('click', (e) => {
  // Quick command AI buttons
  if (e.target.classList.contains('ai-quick')) {
    document.getElementById('aiPrompt').value = e.target.dataset.prompt;
  }
  // Remove selector button
  if (e.target.classList.contains('sel-remove')) {
    removeSelector(parseInt(e.target.dataset.index));
  }
  // Remove tracker button
  if (e.target.classList.contains('tracker-remove')) {
    removeTracker(parseInt(e.target.dataset.index));
  }
  // Remove schedule button
  if (e.target.classList.contains('schedule-remove')) {
    removeSchedule(parseInt(e.target.dataset.index));
  }
});