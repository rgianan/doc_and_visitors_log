export const REQUEST_TYPE_RULES = {
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
      { code: 'SUC_BOARD_RESOLUTION', label: 'Board Resolution / Excerpts of Meeting (for SUCs only)', required: true, onlyInstitutionTypes: ['SUC'] },
    ],
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
      { code: 'DESTINATION_SUPPORTING_DOCS', label: 'Other supporting documents required by destination country, if any', required: false },
    ],
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
      { code: 'NMAT_RESULT', label: 'NMAT result', required: true },
    ],
  },
  CED: {
    label: 'CED',
    docs: [
      { code: 'APPLICATION_FORM', label: 'Duly accomplished application form', required: true },
      { code: 'HEI_ENDORSEMENT', label: 'Letter / Indorsement from the HEI', required: true },
      { code: 'PASSPORT_COPY', label: 'Photocopy of Passport', required: true },
      { code: 'TOR_CERTIFIED_TRUE_COPY', label: 'Certified True Copy of Transcript of Records', required: true },
      { code: 'DIPLOMA_OR_CERT_GRADUATION', label: 'Diploma or Certification of Graduation', required: true },
      { code: 'NOTICE_OF_ACCEPTANCE', label: 'Notice of Acceptance', required: true },
    ],
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
      { code: 'ACR_COPY', label: 'ACR copy', required: true },
    ],
  },
  FS_SHIFTING: {
    label: 'FS Shifting to Another Degree Program',
    docs: [
      { code: 'OFFICIAL_ENDORSEMENT', label: 'Official endorsement from the HEI', required: true },
      { code: 'LETTER_OF_INTENT_SHIFTING', label: 'Letter of intent and reason for shifting', required: true },
      { code: 'PASSPORT_BIO_AND_VISA', label: 'Passport bio-page and visa page', required: true },
      { code: 'ACR_COPY', label: 'ACR copy', required: true },
    ],
  },
  OTHERS: {
    label: 'Others',
    manualReview: true,
    docs: [
      { code: 'OTHERS_REQUEST_LETTER', label: 'Request letter', required: true },
      { code: 'OTHERS_SUPPORTING_DOCUMENTS', label: 'Supporting document', required: true },
    ],
  },
}

export const INSTITUTION_TYPES = ['Private', 'SUC', 'LUC']
