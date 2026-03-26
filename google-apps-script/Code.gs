/**
 * Netlify + Apps Script document intake backend
 *
 * Script Properties:
 * - SPREADSHEET_ID
 * - RESPONSES_SHEET_NAME         optional, defaults to Responses
 * - UPLOAD_FOLDER_ID             optional, enables file uploads
 * - ADMIN_KEY                    required for admin dashboard / CSV export
 * - ALLOWED_FILE_TYPES           optional comma-separated MIME types
 * - MAX_FILE_SIZE_BYTES          optional, defaults to 4194304
 */

function doGet(e) {
  e = e || { parameter: {} };
  var action = String((e.parameter && e.parameter.action) || '').trim();

  try {
    if (action === 'exportCsv') {
      var adminKey = String((e.parameter && e.parameter.adminKey) || '').trim();
      requireAdmin_(adminKey);
      return csvOutput_(buildCsv_());
    }

    return jsonOutput_({
      ok: true,
      message: 'Document intake backend is running.',
      uploadEnabled: !!getConfig_().uploadFolderId,
    });
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(payload.action || 'submit').trim();

    if (action === 'submit') return handleSubmit_(payload);
    if (action === 'adminLogin') return handleAdminLogin_(payload);
    if (action === 'listResponses') return handleListResponses_(payload);

    return jsonOutput_({ ok: false, message: 'Unsupported action.' });
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function handleSubmit_(payload) {
  var config = getConfig_();
  var row = sanitizeSubmission_(payload);
  enforceSpamChecks_(row, payload);

  var upload = saveAttachmentIfPresent_(payload.attachment, config);
  var intake = evaluateIntake_(row, upload);
  var intakeId = makeIntakeId_();
  var sheet = getResponseSheet_(config);

  sheet.appendRow([
    new Date(),
    intakeId,
    intake.status,
    intake.resultLabel,
    intake.deficiencyReason,
    row.documentTitle,
    row.documentType,
    row.name,
    row.email,
    row.agency,
    row.sex,
    row.purpose,
    row.signedRequest ? 'YES' : 'NO',
    row.validId ? 'YES' : 'NO',
    row.supportingDocs ? 'YES' : 'NO',
    upload.fileName,
    upload.fileUrl,
    row.userAgent,
    ''
  ]);

  markSubmissionFingerprint_(row, payload);

  return jsonOutput_({
    ok: true,
    status: intake.status,
    intakeId: intakeId,
    message: intake.status === 'ACCEPTED' ? 'Document passed intake screening and was accepted for processing. Reference: ' + intakeId + '.' : intake.publicMessage,
    fileUrl: upload.fileUrl || '',
    deficiencyReason: intake.deficiencyReason,
  });
}

function handleAdminLogin_(payload) {
  requireAdmin_(payload.adminKey);
  return jsonOutput_({ ok: true, message: 'Admin access granted.' });
}

function handleListResponses_(payload) {
  requireAdmin_(payload.adminKey);
  var config = getConfig_();
  var sheet = getResponseSheet_(config);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return jsonOutput_({ ok: true, rows: [], stats: emptyStats_() });
  }

  var headers = values[0];
  var rows = [];
  var todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var stats = { total: 0, accepted: 0, rejected: 0, withFiles: 0, today: 0, recentAgency: '—' };

  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    var ts = obj.Timestamp ? new Date(obj.Timestamp) : null;
    var tsLabel = ts && !isNaN(ts) ? Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : '';
    var status = String(obj.Status || '');
    var fileUrl = String(obj.File_URL || '');

    rows.push({
      rowNumber: i + 1,
      timestamp: tsLabel,
      intakeId: String(obj.Intake_ID || ''),
      status: status,
      deficiencyReason: String(obj.Deficiency_Reason || ''),
      documentTitle: String(obj.Document_Title || ''),
      documentType: String(obj.Document_Type || ''),
      name: String(obj.Name || ''),
      email: String(obj.Email || ''),
      agency: String(obj.Agency || ''),
      sex: String(obj.Sex || ''),
      purpose: String(obj.Purpose || ''),
      signedRequest: String(obj.Signed_Request || ''),
      validId: String(obj.Valid_ID || ''),
      supportingDocs: String(obj.Supporting_Docs || ''),
      fileName: String(obj.File_Name || ''),
      fileUrl: fileUrl,
    });

    stats.total++;
    if (status === 'ACCEPTED') stats.accepted++;
    else stats.rejected++;
    if (fileUrl) stats.withFiles++;
    if (tsLabel && tsLabel.slice(0, 10) === todayKey) stats.today++;
    if (obj.Agency) stats.recentAgency = String(obj.Agency);
  }

  rows.reverse();
  return jsonOutput_({ ok: true, rows: rows, stats: stats });
}

