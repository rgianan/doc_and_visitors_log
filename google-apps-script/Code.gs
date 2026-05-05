/**
 * Document intake backend.
 *
 * Script Properties:
 * - SPREADSHEET_ID
 * - RESPONSES_SHEET_NAME      optional, defaults to Responses
 * - AUDIT_SHEET_NAME          optional, defaults to Audit
 * - ADMIN_KEY                 required for admin dashboard / CSV export / printing
 * - DOC_TEMPLATE_ID           required for print button (Google Doc template)
 * - PRINT_OUTPUT_FOLDER_ID    optional, folder to store generated docs
 * - SUBMIT_SHARED_TOKEN       optional; if set, must match the value the client sends in submitToken
 * - TURNSTILE_SECRET_KEY      optional; if set, the client's turnstileToken is verified against Cloudflare
 */

var ADMIN_FAILED_CACHE_KEY = 'admin:failed_attempts';
var ADMIN_LOCKOUT_CACHE_KEY = 'admin:lockout';
var ADMIN_MAX_ATTEMPTS = 5;
var ADMIN_LOCKOUT_SECONDS = 15 * 60;
var ADMIN_FAIL_WINDOW_SECONDS = 15 * 60;

function doGet(e) {
  e = e || { parameter: {} };
  var action = String((e.parameter && e.parameter.action) || '').trim();
  try {
    if (action === 'exportCsv') {
      requireAdmin_(String((e.parameter && e.parameter.adminKey) || '').trim());
      auditLog_('export_csv', 'ok', '');
      return csvOutput_(buildCsv_());
    }
    return jsonOutput_({ ok: true, message: 'Document intake backend is running.', mode: 'declared_checklist_with_email_and_print' });
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = String(payload.action || '').trim();
    if (action === 'submit') return handleSubmit_(payload);
    if (action === 'adminLogin') return handleAdminLogin_(payload);
    if (action === 'listResponses') return handleListResponses_(payload);
    if (action === 'printRecord') return handlePrintRecord_(payload);
    if (action === 'updateDeficiency') return handleUpdateDeficiency_(payload);
    throw new Error('Unsupported action.');
  } catch (err) {
    return jsonOutput_({ ok: false, message: errorMessage_(err) });
  }
}

function handleSubmit_(payload) {
  payload = payload || {};
  verifySubmitToken_(payload.submitToken);
  verifyTurnstile_(payload.turnstileToken);
  var row = sanitizeSubmission_(payload);
  enforceSpamChecks_(row, payload);

  var rule = getRequestTypeRule_(row.requestTypeCode);
  var intakeId = makeIntakeId_();
  var intake = evaluateIntake_(row, rule, row.declaredDocCodes);
  var timestamp = new Date();
  var sheet = getResponseSheet_(getConfig_());

  var emailResult = sendClientEmailSafe_({
    timestamp: timestamp,
    intakeId: intakeId,
    status: intake.status,
    requestTypeLabel: rule.label,
    requester: row.name,
    institutionType: row.institutionType,
    declaredDocLabels: intake.declaredDocLabels,
    missingDocLabels: intake.missingDocLabels,
    deficiencyReason: intake.deficiencyReason,
    email: row.email
  });

  sheet.appendRow([
    timestamp,
    intakeId,
    row.requestTypeCode,
    rule.label,
    intake.status,
    intake.resultLabel,
    intake.deficiencyReason,
    intake.missingDocCodes.join('|'),
    intake.missingDocLabels.join('; '),
    intake.declaredDocCodes.join('|'),
    intake.declaredDocLabels.join('; '),
    row.documentTitle,
    row.name,
    row.email,
    row.agency,
    row.institutionType,
    row.purpose,
    row.othersDescription,
    row.userAgent,
    emailResult.sent ? 'YES' : 'NO',
    emailResult.error || '',
    ''
  ]);

  markSubmissionFingerprint_(row, payload || {});

  return jsonOutput_({
    ok: true,
    status: intake.status,
    intakeId: intakeId,
    message: intake.publicMessage + (emailResult.sent ? ' A copy of the intake result was sent to your email.' : ' The intake result was logged, but the confirmation email could not be sent at this time.'),
    deficiencyReason: intake.deficiencyReason,
    missingDocLabels: intake.missingDocLabels,
    declaredDocLabels: intake.declaredDocLabels,
  });
}

