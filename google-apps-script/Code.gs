/**
 * Copy into the spreadsheet's Apps Script project (with ImageBrowser.html).
 * Full setup: ../GOOGLE_SHEETS_SETUP.md
 *
 * Script properties:
 *   GH_PAT          – fine-grained PAT, Actions: Read and write on CONTENT repo
 *   GH_OWNER        – GitHub user/org of the content repo
 *   GH_REPO         – content repo name
 *   GH_EVENT_TYPE   – optional, default rebuild-site
 *   DRIVE_FOLDER_ID – Google Drive folder id where pictures are uploaded
 */

var DEFAULT_EVENT_TYPE = 'rebuild-site';
var IMAGE_MIME_PREFIX = 'image/';

/**
 * Custom menu
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Site')
    .addItem('Browse Drive images', 'showDriveImageBrowser')
    .addItem('Publish website', 'publishWebsite')
    .addToUi();
}

/**
 * Assign to a Drawing / button: publishWebsite
 */
function publishWebsite() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('GH_PAT');
  var owner = props.getProperty('GH_OWNER');
  var repo = props.getProperty('GH_REPO');
  var eventType = props.getProperty('GH_EVENT_TYPE') || DEFAULT_EVENT_TYPE;

  if (!token || !owner || !repo) {
    ui.alert(
      'Missing script properties',
      'Set GH_PAT, GH_OWNER, and GH_REPO in Project Settings → Script properties.\nSee GOOGLE_SHEETS_SETUP.md.',
      ui.ButtonSet.OK
    );
    return;
  }

  var url = 'https://api.github.com/repos/' + owner + '/' + repo + '/dispatches';
  var payload = {
    event_type: eventType,
    client_payload: {
      source: 'google-sheets',
      spreadsheet_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
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
 * Assign to a Drawing / button: showDriveImageBrowser
 * Opens a sidebar: thumbnails + share URLs to copy into the image column.
 */
function showDriveImageBrowser() {
  var folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    SpreadsheetApp.getUi().alert(
      'Missing DRIVE_FOLDER_ID',
      'Set Script property DRIVE_FOLDER_ID to your public (or shared) Drive folder id.\n' +
        'Folder URL looks like: https://drive.google.com/drive/folders/FOLDER_ID\n' +
        'See GOOGLE_SHEETS_SETUP.md Part E.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  var html = HtmlService.createHtmlOutputFromFile('ImageBrowser')
    .setTitle('Drive images')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Called from ImageBrowser.html via google.script.run.
 * Returns [{id, name, shareUrl, fileIdUrl, previewUrl, shared}...]
 */
function listDriveImagesForBrowser() {
  var folderId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!folderId) {
    throw new Error('Script property DRIVE_FOLDER_ID is not set.');
  }

  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (err) {
    throw new Error('Cannot open folder ' + folderId + '. Check the id and that you can access it. ' + err);
  }

  var files = folder.getFiles();
  var items = [];
  while (files.hasNext()) {
    var file = files.next();
    var mime = file.getMimeType() || '';
    if (mime.indexOf(IMAGE_MIME_PREFIX) !== 0) {
      continue;
    }
    var id = file.getId();
    items.push({
      id: id,
      name: file.getName(),
      mime: mime,
      shareUrl: 'https://drive.google.com/file/d/' + id + '/view?usp=sharing',
      fileIdUrl: id,
      previewUrl: 'https://drive.google.com/thumbnail?id=' + id + '&sz=w240',
      shared: isAnyoneWithLink(file)
    });
  }

  items.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
  return {
    folderId: folderId,
    folderName: folder.getName(),
    count: items.length,
    items: items
  };
}

/**
 * Make one file Anyone with the link → Viewer (so GitHub Action can download it).
 */
function shareDriveFileAnyoneWithLink(fileId) {
  var file = DriveApp.getFileById(fileId);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    id: fileId,
    shared: true,
    shareUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing'
  };
}

/**
 * Make every image in the configured folder Anyone with the link → Viewer.
 */
function shareAllDriveImagesAnyoneWithLink() {
  var data = listDriveImagesForBrowser();
  var updated = 0;
  data.items.forEach(function (item) {
    if (!item.shared) {
      shareDriveFileAnyoneWithLink(item.id);
      updated++;
    }
  });
  return { updated: updated, total: data.count };
}

function isAnyoneWithLink(file) {
  try {
    var access = file.getSharingAccess();
    return (
      access === DriveApp.Access.ANYONE_WITH_LINK ||
      access === DriveApp.Access.ANYONE
    );
  } catch (err) {
    return false;
  }
}

/**
 * Paste the share URL into the active cell (or image column hint).
 */
function pasteShareUrlIntoActiveCell(shareUrl) {
  var cell = SpreadsheetApp.getActiveSpreadsheet().getActiveCell();
  cell.setValue(shareUrl);
  return { row: cell.getRow(), column: cell.getColumn(), value: shareUrl };
}

/**
 * One-time helper: run from the Apps Script editor to verify properties.
 */
function checkPublishConfig() {
  var props = PropertiesService.getScriptProperties();
  var keys = ['GH_PAT', 'GH_OWNER', 'GH_REPO', 'GH_EVENT_TYPE', 'DRIVE_FOLDER_ID'];
  var lines = keys.map(function (k) {
    var v = props.getProperty(k);
    if (k === 'GH_PAT') {
      return k + ': ' + (v ? 'set (' + v.length + ' chars)' : 'MISSING');
    }
    return k + ': ' + (v || 'MISSING');
  });
  Logger.log(lines.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}