function sanitizeSubmission_(payload) {
  var row = {
    documentTitle: cleanText_(payload.documentTitle, 180),
    documentType: cleanText_(payload.documentType, 80),
    name: cleanText_(payload.name, 120),
    email: cleanText_(payload.email, 150).toLowerCase(),
    agency: cleanText_(payload.agency, 150),
    sex: cleanText_(payload.sex, 40),
    purpose: cleanText_(payload.purpose, 2000),
    signedRequest: toBoolean_(payload.signedRequest),
    validId: toBoolean_(payload.validId),
    supportingDocs: toBoolean_(payload.supportingDocs),
    website: cleanText_(payload.website, 200),
    userAgent: cleanText_(payload.userAgent, 500),
    formStartedAt: Number(payload.formStartedAt || 0)
  };

  if (!row.documentTitle || !row.documentType || !row.name || !row.email || !row.agency || !row.sex || !row.purpose) {
    throw new Error('All core intake fields are required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    throw new Error('Invalid email format.');
  }

  if (['male', 'female', 'prefer not to say'].indexOf(String(row.sex).toLowerCase()) === -1) {
    throw new Error('Invalid sex value.');
  }

  return row;
}

function evaluateIntake_(row, upload) {
  var deficiencies = [];
  if (!row.signedRequest) deficiencies.push('signed request missing');
  if (!row.validId) deficiencies.push('valid ID missing');
  if (!row.supportingDocs) deficiencies.push('supporting documents incomplete');
  if (!upload.fileUrl) deficiencies.push('attachment missing');

  if (deficiencies.length) {
    return {
      status: 'REJECTED_INTAKE',
      resultLabel: 'Not accepted for processing',
      deficiencyReason: capitalizeReasonList_(deficiencies),
      publicMessage: 'Document was logged but not accepted for processing. Deficiency noted: ' + capitalizeReasonList_(deficiencies) + '.',
    };
  }

  return {
    status: 'ACCEPTED',
    resultLabel: 'Accepted for processing',
    deficiencyReason: '',
    publicMessage: 'Document passed intake screening and was accepted for processing. Reference: ' + makeShortReference_() + '.',
  };
}

function enforceSpamChecks_(row, payload) {
  if (row.website) throw new Error('Spam submission blocked.');

  var filledMs = Date.now() - Number(row.formStartedAt || 0);
  if (!row.formStartedAt || filledMs < 3000) {
    throw new Error('Submission blocked by anti-spam timer.');
  }

  var cache = CacheService.getScriptCache();
  var fingerprint = submissionFingerprint_(row, payload);
  if (cache.get(fingerprint)) {
    throw new Error('Duplicate or too-frequent submission blocked. Please wait before trying again.');
  }
}

function markSubmissionFingerprint_(row, payload) {
  var cache = CacheService.getScriptCache();
  cache.put(submissionFingerprint_(row, payload), '1', 60 * 5);
}

function submissionFingerprint_(row, payload) {
  var base = [
    row.documentTitle,
    row.email,
    row.agency,
    row.userAgent,
    payload && payload.attachment ? payload.attachment.fileName : ''
  ].join('|');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base);
  return 'submit:' + Utilities.base64EncodeWebSafe(digest);
}

