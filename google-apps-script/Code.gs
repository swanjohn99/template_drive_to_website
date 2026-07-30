/**
 * Copy this into the spreadsheet's Apps Script project.
 * Full setup steps: ../GOOGLE_SHEETS_SETUP.md
 *
 * Script properties required:
 *   GH_PAT          – fine-grained PAT with Actions: Read and write on the CONTENT repo
 *   GH_OWNER        – GitHub user/org that owns the content repo (e.g. swanjohn99)
 *   GH_REPO         – content repo name (e.g. my-site-content)
 *   GH_EVENT_TYPE   – optional, default rebuild-site (must match workflow repository_dispatch types)
 */

var DEFAULT_EVENT_TYPE = 'rebuild-site';

/**
 * Custom menu: Site → Publish website
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Site')
    .addItem('Publish website', 'publishWebsite')
    .addToUi();
}

/**
 * Assign this function to a Drawing / button on the sheet.
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
 * One-time helper: run from the Apps Script editor to verify properties exist.
 * Does not print the token.
 */
function checkPublishConfig() {
  var props = PropertiesService.getScriptProperties();
  var keys = ['GH_PAT', 'GH_OWNER', 'GH_REPO', 'GH_EVENT_TYPE'];
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