function handleAdminLogin_(payload) {
  requireAdmin_(payload.adminKey);
  auditLog_('admin_login_success', 'ok', '');
  return jsonOutput_({ ok: true, message: 'Admin access granted.' });
}

function handleListResponses_(payload) {
  requireAdmin_(payload.adminKey);
  var config = getConfig_();
  var sheet = getResponseSheet_(config);
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) return jsonOutput_({ ok: true, rows: [], stats: emptyStats_() });

  var headers = values[0];
  var rows = [];
  var todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var stats = emptyStats_();

  for (var i = 1; i < values.length; i++) {
    var obj = rowToObject_(headers, values[i]);
    var ts = obj.Timestamp ? new Date(obj.Timestamp) : null;
    var tsLabel = ts && !isNaN(ts) ? Utilities.formatDate(ts, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : '';
    var status = String(obj.Status || '');

    rows.push({
      rowNumber: i + 1,
      timestamp: tsLabel,
      intakeId: String(obj.Intake_ID || ''),
      requestTypeCode: String(obj.Request_Type_Code || ''),
      requestTypeLabel: String(obj.Request_Type_Label || ''),
      status: status,
      deficiencyReason: String(obj.Deficiency_Reason || ''),
      documentTitle: String(obj.Document_Title || ''),
      name: String(obj.Name || ''),
      email: String(obj.Email || ''),
      agency: String(obj.Agency || ''),
      institutionType: String(obj.Institution_Type || ''),
      purpose: String(obj.Purpose || ''),
      missingDocLabels: String(obj.Missing_Doc_Labels || ''),
      declaredDocLabels: String(obj.Declared_Doc_Labels || ''),
    });

    stats.total++;
    if (status === 'ACCEPTED') stats.accepted++;
    else if (status === 'FOR_MANUAL_REVIEW') stats.manualReview++;
    else stats.rejected++;
    if (tsLabel && tsLabel.slice(0, 10) === todayKey) stats.today++;
    if (obj.Request_Type_Label) stats.recentRequestType = String(obj.Request_Type_Label);
  }

  rows.reverse();
  return jsonOutput_({ ok: true, rows: rows, stats: stats });
}

function handlePrintRecord_(payload) {
  requireAdmin_(payload.adminKey);
  var intakeId = cleanText_(payload.intakeId, 80);
  if (!intakeId) throw new Error('Missing intake ID.');

  var record = getRecordByIntakeId_(intakeId);
  if (!record) throw new Error('Intake record not found.');

  var out = generatePrintDoc_(record);
  auditLog_('print_record', 'ok', intakeId);
  return jsonOutput_({
    ok: true,
    message: 'Print PDF generated.',
    docUrl: out.docUrl,
    docId: out.docId,
    pdfFileId: out.pdfFileId,
    pdfUrl: out.pdfUrl,
    pdfViewUrl: out.pdfViewUrl
  });
}

