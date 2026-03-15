# ScraperPro v2 — Setup Guide

## Files in this folder:
- manifest.json
- popup.html
- popup.js
- content.js
- background.js
- icons/ (add your icons here)

## STEP 1 — Google OAuth Setup (for Sheets feature)
1. Go to: https://console.cloud.google.com
2. Create new project: "ScraperPro"
3. Enable: Google Sheets API + Google Drive API
4. Go to Credentials → Create OAuth 2.0 Client ID
5. Application type: Chrome Extension
6. Copy your Client ID
7. Open manifest.json → replace "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

## STEP 2 — Claude API Key (for AI feature)
1. Go to: https://console.anthropic.com
2. Get your API key (free $5 credits to start)
3. In the extension popup → AI tab → Settings
4. Paste your key

## STEP 3 — Load Extension
1. Go to chrome://extensions
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select this folder

## STEP 4 — Test All Features
1. Scraper tab: Go to quotes.toscrape.com, select elements, scrape
2. Sheets tab: Connect Google, paste sheet URL, export
3. AI tab: Type "scrape all quotes", click Find Elements
4. Tracker tab: Scrape a price, track it
5. Schedule tab: Create auto-scrape schedule

## Revenue Model:
- Free: Scraper + CSV/JSON export (unlimited)
- Pro $9/mo: Google Sheets + AI Selector + Price Alerts + Scheduler
- Team $29/mo: Everything + 5 seats + priority support
