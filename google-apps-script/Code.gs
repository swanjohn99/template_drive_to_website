/**
 * Copy this into the spreadsheet's Apps Script project.
 * Full setup steps: ../GOOGLE_SHEETS_SETUP.md
 *
 * Script properties required:
 *   GH_PAT          – fine-grained PAT from the **web hosting repo owner**
 *                     (not the public template's owner — that is irrelevant)
 *                     Actions: Read and write on owner/owner.github.io only
 *   GH_REPO         – full URL of the hosting repo; MUST be owner.github.io
 *                     e.g. https://github.com/owner/owner.github.io
 *                     (also accepts owner/repo; rejected if name ≠ owner.github.io)
 *   GH_EVENT_TYPE   – optional, default rebuild-site (must match workflow repository_dispatch types)
 *   CONTENT_SHEET_NAME – optional, default "your website content" (tab with site rows)
 *
 * Legacy (optional if GH_REPO is only the repo name):
 *   GH_OWNER – user/org segment when GH_REPO is not a full URL
 *
 * Drive layout for Import Picture URLs:
 *   Parent folder
 *     ├─ this spreadsheet
 *     └─ Pictures/   (image files; Anyone with the link → Viewer)
 */

var DEFAULT_EVENT_TYPE = 'rebuild-site';
var CONTENT_SHEET_NAME = 'your website content';

/** Preferred header names for the image / URL column (first match wins). */
var PICTURE_URL_HEADERS = ['Picture URLs', 'image', 'Image', 'photo', 'Photo'];

/**
 * Custom menu: Import/Export → Import Picture URLs, Publish website
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Import/Export')
    .addItem('Import Picture URLs', 'populatePictureUrls')
    .addItem('Publish website', 'publishWebsite')
    .addToUi();
}

/**
 * Import image file URLs from a sibling Drive folder named "Pictures"
 * into the Picture URLs / image column (append only; no overwrite).
 */
function populatePictureUrls() {
  var ui = SpreadsheetApp.getUi();
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();

  var headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0];

  var urlColumnIndex = 0;
  for (var h = 0; h < PICTURE_URL_HEADERS.length; h++) {
    var idx = headers.indexOf(PICTURE_URL_HEADERS[h]);
    if (idx !== -1) {
      urlColumnIndex = idx + 1;
      break;
    }
  }

  if (urlColumnIndex === 0) {
    throw new Error(
      'Column "Picture URLs" / "image" not found. Add one of: ' +
        PICTURE_URL_HEADERS.join(', ')
    );
  }

  var file = DriveApp.getFileById(spreadsheet.getId());
  var parentFolders = file.getParents();
  if (!parentFolders.hasNext()) {
    throw new Error('Spreadsheet parent folder not found.');
  }
  var parentFolder = parentFolders.next();
  var folders = parentFolder.getFoldersByName('Pictures');
  if (!folders.hasNext()) {
    throw new Error('Folder "Pictures" not found.');
  }
  var picturesFolder = folders.next();
  var files = picturesFolder.getFiles();
  var urls = [];
  while (files.hasNext()) {
    var picture = files.next();
    if (picture.getMimeType().indexOf('image/') === 0) {
      urls.push([picture.getUrl()]);
    }
  }

  if (urls.length === 0) {
    ui.alert('No pictures found.');
    return;
  }

  var columnValues = sheet
    .getRange(2, urlColumnIndex, sheet.getMaxRows() - 1, 1)
    .getValues();
  var insertRow = 2;
  for (var i = 0; i < columnValues.length; i++) {
    if (columnValues[i][0] === '') {
      insertRow = i + 2;
      break;
    }
  }

  sheet.getRange(insertRow, urlColumnIndex, urls.length, 1).setValues(urls);

  ui.alert(
    urls.length + ' picture URLs imported starting at row ' + insertRow + '.'
  );
}

/**
 * Resolve {owner, repo} from GH_REPO (preferred: full URL) or legacy GH_OWNER + name.
 */
function resolveGithubRepo_(props) {
  var raw = (props.getProperty('GH_REPO') || '').trim();
  if (!raw) {
    return null;
  }

  var owner = '';
  var repo = '';

  var urlMatch = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)/i
  );
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2].replace(/\.git$/i, '');
  } else if (raw.indexOf('/') !== -1) {
    var parts = raw.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      owner = parts[0];
      repo = parts[1].replace(/\.git$/i, '');
    }
  } else {
    owner = props.getProperty('GH_OWNER') || '';
    repo = raw;
  }

  if (!owner || !repo) {
    return null;
  }
  return { owner: owner, repo: repo };
}

