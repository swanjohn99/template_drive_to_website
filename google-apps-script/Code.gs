/**
 * Copy this into the spreadsheet's Apps Script project.
 * Full setup steps: ../GOOGLE_SHEETS_SETUP.md
 *
 * Script properties required:
 *   GH_PAT          – PAT that can start Actions on this repo (usually contributor account;
 *                     that account must be a Write collaborator — see GOOGLE_SHEETS_SETUP.md Part 0)
 *   GH_REPO         – full URL of the template copy / website host
 *                     e.g. https://github.com/owner/username.github.io
 *                     (also accepts owner/repo)
 *   GH_EVENT_TYPE   – optional, default rebuild-site (must match workflow repository_dispatch types)
 *
 * Legacy (optional if GH_REPO is only the repo name):
 *   GH_REPO_OWNER / GH_OWNER – user/org segment when GH_REPO is not a full URL
 *
 * Drive layout for Import Picture URLs:
 *   Parent folder
 *     ├─ this spreadsheet
 *     └─ Pictures/   (image files; Anyone with the link → Viewer)
 */

var DEFAULT_EVENT_TYPE = 'rebuild-site';

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
    ui.alert(
      'Column not found',
      'Need a header named "Picture URLs" or "image" in row 1.',
      ui.ButtonSet.OK
    );
    return;
  }

  var file = DriveApp.getFileById(spreadsheet.getId());
  var parentFolders = file.getParents();

  if (!parentFolders.hasNext()) {
    ui.alert(
      'Folder not found',
      'Spreadsheet parent folder not found. Put the sheet inside a Drive folder.',
      ui.ButtonSet.OK
    );
    return;
  }

  var parentFolder = parentFolders.next();
  var folders = parentFolder.getFoldersByName('Pictures');

  if (!folders.hasNext()) {
    ui.alert(
      'Pictures folder not found',
      'Create a folder named "Pictures" next to this spreadsheet in Drive.',
      ui.ButtonSet.OK
    );
    return;
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

  var lastRow = Math.max(sheet.getLastRow(), 1);
  var numRows = Math.max(sheet.getMaxRows() - 1, 1);
  var columnValues = sheet.getRange(2, urlColumnIndex, numRows, 1).getValues();

  var insertRow = lastRow + 1;
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
 * Assign this function to a Drawing / button on the sheet.
 */

/**
 * Resolve {owner, repo} from GH_REPO (preferred: full URL) or legacy split props.
 * GH_PAT is usually from a contributor; owner/repo always come from the repo URL.
 */
function resolveGithubRepo_(props) {
  var raw = (props.getProperty('GH_REPO') || '').trim();
  if (!raw) {
    return null;
  }

  var owner = '';
  var repo = '';

  // Full URL or host path: https://github.com/owner/repo[.git][/...]
  var urlMatch = raw.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^\/\s]+)\/([^\/\s?#]+)/i
  );
  if (urlMatch) {
    owner = urlMatch[1];
    repo = urlMatch[2].replace(/\.git$/i, '');
  } else if (raw.indexOf('/') !== -1) {
    // owner/repo shorthand
    var parts = raw.replace(/^\/+|\/+$/g, '').split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      owner = parts[0];
      repo = parts[1].replace(/\.git$/i, '');
    }
  } else {
    // Legacy: repo name only + GH_REPO_OWNER / GH_OWNER
    owner = props.getProperty('GH_REPO_OWNER') || props.getProperty('GH_OWNER') || '';
    repo = raw;
  }

  if (!owner || !repo) {
    return null;
  }
  return { owner: owner, repo: repo };
}

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
        'GH_REPO should be the full URL, e.g. https://github.com/owner/repo\n' +
        '(Legacy: GH_REPO as name only + GH_REPO_OWNER / GH_OWNER still works.)\n' +
        'See GOOGLE_SHEETS_SETUP.md.',
      ui.ButtonSet.OK
    );
    return;
  }

  var owner = target.owner;
  var repo = target.repo;

  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/dispatches';
  var payload = {
    event_type: eventType,
    client_payload: {
      source: 'google-sheets',
      spreadsheet_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
      sheet_gid: String(SpreadsheetApp.getActiveSheet().getSheetId()),
      triggered_by: Session.getActiveUser().getEmail() || 'unknown',
      triggered_at: new Date().toISOString()
    }
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
 * One-time helper: run from the Apps Script editor to verify properties exist.
 * Does not print the token.
 */
function checkPublishConfig() {
  var props = PropertiesService.getScriptProperties();
  var target = resolveGithubRepo_(props);
  var lines = [
    'GH_PAT: ' + (props.getProperty('GH_PAT')
      ? 'set (' + props.getProperty('GH_PAT').length + ' chars) — usually contributor account'
      : 'MISSING'),
    'GH_REPO: ' + (props.getProperty('GH_REPO') || 'MISSING'),
    'resolved: ' + (target ? target.owner + '/' + target.repo : 'MISSING'),
    'GH_EVENT_TYPE: ' + (props.getProperty('GH_EVENT_TYPE') || DEFAULT_EVENT_TYPE + ' (default)')
  ];
  Logger.log(lines.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
