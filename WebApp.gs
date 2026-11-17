// ╔══════════════════════════════════════════════════════════════════╗
// ║  ANNAPURNA WEB APP — Server Side v4.0 (GitHub Pages API)        ║
// ║                                                                  ║
// ║  Add this file to your Apps Script project as WebApp.gs          ║
// ║  Then Deploy > New Deployment > Web App                          ║
// ║  Set: Execute as "Me", Access "Anyone"                           ║
// ║                                                                  ║
// ║  v4.0: Added doPost() API endpoint for GitHub Pages frontend     ║
// ║        All existing functions unchanged                           ║
// ║        CORS headers for cross-origin fetch()                      ║
// ╚══════════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════════════════════════
// doGet — still serves old HTML if anyone uses the old link
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  // If called with ?action=... it's an API call from GitHub Pages (GET fallback)
  var action = e ? (e.parameter.action || '') : '';
  if (action) {
    return handleApiRequest(action, e.parameter);
  }
  // Otherwise serve the old embedded UI (backward compat)
  var template = HtmlService.createTemplateFromFile('WebAppUI');
  var page = e ? (e.parameter.page || 'home') : 'home';
  template.initialPage = page;
  return template.evaluate()
    .setTitle('🙏 Annapurna Kitchen')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}

// ══════════════════════════════════════════════════════════════
// doPost — API endpoint for GitHub Pages frontend
// All requests are JSON: { action: "...", ...params }
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || '';
    var result = handleApiRequest(action, payload);
    if (result && result.getMimeType) return result; // already ContentOutput
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ══════════════════════════════════════════════════════════════
// API ROUTER — dispatches to existing functions
// ══════════════════════════════════════════════════════════════
function handleApiRequest(action, params) {
  var result;
  switch (action) {
    case 'getMasterItems':
      result = getWebMasterItems();
      break;
    case 'getInventoryCounts':
      result = getWebInventoryCounts();
      break;
    case 'getCurrentInventory':
      result = getCurrentInventory();
      break;
    case 'saveItemCount':
      result = saveWebItemCount(params.itemName, params.qty, params.updatedBy);
      break;
    case 'saveNewItem':
      result = saveWebNewItem(params.itemName, params.unit, params.qty, params.notes, params.addedBy);
      break;
    case 'saveNewIngredient':
      result = saveWebNewIngredient(
        params.ingredientName, params.unit, params.qty,
        params.store, params.forDish, params.notes, params.addedBy
      );
      break;
    case 'saveCookingNeed':
      result = saveWebCookingNeed(
        params.dish, params.ingredient, params.qty,
        params.unit, params.cookSevak, params.day
      );
      break;
    default:
      result = { success: false, error: 'Unknown action: ' + action };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET MASTER ITEMS (for typeahead) ──
function getWebMasterItems() {
  var ss = SpreadsheetApp.getActive();
  var ms = ss.getSheetByName('Master_Items');
  if (!ms) return [];
  var data = ms.getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0] || '').trim();
    if (!name) continue;
    items.push({
      name: name, unit: String(data[i][1] || ''),
      brand: String(data[i][2] || ''), category: String(data[i][3] || ''),
      store: String(data[i][4] || '')
    });
  }
  items.sort(function(a, b) { return a.name.localeCompare(b.name); });
  return items;
}

// ── GET CURRENT INVENTORY COUNTS (all items from Inventory sheet) ──
function getWebInventoryCounts() {
  var ss = SpreadsheetApp.getActive();
  var ws = ss.getSheetByName('Inventory');
  if (!ws) return {};
  var data = ws.getDataRange().getValues();
  var counts = {};
  for (var i = 1; i < data.length; i++) {
    var item = String(data[i][0] || '').trim();
    var qty = data[i][4];  // Current Stock = col E
    if (item && !isHeaderRow(item) && qty !== '' && qty !== null && qty !== undefined) {
      counts[item] = { qty: Number(qty) || 0 };
    }
  }
  return counts;
}

// ── GET CURRENT INVENTORY (non-zero items for Stock view) ──
function getCurrentInventory() {
  var ss = SpreadsheetApp.getActive();
  var wsInv = ss.getSheetByName('Inventory');
  if (!wsInv) return { items: [], lastSynced: '' };
  var data = wsInv.getDataRange().getValues();
  var items = [];
  var lastSynced = '';
  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0] || '').trim();
    if (name.indexOf('Last synced') !== -1) { lastSynced = String(data[i][2] || ''); continue; }
    if (!name) continue;
    var stock = Number(data[i][4]) || 0;
    if (stock <= 0) continue;
    var par = data[i][5];
    var parNum = (par !== '' && par !== null && par !== undefined) ? Number(par) : null;
    items.push({
      name: name, unit: String(data[i][1] || ''),
      category: String(data[i][2] || ''), store: String(data[i][3] || ''),
      stock: stock, par: parNum,
      low: (parNum !== null && stock < parNum),
      lastUpdated: String(data[i][8] || '')
    });
  }
  var catOrder = ['Produce', 'Dairy', 'Grains & Rice', 'Grains & Bread',
                  'Lentils & Beans', 'Spices & Oils', 'Snacks & Misc', 'Supplies'];
  items.sort(function(a, b) {
    var ca = catOrder.indexOf(a.category); if (ca === -1) ca = 99;
    var cb = catOrder.indexOf(b.category); if (cb === -1) cb = 99;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name);
  });
  return { items: items, lastSynced: lastSynced };
}