/**
 * Assign this function to a Drawing / button on the sheet.
 */
function publishWebsite() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GH_PAT');
  var target = resolveGithubRepo_(props);
  var eventType = props.getProperty('GH_EVENT_TYPE') || DEFAULT_EVENT_TYPE;

  if (!token || !target) {
    ui.alert(
      'Missing script properties',
      'Set GH_PAT and GH_REPO in Project Settings → Script properties.\n' +
        'GH_PAT = fine-grained PAT from the **hosting repo owner** (Actions R/W on that repo only).\n' +
        'GH_REPO = full URL, e.g. https://github.com/owner/owner.github.io\n' +
        'See GOOGLE_SHEETS_SETUP.md.',
      ui.ButtonSet.OK
    );
    return;
  }

  var owner = target.owner;
  var repo = target.repo;
  var expected = owner + '.github.io';
  if (repo.toLowerCase() !== expected.toLowerCase()) {
    ui.alert(
      'Wrong hosting repo',
      'Serving Pages requires the repo named "' + expected + '" (got "' + repo + '").\n' +
        'Copy the public template into that host. The template repo owner does not matter.',
      ui.ButtonSet.OK
    );
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = props.getProperty('CONTENT_SHEET_NAME') || CONTENT_SHEET_NAME;
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    ui.alert(
      'Sheet tab not found',
      'Create a tab named "' + sheetName + '" with your site rows (title, description, image, …).\n' +
        'Or set CONTENT_SHEET_NAME in Script properties to match your tab name.',
      ui.ButtonSet.OK
    );
    return;
  }
  var clientPayload = {
    source: 'google-sheets',
    spreadsheet_id: ss.getId(),
    sheet_gid: String(sheet.getSheetId()),
    triggered_by: Session.getActiveUser().getEmail() || 'unknown',
    triggered_at: new Date().toISOString()
  };

  // Inline CSV avoids configuring spreadsheet_id in the hosting repo.
  // GitHub dispatch body limit is ~64 KB; fall back to id+gid fetch when too large.
  var csvB64 = sheetDataToCsvBase64(sheet);
  if (csvB64) {
    clientPayload.sheet_csv_b64 = csvB64;
  }

  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/dispatches';
  var payload = {
    event_type: eventType,
    client_payload: clientPayload
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'google-sheets-publish-website'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code === 204 || code === 200) {
    ui.alert(
      'Publish started',
      'GitHub Action queued on ' + owner + '/' + repo + '.\n' +
        'Check: https://github.com/' + owner + '/' + repo + '/actions',
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert(
    'Publish failed (' + code + ')',
    response.getContentText().substring(0, 1500),
    ui.ButtonSet.OK
  );
}

/**
 * Serialize the sheet as base64 CSV, or null if empty / too large for dispatch.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @return {string|null}
 */
function sheetDataToCsvBase64(sheet) {
  var data = sheet.getDataRange().getValues();
  if (!data.length) {
    return null;
  }

  var lines = data.map(function (row) {
    return row.map(function (cell) {
      var s = cell == null ? '' : String(cell);
      if (/[",\n\r]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  });

  var csv = lines.join('\n');
  var bytes = Utilities.newBlob(csv).getBytes();
  if (bytes.length > 45000) {
    return null;
  }
  return Utilities.base64Encode(bytes);
}

/**
 * One-time helper: run from the Apps Script editor to verify properties exist.
 * Does not print the token.
 */
function checkPublishConfig() {
  var props = PropertiesService.getScriptProperties();
  var target = resolveGithubRepo_(props);
  var sheetName = props.getProperty('CONTENT_SHEET_NAME') || CONTENT_SHEET_NAME;
  var lines = [
    'GH_PAT: ' + (props.getProperty('GH_PAT')
      ? 'set (' + props.getProperty('GH_PAT').length + ' chars) — hosting repo owner'
      : 'MISSING'),
    'GH_REPO: ' + (props.getProperty('GH_REPO') || 'MISSING'),
    'resolved: ' + (target ? target.owner + '/' + target.repo : 'MISSING'),
    'GH_EVENT_TYPE: ' + (props.getProperty('GH_EVENT_TYPE') || DEFAULT_EVENT_TYPE + ' (default)'),
    'CONTENT_SHEET_NAME: ' + sheetName
  ];
  Logger.log(lines.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