function sanitizeSubmission_(payload) {
  var row = {
    requestTypeCode: cleanText_(payload.requestTypeCode, 60),
    documentTitle: cleanText_(payload.documentTitle, 180),
    name: cleanText_(payload.name, 120),
    email: cleanText_(payload.email, 150).toLowerCase(),
    agency: cleanText_(payload.agency, 150),
    institutionType: cleanText_(payload.institutionType, 40),
    purpose: cleanText_(payload.purpose, 2000),
    othersDescription: cleanText_(payload.othersDescription, 2000),
    website: cleanText_(payload.website, 200),
    userAgent: cleanText_(payload.userAgent, 500),
    formStartedAt: Number(payload.formStartedAt || 0),
    declaredDocCodes: sanitizeDeclaredDocCodes_(payload.declaredDocCodes)
  };

  if (!row.requestTypeCode || !row.documentTitle || !row.name || !row.email || !row.agency || !row.institutionType || !row.purpose) {
    throw new Error('All core intake fields are required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('Invalid email format.');
  if (['Private', 'SUC', 'LUC'].indexOf(row.institutionType) === -1) throw new Error('Invalid institution type.');
  if (row.requestTypeCode === 'OTHERS' && !row.othersDescription) throw new Error('Others description is required.');
  if (!row.declaredDocCodes.length) throw new Error('At least one documentary checklist item must be checked.');

  getRequestTypeRule_(row.requestTypeCode);
  return row;
}

function sanitizeDeclaredDocCodes_(value) {
  var list = Array.isArray(value) ? value : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var code = cleanText_(list[i], 80);
    if (!code || seen[code]) continue;
    seen[code] = true;
    out.push(code);
  }
  return out;
}

function getRequestTypeRule_(requestTypeCode) {
  var rules = requestTypeRules_();
  var rule = rules[requestTypeCode];
  if (!rule) throw new Error('Unknown request type.');
  return rule;
}

function requestTypeRules_() {
  return {
    SIAP_PHASE_1: {
      label: 'SIAP Phase 1',
      docs: [
        { code: 'LOI_NOTARIZED', label: 'Duly notarized letter of intent', required: true },
        { code: 'GR_COPC', label: 'Government Recognition / COPC', required: true },
        { code: 'ACCREDITATION_CERT', label: 'Valid Accreditation Certificate', required: true },
        { code: 'CHED_CURRICULUM', label: 'Latest CHED-approved / acknowledged curriculum', required: true },
        { code: 'MOA_HEI_FHE', label: 'MOA between HEI and FHE/O', required: true },
        { code: 'FHE_AFFIDAVIT', label: 'Original affidavit of FHE/O registration', required: true },
        { code: 'INITIAL_VISIT_PROOF', label: 'Proof of initial visit / inspection', required: true },
        { code: 'INTERNSHIP_PLAN_CONTRACT', label: 'Internship Plan with sample Internship Contract', required: true },
        { code: 'CONTINGENCY_PLAN', label: 'Contingency Plan', required: true },
        { code: 'SUC_BOARD_RESOLUTION', label: 'Board Resolution / Excerpts of Meeting (for SUCs only)', required: true, onlyInstitutionTypes: ['SUC'] }
      ],
      manualReview: false
    },
    SIAP_PHASE_2: {
      label: 'SIAP Phase 2',
      docs: [
        { code: 'CHEDRO_ENDORSEMENT', label: 'Endorsement Letter from CHEDRO', required: true },
        { code: 'APPLICATION_LETTER_WITH_STUDENT_LIST', label: 'Notarized Application Letter with student list', required: true },
        { code: 'ROUND_TRIP_ETICKET', label: 'Round-trip e-ticket', required: true },
        { code: 'INSURANCE_POLICY', label: 'Comprehensive Insurance Policy', required: true },
        { code: 'FHE_DIRECTORY', label: 'FHE/O Directory with place of stay details', required: true },
        { code: 'ORIENTATION_PROOF', label: 'Proof of orientation / pre-departure briefing', required: true },
        { code: 'PASSPORT_BIO_PAGE', label: 'Passport bio page with signature', required: true },
        { code: 'VISA_COPY', label: 'Appropriate visa copy', required: true },
        { code: 'MEDICAL_CERTIFICATE', label: 'Medical Certificate', required: true },
        { code: 'TOR_WITH_SEAL', label: 'Transcript of Records with seal', required: true },
        { code: 'REGISTRAR_CERTIFICATION', label: 'Registrar certification', required: true },
        { code: 'AFFIDAVIT_OF_CONSENT', label: 'Notarized affidavit of consent', required: true },
        { code: 'COVID19_VACC_CERT', label: 'COVID-19 Vaccination Certificate (if applicable)', required: false },
        { code: 'DESTINATION_SUPPORTING_DOCS', label: 'Other supporting documents required by destination country, if any', required: false }
      ],
      manualReview: false
    },
    CEM: {
      label: 'CEM',
      docs: [
        { code: 'APPLICATION_FORM', label: 'Duly accomplished application form', required: true },
        { code: 'HEI_ENDORSEMENT', label: 'Letter / Indorsement from the HEI', required: true },
        { code: 'PASSPORT_COPY', label: 'Photocopy of Passport', required: true },
        { code: 'TOR_CERTIFIED_TRUE_COPY', label: 'Certified True Copy of Transcript of Records', required: true },
        { code: 'DIPLOMA_OR_CERT_GRADUATION', label: 'Diploma or Certification of Graduation', required: true },
        { code: 'NOTICE_OF_ACCEPTANCE', label: 'Notice of Acceptance', required: true },
        { code: 'NMAT_RESULT', label: 'NMAT result', required: true }
      ],
      manualReview: false
    },
    CED: {
      label: 'CED',
      docs: [
        { code: 'APPLICATION_FORM', label: 'Duly accomplished application form', required: true },
        { code: 'HEI_ENDORSEMENT', label: 'Letter / Indorsement from the HEI', required: true },
        { code: 'PASSPORT_COPY', label: 'Photocopy of Passport', required: true },
        { code: 'TOR_CERTIFIED_TRUE_COPY', label: 'Certified True Copy of Transcript of Records', required: true },
        { code: 'DIPLOMA_OR_CERT_GRADUATION', label: 'Diploma or Certification of Graduation', required: true },
        { code: 'NOTICE_OF_ACCEPTANCE', label: 'Notice of Acceptance', required: true }
      ],
      manualReview: false
    },
    FS_TRANSFER: {
      label: 'FS Transfer to Another HEI',
      docs: [
        { code: 'OFFICIAL_ENDORSEMENT', label: 'Official endorsement', required: true },
        { code: 'NOA_ACCEPTING_HEI', label: 'NOA from the accepting HEI', required: true },
        { code: 'TRANSFER_CREDENTIALS', label: 'Transfer Credentials', required: true },
        { code: 'GOOD_MORAL_CERT', label: 'Certificate of Good Moral Character', required: true },
        { code: 'TOR_CERTIFIED_TRUE_COPY', label: 'Transcript of Records', required: true },
        { code: 'LETTER_OF_INTENT_TRANSFER', label: 'Letter of Intent and reason for transfer', required: true },
        { code: 'PASSPORT_BIO_AND_VISA', label: 'Passport bio-page and visa page', required: true },
        { code: 'ACR_COPY', label: 'ACR copy', required: true }
      ],
      manualReview: false
    },
    FS_SHIFTING: {
      label: 'FS Shifting to Another Degree Program',
      docs: [
        { code: 'OFFICIAL_ENDORSEMENT', label: 'Official endorsement from the HEI', required: true },
        { code: 'LETTER_OF_INTENT_SHIFTING', label: 'Letter of intent and reason for shifting', required: true },
        { code: 'PASSPORT_BIO_AND_VISA', label: 'Passport bio-page and visa page', required: true },
        { code: 'ACR_COPY', label: 'ACR copy', required: true }
      ],
      manualReview: false
    },
    OTHERS: {
      label: 'Others',
      docs: [
        { code: 'OTHERS_REQUEST_LETTER', label: 'Request letter', required: true },
        { code: 'OTHERS_SUPPORTING_DOCUMENTS', label: 'Supporting document', required: true }
      ],
      manualReview: true
    }
  };
}

function evaluateIntake_(row, rule, declaredDocCodes) {
  var applicableDocs = applicableDocsForRow_(rule, row);
  var validMap = {};
  var i;
  for (i = 0; i < applicableDocs.length; i++) validMap[applicableDocs[i].code] = applicableDocs[i];

  var declaredCodes = [];
  var declaredLabels = [];
  var declaredMap = {};
  for (i = 0; i < declaredDocCodes.length; i++) {
    var code = declaredDocCodes[i];
    if (!validMap[code] || declaredMap[code]) continue;
    declaredMap[code] = true;
    declaredCodes.push(code);
    declaredLabels.push(validMap[code].label);
  }
  if (!declaredCodes.length) throw new Error('No valid checklist items were declared for the selected request type.');

  var missingCodes = [];
  var missingLabels = [];
  for (i = 0; i < applicableDocs.length; i++) {
    if (applicableDocs[i].required && !declaredMap[applicableDocs[i].code]) {
      missingCodes.push(applicableDocs[i].code);
      missingLabels.push(applicableDocs[i].label);
    }
  }

  if (rule.manualReview) {
    return {
      status: 'FOR_MANUAL_REVIEW',
      resultLabel: 'Logged for manual review',
      deficiencyReason: missingLabels.length ? 'Manual review required. Missing required checklist items: ' + missingLabels.join('; ') + '.' : 'Manual review required for Others request.',
      publicMessage: 'Submission logged for manual review. Reference: ' + intakeReference_(row, declaredCodes) + '.',
      missingDocCodes: missingCodes,
      missingDocLabels: missingLabels,
      declaredDocCodes: declaredCodes,
      declaredDocLabels: declaredLabels,
    };
  }

  if (missingCodes.length) {
    return {
      status: 'REJECTED_INTAKE',
      resultLabel: 'Not accepted for processing',
      deficiencyReason: 'Unchecked required documents: ' + missingLabels.join('; ') + '.',
      publicMessage: 'Submission was logged but not accepted for processing. Reference: ' + intakeReference_(row, declaredCodes) + '.',
      missingDocCodes: missingCodes,
      missingDocLabels: missingLabels,
      declaredDocCodes: declaredCodes,
      declaredDocLabels: declaredLabels,
    };
  }

  return {
    status: 'ACCEPTED',
    resultLabel: 'Accepted for processing',
    deficiencyReason: '',
    publicMessage: 'Submission passed intake screening and was accepted for processing. Reference: ' + intakeReference_(row, declaredCodes) + '.',
    missingDocCodes: [],
    missingDocLabels: [],
    declaredDocCodes: declaredCodes,
    declaredDocLabels: declaredLabels,
  };
}

function applicableDocsForRow_(rule, row) {
  var docs = [];
  for (var i = 0; i < rule.docs.length; i++) {
    var doc = rule.docs[i];
    if (doc.onlyInstitutionTypes && doc.onlyInstitutionTypes.indexOf(row.institutionType) === -1) continue;
    docs.push({ code: doc.code, label: doc.label, required: !!doc.required });
  }
  return docs;
}

function enforceSpamChecks_(row, payload) {
  if (row.website) throw new Error('Spam submission blocked.');
  var filledMs = Date.now() - Number(row.formStartedAt || 0);
  if (!row.formStartedAt || filledMs < 3000) throw new Error('Submission blocked by anti-spam timer.');

  var cache = CacheService.getScriptCache();
  var fingerprint = submissionFingerprint_(row, payload);
  if (cache.get(fingerprint)) throw new Error('Duplicate or too-frequent submission blocked. Please wait before trying again.');
}

function markSubmissionFingerprint_(row, payload) {
  CacheService.getScriptCache().put(submissionFingerprint_(row, payload), '1', 60 * 5);
}

function submissionFingerprint_(row, payload) {
  var docs = row.declaredDocCodes.join('|');
  var base = [row.requestTypeCode, row.documentTitle, row.email, row.agency, row.institutionType, row.userAgent, docs].join('|');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, base);
  return 'submit:' + Utilities.base64EncodeWebSafe(digest);
}

