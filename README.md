# 🙏 Annapurna Kitchen Inventory

A mobile-first web app for community kitchen inventory management. Hosted on GitHub Pages with Google Sheets as the backend.

## Architecture

```
GitHub Pages (index.html)  ──fetch()──▶  Apps Script (doPost)  ──▶  Google Sheets
     Static frontend                         API router                 Database
```

## Features

- **📋 Inventory Count** — Walk the kitchen and count items
- **🍳 Cooking Needs** — Log ingredients needed for upcoming meals
- **📦 Stock View** — Live inventory with low-stock alerts and tap-to-update
- **New Item Discovery** — Add items not yet in Master list (goes to New_Items inbox)
- **Typeahead Search** — Fast search across all master items
- **Category Chips** — Filter by Produce, Dairy, Spices, etc.
- **Name Persistence** — Your name saved across sessions via localStorage

## Setup Instructions

### 1. Update Apps Script

Replace the contents of `WebApp.gs` in your Apps Script project with the new version from this repo. The key addition is the `doPost()` function that lets the external frontend talk to your spreadsheet.

### 2. Deploy the Web App

In Apps Script:
1. **Deploy → New deployment** (or Manage deployments → Edit)
2. Set **Execute as**: Me
3. Set **Who has access**: Anyone
4. Click **Deploy** and copy the URL (looks like `https://script.google.com/macros/s/.../exec`)

> ⚠️ Every time you edit the script, you must create a **new deployment** (not just save) for changes to take effect.

### 3. Enable GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set Source: **Deploy from a branch**, Branch: **main**, Folder: **/ (root)**
4. Your site will be live at `https://<username>.github.io/annapurna-kitchen/`

### 4. Custom Domain (Optional)

To use `annapurna.aboutu.tech` or similar:

1. In repo Settings → Pages → Custom domain, enter: `annapurna.aboutu.tech`
2. In your DNS provider, add a CNAME record:
   - **Name**: `annapurna`
   - **Value**: `<username>.github.io`
3. Check "Enforce HTTPS" once DNS propagates (~10 min)

### 5. First-Time Use

When users first open the app, they'll see a one-time setup screen asking for the Apps Script URL. Paste the deployment URL from Step 2 and tap **Connect**. This is stored in localStorage so they only do it once per device.

## Files

| File | Where | Purpose |
|------|-------|---------|
| `index.html` | GitHub Pages | The entire frontend — HTML, CSS, JS in one file |
| `WebApp.gs` | Apps Script | Server-side API (doPost router + all existing functions) |
| `README.md` | GitHub | This file |

## How the API Works

The frontend sends JSON POST requests to the Apps Script URL:

```json
{ "action": "getMasterItems" }
{ "action": "saveItemCount", "itemName": "Rice Basmati", "qty": 5, "updatedBy": "Ravi" }
{ "action": "getCurrentInventory" }
```

Apps Script's `doPost()` routes each action to the existing function and returns JSON.

## Roles

| Role | What they do |
|------|--------------|
| **IS (Inventory Sevak)** | Counts items using the Count tab |
| **Cook** | Logs cooking needs and new ingredients |
| **SS (Shopping Sevak)** | Uses the generated shopping list (in Sheets) |
| **AIC (Admin)** | Promotes new items, generates shopping lists, manages Master |