// ══════════════════════════════════════════════════════════════
// SAVE ITEM COUNT — used by both Count tab and Stock tab
// Writes directly to unified Inventory sheet
// ══════════════════════════════════════════════════════════════
function saveWebItemCount(itemName, qty, updatedBy) {
  var ss = SpreadsheetApp.getActive();
  var ws = ss.getSheetByName('Inventory');
  if (!ws) return { success: false, error: 'Inventory sheet not found' };

  var data = ws.getDataRange().getValues();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');

  for (var i = 1; i < data.length; i++) {
    var name = String(data[i][0] || '').trim();
    if (name === itemName) {
      var row = i + 1;
      var oldQty = Number(data[i][4]) || 0;
      ws.getRange(row, 5).setValue(qty);                          // Current Stock
      ws.getRange(row, 9).setValue(now);                           // Last Updated
      ws.getRange(row, 10).setValue(updatedBy || 'Web App');       // Updated By
      return { success: true, row: row, oldQty: oldQty, newQty: qty };
    }
  }
  return { success: false, error: 'Item not found in Inventory: ' + itemName };
}

// ══════════════════════════════════════════════════════════════
// NEW ITEM — from IS (Inventory Walk)
// Store is blank — AIC fills it after promotion
// ══════════════════════════════════════════════════════════════
function saveWebNewItem(itemName, unit, qty, notes, addedBy) {
  var ss = SpreadsheetApp.getActive();
  var ws = ensureNewItemsSheet(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');

  var newRow = ws.getLastRow() + 1;
  ws.getRange(newRow, 1, 1, 10).setValues([[
    itemName,           // Item Name
    unit,               // Unit
    qty || '',          // Qty
    '',                 // Store (blank for IS — AIC fills later)
    'Inventory Walk',   // Source
    addedBy || '',      // Added By
    '',                 // For Dish
    notes || '',        // Notes
    now,                // Date Added
    ''                  // Status
  ]]);
  return { success: true, row: newRow };
}

// ══════════════════════════════════════════════════════════════
// NEW ITEM — from Cook (Cooking Needs)
// Store is provided by Cook
// ══════════════════════════════════════════════════════════════
function saveWebNewIngredient(ingredientName, unit, qty, store, forDish, notes, addedBy) {
  var ss = SpreadsheetApp.getActive();
  var ws = ensureNewItemsSheet(ss);
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');

  var newRow = ws.getLastRow() + 1;
  ws.getRange(newRow, 1, 1, 10).setValues([[
    ingredientName,     // Item Name
    unit,               // Unit
    qty || '',          // Qty
    store || '',        // Store
    'Cooking Needs',    // Source
    addedBy || '',      // Added By
    forDish || '',      // For Dish
    notes || '',        // Notes
    now,                // Date Added
    ''                  // Status
  ]]);
  return { success: true, row: newRow };
}

// ══════════════════════════════════════════════════════════════
// SAVE COOKING NEED — append-only
// ══════════════════════════════════════════════════════════════
function saveWebCookingNeed(dish, ingredient, qty, unit, cookSevak, day) {
  var ss = SpreadsheetApp.getActive();
  var ws = ss.getSheetByName('Cooking_Needs');
  if (!ws) return { success: false, error: 'Cooking_Needs sheet not found' };

  var data = ws.getDataRange().getValues();
  var insertRow = -1;

  for (var i = 2; i < data.length; i++) {
    var colA = String(data[i][0] || '').trim();
    var colB = String(data[i][1] || '').trim();
    if (colB.indexOf('Ingredient not in') !== -1) continue;
    if (!colA && !colB) { insertRow = i + 1; break; }
  }
  if (insertRow === -1) insertRow = ws.getLastRow() + 1;

  ws.getRange(insertRow, 1).setValue(dish);
  ws.getRange(insertRow, 2).setValue(ingredient);
  ws.getRange(insertRow, 3).setValue(qty);
  ws.getRange(insertRow, 4).setValue(unit);
  ws.getRange(insertRow, 5).setValue(cookSevak);
  ws.getRange(insertRow, 6).setValue(day);
  return { success: true, row: insertRow };
}

// ── ENSURE NEW_ITEMS SHEET ──
function ensureNewItemsSheet(ss) {
  var ws = ss.getSheetByName('New_Items');
  if (ws) return ws;

  ws = ss.insertSheet('New_Items');
  var headers = ['Item Name', 'Unit (guess)', 'Qty', 'Store', 'Source', 'Added By',
                 'For Dish', 'Notes', 'Date Added', 'Status'];
  ws.getRange(1, 1, 1, 10).setValues([headers]);
  ws.getRange(1, 1, 1, 10)
    .setBackground('#E74C3C').setFontColor('#FFFFFF')
    .setFontWeight('bold').setFontSize(11)
    .setFontFamily('Arial').setHorizontalAlignment('center');
  ws.setFrozenRows(1);
  var widths = [240, 100, 70, 100, 130, 120, 160, 200, 140, 100];
  widths.forEach(function(w, i) { ws.setColumnWidth(i + 1, w); });
  ws.getRange('A:J').setFontFamily('Arial').setFontSize(10);
  return ws;
}