function getResponseSheet_(config) {
  var ss = SpreadsheetApp.openById(config.spreadsheetId);
  var sheet = ss.getSheetByName(config.sheetName);
  var headers = [
    'Timestamp',
    'Intake_ID',
    'Request_Type_Code',
    'Request_Type_Label',
    'Status',
    'Intake_Result',
    'Deficiency_Reason',
    'Missing_Doc_Codes',
    'Missing_Doc_Labels',
    'Declared_Doc_Codes',
    'Declared_Doc_Labels',
    'Document_Title',
    'Name',
    'Email',
    'Agency',
    'Institution_Type',
    'Purpose',
    'Others_Description',
    'User_Agent',
    'Email_Sent',
    'Email_Error',
    'Review_Note'
  ];

  if (!sheet) {
    sheet = ss.insertSheet(config.sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }

  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
  var isDifferent = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || '') !== headers[i]) {
      isDifferent = true;
      break;
    }
  }
  if (isDifferent) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function sendClientEmailSafe_(data) {
  try {
    sendClientEmail_(data);
    return { sent: true, error: '' };
  } catch (err) {
    return { sent: false, error: errorMessage_(err) };
  }
}

function sendClientEmail_(data) {
  var subject = '[Document Intake] ' + data.status + ' - ' + data.intakeId;
  var timestampLabel = Utilities.formatDate(new Date(data.timestamp), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  var declared = (data.declaredDocLabels || []).join('; ') || 'None declared';
  var missing = (data.missingDocLabels || []).join('; ') || 'None';
  var deficiency = data.deficiencyReason || 'None';

  var htmlBody = '' +
    '<p>Good day ' + escapeHtml_(data.requester) + ',</p>' +
    '<p>Your document intake submission has been logged. Please review the intake result below.</p>' +
    '<table style="border-collapse:collapse;width:100%;max-width:760px;font-family:Arial,sans-serif;font-size:14px;">' +
    rowHtml_('Timestamp', timestampLabel) +
    rowHtml_('Intake', data.intakeId) +
    rowHtml_('Status', '<strong style="color:' + statusColor_(data.status) + ';">' + escapeHtml_(data.status) + '</strong>') +
    rowHtml_('Request Type', escapeHtml_(data.requestTypeLabel)) +
    rowHtml_('Requester', escapeHtml_(data.requester)) +
    rowHtml_('Institution Type', escapeHtml_(data.institutionType)) +
    rowHtml_('Declared', escapeHtml_(declared)) +
    rowHtml_('Missing', '<strong style="color:#b91c1c;">' + escapeHtml_(missing) + '</strong>') +
    rowHtml_('Deficiency', '<strong style="color:#b91c1c;">' + escapeHtml_(deficiency) + '</strong>') +
    '</table>' +
    '<p style="margin-top:16px;">Status is the controlling result. If your submission is <strong>REJECTED_INTAKE</strong>, review the <strong>Missing</strong> and <strong>Deficiency</strong> fields carefully before resubmitting.</p>' +
    '<p>Thank you.</p>';

  var plainBody = [
    'Good day ' + data.requester + ',',
    '',
    'Your document intake submission has been logged. Please review the intake result below.',
    '',
    'Timestamp: ' + timestampLabel,
    'Intake: ' + data.intakeId,
    'Status: ' + data.status,
    'Request Type: ' + data.requestTypeLabel,
    'Requester: ' + data.requester,
    'Institution Type: ' + data.institutionType,
    'Declared: ' + declared,
    'Missing: ' + missing,
    'Deficiency: ' + deficiency,
    '',
    'Status is the controlling result. If your submission is REJECTED_INTAKE, review the Missing and Deficiency fields before resubmitting.',
    '',
    'Thank you.'
  ].join('\n');

  MailApp.sendEmail({
    to: data.email,
    subject: subject,
    htmlBody: htmlBody,
    body: plainBody,
    name: 'Document Intake Portal'
  });
}

function rowHtml_(label, valueHtml) {
  return '<tr>' +
    '<td style="border:1px solid #e2e8f0;padding:8px 10px;background:#f8fafc;font-weight:600;width:180px;">' + escapeHtml_(label) + '</td>' +
    '<td style="border:1px solid #e2e8f0;padding:8px 10px;">' + valueHtml + '</td>' +
    '</tr>';
}

function statusColor_(status) {
  if (status === 'ACCEPTED') return '#047857';
  if (status === 'FOR_MANUAL_REVIEW') return '#b45309';
  return '#b91c1c';
}

function getRecordByIntakeId_(intakeId) {
  var values = getResponseSheet_(getConfig_()).getDataRange().getValues();
  if (!values || values.length < 2) return null;
  var headers = values[0];
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1] || '') === intakeId) return rowToObject_(headers, values[i]);
  }
  return null;
}