function saveAttachmentIfPresent_(attachment, config) {
  if (!attachment) return { fileName: '', fileUrl: '' };
  if (!config.uploadFolderId) throw new Error('Upload folder is not configured on the backend.');

  var fileName = cleanText_(attachment.fileName, 200);
  var mimeType = cleanText_(attachment.mimeType, 120);
  var dataUrl = String(attachment.dataUrl || '');
  var size = Number(attachment.size || 0);

  if (!fileName || !mimeType || !dataUrl) throw new Error('Invalid attachment payload.');
  if (size <= 0 || size > config.maxFileSizeBytes) throw new Error('Attachment exceeds the allowed file size.');
  if (config.allowedFileTypes.indexOf(mimeType) === -1) throw new Error('Attachment type is not allowed.');

  var base64 = dataUrl.split(',')[1] || '';
  if (!base64) throw new Error('Attachment data is invalid.');

  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var folder = DriveApp.getFolderById(config.uploadFolderId);
  var saved = folder.createFile(blob);

  return {
    fileName: saved.getName(),
    fileUrl: saved.getUrl()
  };
}

function getResponseSheet_(config) {
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(config.sheetName);
    sheet.appendRow([
      'Timestamp',
      'Intake_ID',
      'Status',
      'Intake_Result',
      'Deficiency_Reason',
      'Document_Title',
      'Document_Type',
      'Name',
      'Email',
      'Agency',
      'Sex',
      'Purpose',
      'Signed_Request',
      'Valid_ID',
      'Supporting_Docs',
      'File_Name',
      'File_URL',
      'User_Agent',
      'Review_Note'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function requireAdmin_(adminKey) {
  var expected = getConfig_().adminKey;
  if (!expected) throw new Error('ADMIN_KEY is not configured in Script Properties.');
  if (String(adminKey || '').trim() !== expected) throw new Error('Unauthorized admin request.');
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
    sheetName: props.getProperty('RESPONSES_SHEET_NAME') || 'Responses',
    uploadFolderId: props.getProperty('UPLOAD_FOLDER_ID') || '',
    adminKey: props.getProperty('ADMIN_KEY') || '',
    maxFileSizeBytes: Number(props.getProperty('MAX_FILE_SIZE_BYTES') || 4194304),
    allowedFileTypes: String(props.getProperty('ALLOWED_FILE_TYPES') || 'application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(',')
  };
}

function setupProject_() {
  var config = getConfig_();
  if (!config.spreadsheetId || config.spreadsheetId === 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE') {
    throw new Error('Set SPREADSHEET_ID in Script Properties first.');
  }
  getResponseSheet_(config);
  return 'Setup complete.';
}

function buildCsv_() {
  var config = getConfig_();
  var sheet = getResponseSheet_(config);
  var values = sheet.getDataRange().getDisplayValues();
  return values.map(function(row) {
    return row.map(csvEscape_).join(',');
  }).join('\r\n');
}

function csvEscape_(value) {
  var s = String(value == null ? '' : value);
  return '"' + s.replace(/"/g, '""') + '"';
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) obj[String(headers[i])] = row[i];
  return obj;
}

function emptyStats_() {
  return { total: 0, accepted: 0, rejected: 0, withFiles: 0, today: 0, recentAgency: '—' };
}

function makeIntakeId_() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var suffix = Math.floor(Math.random() * 9000) + 1000;
  return 'INT-' + stamp + '-' + suffix;
}

function makeShortReference_() {
  return Utilities.getUuid().slice(0, 8).toUpperCase();
}

function capitalizeReasonList_(items) {
  if (!items || !items.length) return '';
  var joined = items.join('; ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

function toBoolean_(value) {
  return value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes';
}

function cleanText_(value, maxLen) {
  var out = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return maxLen ? out.slice(0, maxLen) : out;
}

function errorMessage_(err) {
  return err && err.message ? err.message : 'Unexpected server error.';
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function csvOutput_(csvText) {
  return ContentService.createTextOutput(csvText).setMimeType(ContentService.MimeType.CSV);
}
