function doPost(e) {
  try {
    var spreadsheetId = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
    var sheetName = 'Responses';

    var payload = JSON.parse(e.postData.contents || '{}');

    var name = String(payload.name || '').trim();
    var email = String(payload.email || '').trim();
    var agency = String(payload.agency || '').trim();
    var sex = String(payload.sex || '').trim();
    var purpose = String(payload.purpose || '').trim();

    if (!name || !email || !agency || !sex || !purpose) {
      return jsonOutput_({
        ok: false,
        message: 'All fields are required.'
      });
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet "' + sheetName + '" not found.');

    sheet.appendRow([
      new Date(),
      name,
      email,
      agency,
      sex,
      purpose
    ]);

    return jsonOutput_({
      ok: true,
      message: 'Saved successfully.'
    });
  } catch (err) {
    return jsonOutput_({
      ok: false,
      message: err && err.message ? err.message : 'Unexpected server error.'
    });
  }
}

function doGet() {
  return jsonOutput_({
    ok: true,
    message: 'Apps Script backend is running.'
  });
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