function generatePrintDoc_(record) {
  var config = getConfig_();
  if (!config.docTemplateId) throw new Error('DOC_TEMPLATE_ID is not configured in Script Properties.');
  var templateFile = DriveApp.getFileById(config.docTemplateId);
  var targetFolder = config.printOutputFolderId ? DriveApp.getFolderById(config.printOutputFolderId) : templateFile.getParents().hasNext() ? templateFile.getParents().next() : DriveApp.getRootFolder();
  var timeZone = Session.getScriptTimeZone() || 'Asia/Manila';
  var stamp = Utilities.formatDate(new Date(), timeZone, 'yyyyMMdd_HHmmss');
  var name = 'Intake Print - ' + String(record.Intake_ID || 'Record') + ' - ' + stamp;
  var copy = templateFile.makeCopy(name, targetFolder);
  var doc = DocumentApp.openById(copy.getId());
  var body = doc.getBody();

  replaceToken_(body, 'Timestamp', formatTimestampValue_(record.Timestamp));
  replaceToken_(body, 'Intake', String(record.Intake_ID || ''));
  replaceToken_(body, 'Status', String(record.Status || ''));
  replaceToken_(body, 'Intake Result', String(record.Intake_Result || ''));
  replaceToken_(body, 'Request Type', String(record.Request_Type_Label || ''));
  replaceToken_(body, 'Requester', String(record.Name || ''));
  replaceToken_(body, 'Institution Type', String(record.Institution_Type || ''));
  replaceToken_(body, 'Declared', String(record.Declared_Doc_Labels || ''));
  replaceToken_(body, 'Missing', String(record.Missing_Doc_Labels || ''));
  replaceToken_(body, 'Deficiency', String(record.Deficiency_Reason || ''));

  doc.saveAndClose();

  var refreshedDocFile = DriveApp.getFileById(copy.getId());
  var pdfBlob = refreshedDocFile.getAs(MimeType.PDF).setName(name + '.pdf');
  var pdfFile = targetFolder.createFile(pdfBlob);

  return {
    docId: copy.getId(),
    docUrl: doc.getUrl(),
    pdfFileId: pdfFile.getId(),
    pdfUrl: 'https://drive.google.com/file/d/' + pdfFile.getId() + '/preview',
    pdfViewUrl: 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view'
  };
}

