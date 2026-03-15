// ============================================
// SCRAPER PRO v2 - background.js
// Handles: alarms, price checks, notifications
// ============================================

// On install - set defaults
chrome.runtime.onInstalled.addListener(() => {
  console.log('ScraperPro v2 installed!');
  chrome.storage.local.set({
    selectors: [],
    scrapedData: [],
    exportCount: 0,
    plan: 'free',
    trackedPrices: [],
    schedules: [],
    sheetsToken: null
  });
  // Check prices every 24 hours
  chrome.alarms.create('priceCheck', { periodInMinutes: 1440 });
  // Check schedules every 60 minutes
  chrome.alarms.create('scheduledScrape', { periodInMinutes: 60 });
});

// Handle alarms
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'priceCheck') {
    await checkTrackedPrices();
  }
  if (alarm.name === 'scheduledScrape') {
    await runScheduledScrapes();
  }
});

// ---- PRICE TRACKING ----
async function checkTrackedPrices() {
  const { trackedPrices } = await chrome.storage.local.get(['trackedPrices']);
  if (!trackedPrices || trackedPrices.length === 0) return;

  for (const item of trackedPrices) {
    try {
      // Open tab silently, scrape price, compare
      const tab = await chrome.tabs.create({ url: item.url, active: false });
      await new Promise(resolve => setTimeout(resolve, 3000)); // wait for page load

      chrome.tabs.sendMessage(tab.id, {
        action: 'scrapePrice',
        selector: item.selector
      }, async (response) => {
        if (response && response.price) {
          const newPrice = parseFloat(response.price.replace(/[^0-9.]/g, ''));
          const oldPrice = item.currentPrice;

          if (newPrice < item.alertPrice) {
            // Price dropped! Send notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: '🎉 Price Drop Alert! - ScraperPro',
              message: `${item.name}: $${newPrice} (was $${oldPrice}) - Your target: $${item.alertPrice}`
            });

            // Update stored price
            item.currentPrice = newPrice;
            item.lastChecked = new Date().toISOString();
            await chrome.storage.local.set({ trackedPrices });
          }
        }
        chrome.tabs.remove(tab.id);
      });
    } catch (e) {
      console.log('Price check error:', e);
    }
  }
}

// ---- SCHEDULED SCRAPING ----
async function runScheduledScrapes() {
  const { schedules } = await chrome.storage.local.get(['schedules']);
  if (!schedules || schedules.length === 0) return;

  const now = Date.now();
  for (const schedule of schedules) {
    const nextRun = schedule.lastRun + (schedule.intervalMinutes * 60 * 1000);
    if (now >= nextRun) {
      try {
        const tab = await chrome.tabs.create({ url: schedule.url, active: false });
        await new Promise(resolve => setTimeout(resolve, 3000));

        chrome.tabs.sendMessage(tab.id, {
          action: 'scrapeData',
          selectors: schedule.selectors
        }, async (response) => {
          if (response && response.data) {
            schedule.lastRun = now;
            schedule.lastData = response.data;

            // If Google Sheets connected, auto-append
            if (schedule.sheetId) {
              await appendToSheet(schedule.sheetId, response.data);
            }

            await chrome.storage.local.set({ schedules });

            chrome.notifications.create({
              type: 'basic',
              iconUrl: 'icons/icon128.png',
              title: '✅ Auto-Scrape Complete - ScraperPro',
              message: `${schedule.name}: ${response.data.length} rows collected`
            });
          }
          chrome.tabs.remove(tab.id);
        });
      } catch (e) {
        console.log('Schedule run error:', e);
      }
    }
  }
}

// ---- GOOGLE SHEETS HELPER ----
async function appendToSheet(sheetId, data) {
  const { sheetsToken } = await chrome.storage.local.get(['sheetsToken']);
  if (!sheetsToken || !data.length) return;

  const values = data.map(row => Object.values(row));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${sheetsToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'appendToSheet') {
    appendToSheet(message.sheetId, message.data)
      .then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (message.action === 'selectorAdded') {
    chrome.storage.local.get(['selectors'], (result) => {
      const selectors = result.selectors || [];
      selectors.push({
        selector: message.selector,
        label: message.label,
        count: message.count
      });
      chrome.storage.local.set({ selectors });
    });
  }
  return true;
});