function replaceToken_(body, token, value) {
  var safeValue = String(value == null ? '' : value);
  var variants = tokenVariants_(token);
  for (var v = 0; v < variants.length; v++) {
    var t = variants[v];
    var patterns = ['{{' + t + '}}', '<<' + t + '>>', '[' + t + ']'];
    for (var i = 0; i < patterns.length; i++) body.replaceText(escapeRegex_(patterns[i]), safeValue);
  }
}

function tokenVariants_(token) {
  var s = String(token);
  var withSpace = s.replace(/_/g, ' ');
  var withUnderscore = s.replace(/ /g, '_');
  var seen = {};
  var out = [];
  [s, withSpace, withUnderscore].forEach(function (v) {
    if (!seen[v]) { seen[v] = true; out.push(v); }
  });
  return out;
}

function escapeRegex_(s) {
  return String(s).replace(/([\\^$.*+?()[\]{}|])/g, '\\$1');
}

function requireAdmin_(adminKey) {
  var cache = CacheService.getScriptCache();
  if (cache.get(ADMIN_LOCKOUT_CACHE_KEY)) {
    throw new Error('Admin access is temporarily locked due to repeated failed logins. Try again in ~15 minutes.');
  }
  var expected = getConfig_().adminKey;
  if (!expected) throw new Error('ADMIN_KEY is not configured in Script Properties.');
  if (String(adminKey || '').trim() !== expected) {
    var attempts = Number(cache.get(ADMIN_FAILED_CACHE_KEY) || 0) + 1;
    if (attempts >= ADMIN_MAX_ATTEMPTS) {
      cache.put(ADMIN_LOCKOUT_CACHE_KEY, '1', ADMIN_LOCKOUT_SECONDS);
      cache.remove(ADMIN_FAILED_CACHE_KEY);
      auditLog_('admin_lockout_triggered', 'failure', 'attempts=' + attempts);
      throw new Error('Too many failed admin login attempts. Locked for 15 minutes.');
    }
    cache.put(ADMIN_FAILED_CACHE_KEY, String(attempts), ADMIN_FAIL_WINDOW_SECONDS);
    auditLog_('admin_login_failed', 'failure', 'attempt ' + attempts + '/' + ADMIN_MAX_ATTEMPTS);
    throw new Error('Unauthorized admin request.');
  }
  cache.remove(ADMIN_FAILED_CACHE_KEY);
}

function getAuditSheet_() {
  var props = PropertiesService.getScriptProperties();
  var name = props.getProperty('AUDIT_SHEET_NAME') || 'Audit';
  var ss = SpreadsheetApp.openById(getConfig_().spreadsheetId);
  var sheet = ss.getSheetByName(name);
  var headers = ['Timestamp', 'Action', 'Status', 'Detail'];
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function auditLog_(action, status, detail) {
  try {
    getAuditSheet_().appendRow([new Date(), String(action || ''), String(status || ''), String(detail == null ? '' : detail).slice(0, 1000)]);
  } catch (err) {
    // Best-effort: never let audit failure break the request.
  }
}

function getConfig_() {
  var props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
    sheetName: props.getProperty('RESPONSES_SHEET_NAME') || 'Responses',
    adminKey: props.getProperty('ADMIN_KEY') || '',
    docTemplateId: props.getProperty('DOC_TEMPLATE_ID') || '',
    printOutputFolderId: props.getProperty('PRINT_OUTPUT_FOLDER_ID') || '',
    submitSharedToken: props.getProperty('SUBMIT_SHARED_TOKEN') || '',
    turnstileSecretKey: props.getProperty('TURNSTILE_SECRET_KEY') || ''
  };
}

function verifySubmitToken_(token) {
  var expected = getConfig_().submitSharedToken;
  if (!expected) return;
  if (String(token || '').trim() !== expected) throw new Error('Submission token invalid.');
}

function verifyTurnstile_(token) {
  var secret = getConfig_().turnstileSecretKey;
  if (!secret) return;
  if (!token) throw new Error('CAPTCHA verification required.');
  var resp;
  try {
    resp = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'post',
      payload: { secret: secret, response: String(token) },
      muteHttpExceptions: true
    });
  } catch (err) {
    throw new Error('CAPTCHA verification could not be completed: ' + (err && err.message ? err.message : 'fetch error'));
  }
  var body = {};
  try { body = JSON.parse(resp.getContentText() || '{}'); } catch (err) {}
  if (!body.success) {
    var codes = (body['error-codes'] || []).join(', ');
    throw new Error('CAPTCHA verification failed' + (codes ? ': ' + codes : '.'));
  }
}

function handleUpdateDeficiency_(payload) {
  requireAdmin_(payload.adminKey);
  var intakeId = cleanText_(payload.intakeId, 80);
  if (!intakeId) throw new Error('Missing intake ID.');
  var reason = cleanText_(payload.deficiencyReason, 2000);

  var sheet = getResponseSheet_(getConfig_());
  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) throw new Error('Intake record not found.');

  var headers = values[0];
  var intakeCol = -1;
  var reasonCol = -1;
  for (var c = 0; c < headers.length; c++) {
    if (headers[c] === 'Intake_ID') intakeCol = c;
    if (headers[c] === 'Deficiency_Reason') reasonCol = c;
  }
  if (intakeCol === -1 || reasonCol === -1) throw new Error('Sheet is missing required columns.');

  for (var i = 1; i < values.length; i++) {
    if (String(values[i][intakeCol] || '') === intakeId) {
      var oldReason = String(values[i][reasonCol] || '');
      sheet.getRange(i + 1, reasonCol + 1).setValue(reason);
      auditLog_('update_deficiency', 'ok', intakeId + ' | old="' + oldReason + '" -> new="' + reason + '"');
      return jsonOutput_({ ok: true, message: 'Deficiency updated.', deficiencyReason: reason });
    }
  }
  throw new Error('Intake record not found.');
}

function setupProject_() {
  var config = getConfig_();
  if (!config.spreadsheetId || config.spreadsheetId === 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE') throw new Error('Set SPREADSHEET_ID in Script Properties first.');
  getResponseSheet_(config);
  return 'Setup complete.';
}

function buildCsv_() {
  var values = getResponseSheet_(getConfig_()).getDataRange().getDisplayValues();
  return values.map(function(row) { return row.map(csvEscape_).join(','); }).join('\r\n');
}

function csvEscape_(value) {
  return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
}

function rowToObject_(headers, row) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) obj[String(headers[i])] = row[i];
  return obj;
}

function emptyStats_() {
  return { total: 0, accepted: 0, rejected: 0, manualReview: 0, today: 0, recentRequestType: '—' };
}

function makeIntakeId_() {
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  return 'INT-' + stamp + '-' + (Math.floor(Math.random() * 9000) + 1000);
}

function intakeReference_(row, declaredCodes) {
  return [row.requestTypeCode, row.institutionType, declaredCodes.length].join('-');
}

function cleanText_(value, maxLen) {
  var out = String(value == null ? '' : value).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  return maxLen ? out.slice(0, maxLen) : out;
}

function formatTimestampValue_(value) {
  if (!value) return '';
  var d = value instanceof Date ? value : new Date(value);
  return isNaN(d) ? String(value) : Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
