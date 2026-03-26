<script setup>
import { computed, reactive, ref } from 'vue'

const API_URL = import.meta.env.VITE_GAS_WEB_APP_URL || ''
const DEFAULT_ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || ''

const REQUEST_TYPE_RULES = {
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

const INSTITUTION_TYPES = ['Private', 'SUC', 'LUC']
const view = ref('public')
const submitting = ref(false)
const loadingResponses = ref(false)
const printingId = ref('')
const savingDeficiencyId = ref('')
const submitError = ref('')
const submitSuccess = ref('')
const submitOutcome = ref('')
const adminError = ref('')
const adminSuccess = ref('')
const isAdmin = ref(false)
const responses = ref([])
const lastLoadedAt = ref('')
let startedAt = Date.now()

const admin = reactive({ key: DEFAULT_ADMIN_KEY, search: '' })
const stats = ref({ total: 0, accepted: 0, rejected: 0, manualReview: 0, today: 0, recentRequestType: '—' })

const form = reactive({
  requestTypeCode: '',
  documentTitle: '',
  name: '',
  email: '',
  agency: '',
  institutionType: '',
  purpose: '',
  othersDescription: '',
  website: '',
})

const requestTypeOptions = Object.entries(REQUEST_TYPE_RULES).map(([code, rule]) => ({ code, label: rule.label }))
const checkedDocs = reactive({})

const emailIsValid = computed(() => !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
const activeRule = computed(() => REQUEST_TYPE_RULES[form.requestTypeCode] || null)
const visibleRequirements = computed(() => {
  const rule = activeRule.value
  if (!rule) return []
  return rule.docs.map((doc) => {
    const enabled = !doc.onlyInstitutionTypes || doc.onlyInstitutionTypes.includes(form.institutionType)
    return { ...doc, enabled }
  })
})
const requiredRequirements = computed(() => visibleRequirements.value.filter((doc) => doc.enabled && doc.required))
const optionalRequirements = computed(() => visibleRequirements.value.filter((doc) => doc.enabled && !doc.required))
const checkedCount = computed(() => visibleRequirements.value.filter((doc) => doc.enabled && !!checkedDocs[doc.code]).length)

const filteredResponses = computed(() => {
  const q = admin.search.trim().toLowerCase()
  if (!q) return responses.value
  return responses.value.filter((row) =>
    [
      row.timestamp,
      row.intakeId,
      row.status,
      row.requestTypeLabel,
      row.name,
      row.email,
      row.institutionType,
      row.declaredDocLabels,
      row.missingDocLabels,
      row.deficiencyReason,
    ]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
})

function resetPublicMessages() {
  submitError.value = ''
  submitSuccess.value = ''
  submitOutcome.value = ''
}
function resetAdminMessages() {
  adminError.value = ''
  adminSuccess.value = ''
}
function clearInapplicableChecks() {
  visibleRequirements.value.forEach((doc) => {
    if (!doc.enabled) checkedDocs[doc.code] = false
  })
}
function validateForm() {
  const missing = []
  if (!form.requestTypeCode) missing.push('Request type')
  if (!form.documentTitle.trim()) missing.push('Document title')
  if (!form.name.trim()) missing.push('Requester name')
  if (!form.email.trim()) missing.push('Email')
  if (!form.agency.trim()) missing.push('Office / agency')
  if (!form.institutionType.trim()) missing.push('Institution type')
  if (!form.purpose.trim()) missing.push('Purpose / request summary')
  if (missing.length) {
    submitError.value = `Please complete: ${missing.join(', ')}`
    return false
  }
  if (!emailIsValid.value) {
    submitError.value = 'Email format is invalid.'
    return false
  }
  if (form.requestTypeCode === 'OTHERS' && !form.othersDescription.trim()) {
    submitError.value = 'Describe the request under Others.'
    return false
  }
  if (checkedCount.value === 0) {
    submitError.value = 'Tick the documentary checklist items presented for this request type.'
    return false
  }
  if (!API_URL) {
    submitError.value = 'Missing VITE_GAS_WEB_APP_URL.'
    return false
  }
  return true
}

function resetForm() {
  Object.assign(form, {
    requestTypeCode: '',
    documentTitle: '',
    name: '',
    email: '',
    agency: '',
    institutionType: '',
    purpose: '',
    othersDescription: '',
    website: '',
  })
  Object.keys(checkedDocs).forEach((key) => delete checkedDocs[key])
  startedAt = Date.now()
}

async function postJson(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  const raw = await res.text()
  let data = {}
  try {
    data = raw ? JSON.parse(raw) : {}
  } catch {
    throw new Error('Backend did not return valid JSON.')
  }
  if (!res.ok || !data.ok) throw new Error(data.message || 'Request failed.')
  return data
}

async function submitForm() {
  resetPublicMessages()
  clearInapplicableChecks()
  if (!validateForm()) return
  submitting.value = true
  try {
    const declaredDocCodes = visibleRequirements.value.filter((doc) => doc.enabled && checkedDocs[doc.code]).map((doc) => doc.code)
    const data = await postJson({
      action: 'submit',
      requestTypeCode: form.requestTypeCode,
      documentTitle: form.documentTitle.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      agency: form.agency.trim(),
      institutionType: form.institutionType.trim(),
      purpose: form.purpose.trim(),
      othersDescription: form.othersDescription.trim(),
      website: form.website.trim(),
      formStartedAt: startedAt,
      userAgent: navigator.userAgent,
      declaredDocCodes,
    })
    submitOutcome.value = data.status || ''
    submitSuccess.value = data.message || 'Submission recorded.'
    resetForm()
  } catch (error) {
    submitError.value = error?.message || 'Something went wrong while submitting the form.'
  } finally {
    submitting.value = false
  }
}

async function adminLogin() {
  resetAdminMessages()
  if (!API_URL) return (adminError.value = 'Missing VITE_GAS_WEB_APP_URL.')
  if (!admin.key.trim()) return (adminError.value = 'Enter the admin key.')
  try {
    const data = await postJson({ action: 'adminLogin', adminKey: admin.key.trim() })
    isAdmin.value = true
    adminSuccess.value = data.message || 'Admin access granted.'
    await loadResponses()
  } catch (error) {
    adminError.value = error?.message || 'Admin login failed.'
    isAdmin.value = false
  }
}

async function loadResponses() {
  if (!isAdmin.value) return
  loadingResponses.value = true
  resetAdminMessages()
  try {
    const data = await postJson({ action: 'listResponses', adminKey: admin.key.trim() })
    responses.value = Array.isArray(data.rows) ? data.rows : []
    stats.value = data.stats || stats.value
    lastLoadedAt.value = new Date().toLocaleString()
  } catch (error) {
    adminError.value = error?.message || 'Failed to load responses.'
  } finally {
    loadingResponses.value = false
  }
}

async function printRecord(row) {
  if (!row?.intakeId || printingId.value) return
  printingId.value = row.intakeId
  resetAdminMessages()
  try {
    const data = await postJson({ action: 'printRecord', adminKey: admin.key.trim(), intakeId: row.intakeId })
    adminSuccess.value = data.message || 'Print PDF generated.'
    const targetUrl = data.pdfUrl || data.pdfViewUrl || data.docUrl
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer')
  } catch (error) {
    adminError.value = error?.message || 'Failed to generate print document.'
  } finally {
    printingId.value = ''
  }
}

async function saveDeficiency(row) {
  if (!row?.intakeId || savingDeficiencyId.value) return
  savingDeficiencyId.value = row.intakeId
  resetAdminMessages()
  try {
    const data = await postJson({
      action: 'updateDeficiency',
      adminKey: admin.key.trim(),
      intakeId: row.intakeId,
      deficiencyReason: (row.deficiencyReason || '').trim(),
    })
    row.deficiencyReason = data.deficiencyReason || ''
    adminSuccess.value = data.message || 'Deficiency updated.'
  } catch (error) {
    adminError.value = error?.message || 'Failed to update deficiency.'
  } finally {
    savingDeficiencyId.value = ''
  }
}

function exportCsvClient() {
  const header = ['Timestamp', 'Intake ID', 'Status', 'Request Type', 'Requester', 'Institution Type', 'Declared', 'Missing', 'Deficiency']
  const rows = filteredResponses.value.map((row) => [
    row.timestamp || '',
    row.intakeId || '',
    row.status || '',
    row.requestTypeLabel || '',
    row.name || '',
    row.institutionType || '',
    row.declaredDocLabels || '',
    row.missingDocLabels || '',
    row.deficiencyReason || '',
  ])
  const csv = [header, ...rows].map((line) => line.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `document-intake-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
function exportCsvServer() {
  const url = `${API_URL}?action=exportCsv&adminKey=${encodeURIComponent(admin.key.trim())}`
  window.open(url, '_blank', 'noopener,noreferrer')
}
function logoutAdmin() {
  isAdmin.value = false
  responses.value = []
  admin.search = ''
  resetAdminMessages()
}
</script>

<template>
  <main class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 py-10">
    <div class="mx-auto max-w-7xl">
      <div class="mb-8 flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Commission on Higher Education</p>
          <h1 class="mt-2 text-4xl font-bold text-slate-900">OSDS Document Intake Portal</h1>
          <p class="mt-3 max-w-3xl text-sm text-slate-600">
            Intake screening now runs on request-type-specific checklist logic, emails the client after submission, and lets admins generate a print-ready Google Doc from a template.
          </p>
        </div>
        <div class="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button class="rounded-2xl px-4 py-2 text-sm font-semibold transition" :class="view === 'public' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'" @click="view = 'public'">Intake Form</button>
          <button class="rounded-2xl px-4 py-2 text-sm font-semibold transition" :class="view === 'admin' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'" @click="view = 'admin'">Admin Dashboard</button>
        </div>
      </div>

      <section v-if="view === 'public'" class="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <div class="mb-6 rounded-2xl bg-slate-900 px-5 py-4 text-white">
          <h2 class="text-lg font-semibold">Submit a document for intake screening</h2>
            <div class="mt-1 text-sm text-slate-300 space-y-3">
            <p class="text-justify">
              By submitting this form, you acknowledge that you have read and understood the privacy policy and consent to the
              collection, processing, and storage of your personal data by the entity, in compliance with the Data Privacy Act of 2012
              (Republic Act No. 10173). Your data will be used specifically for the stated purposes and protected according to these laws.
            </p>

            <p class="text-justify">
              Only the required documents affect whether a request is accepted or rejected. Optional documents can still be reviewed if needed,
              but they do not trigger automatic rejection.
            </p>
          </div>
        </div>

        <div class="mb-6 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 md:grid-cols-3">
          <div>
            <p class="font-semibold">Accepted</p>
            <p>All applicable required items are declared present.</p>
          </div>
          <div>
            <p class="font-semibold">Rejected intake</p>
            <p>One or more applicable required items are unchecked.</p>
          </div>
          <div>
            <p class="font-semibold">Manual review</p>
            <p>Others requests stay logged for manual review rather than blind acceptance.</p>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="submitForm">
          <input v-model="form.website" type="text" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />

          <div class="grid gap-5 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Request type</label>
              <select v-model="form.requestTypeCode" @change="clearInapplicableChecks" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
                <option value="" disabled>Select request type</option>
                <option v-for="opt in requestTypeOptions" :key="opt.code" :value="opt.code">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Document title</label>
              <input v-model="form.documentTitle" type="text" placeholder="Enter the document title" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
            </div>
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Requester name</label>
              <input v-model="form.name" type="text" placeholder="Enter your full name" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Email</label>
              <input v-model="form.email" type="email" placeholder="Enter your email" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
              <p v-if="form.email && !emailIsValid" class="mt-2 text-sm text-rose-600">Use a valid email address.</p>
            </div>
          </div>

          <div class="grid gap-5 md:grid-cols-3">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Office / agency</label>
              <input v-model="form.agency" type="text" placeholder="Enter office or agency" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Institution Type</label>
              <select v-model="form.institutionType" @change="clearInapplicableChecks" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900">
                <option value="" disabled>Select institution type</option>
                <option v-for="option in INSTITUTION_TYPES" :key="option" :value="option">{{ option }}</option>
              </select>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p class="font-semibold text-slate-900">Checklist progress</p>
              <p class="mt-1">{{ checkedCount }} item<span v-if="checkedCount !== 1">s</span> declared</p>
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Purpose / request summary</label>
            <textarea v-model="form.purpose" rows="4" placeholder="State the purpose or request summary" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"></textarea>
          </div>

          <div v-if="form.requestTypeCode === 'OTHERS'">
            <label class="mb-2 block text-sm font-medium text-slate-700">Describe the request under Others</label>
            <textarea v-model="form.othersDescription" rows="3" placeholder="Describe the request and why it falls under Others" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"></textarea>
          </div>

          <div v-if="activeRule" class="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
            <div class="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">Documentary checklist</h3>
                <p class="mt-1 text-sm text-slate-600">Required items matter for intake status. Optional items can be declared when available.</p>
              </div>
              <div class="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">{{ activeRule.label }}</div>
            </div>

            <div class="space-y-3">
              <label
                v-for="doc in visibleRequirements"
                :key="doc.code"
                class="flex items-start gap-3 rounded-2xl border px-4 py-3 transition"
                :class="doc.enabled ? 'cursor-pointer border-slate-200 bg-white hover:border-slate-300' : 'cursor-not-allowed border-slate-200 bg-slate-100 opacity-60'"
              >
                <input v-model="checkedDocs[doc.code]" :disabled="!doc.enabled" type="checkbox" class="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
                <div class="flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-medium text-slate-900">{{ doc.label }}</p>
                    <span class="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide" :class="doc.required ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'">
                      {{ doc.required ? 'Required' : 'Optional' }}
                    </span>
                    <span v-if="!doc.enabled" class="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">Not applicable</span>
                  </div>
                  <p class="mt-1 text-xs uppercase tracking-wide text-slate-500">{{ doc.code }}</p>
                </div>
              </label>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p class="font-semibold text-slate-900">Required items</p>
                <p class="mt-1">{{ requiredRequirements.length }} applicable required item<span v-if="requiredRequirements.length !== 1">s</span></p>
              </div>
              <div class="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                <p class="font-semibold text-slate-900">Optional items</p>
                <p class="mt-1">{{ optionalRequirements.length }} applicable optional item<span v-if="optionalRequirements.length !== 1">s</span></p>
              </div>
            </div>
          </div>

          <div v-if="submitError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ submitError }}</div>
          <div v-if="submitSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <p class="font-semibold">{{ submitOutcome || 'Recorded' }}</p>
            <p class="mt-1">{{ submitSuccess }}</p>
          </div>

          <div class="flex flex-col gap-3 pt-2 sm:flex-row">
            <button type="submit" :disabled="submitting" class="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
              {{ submitting ? 'Submitting…' : 'Submit for intake screening' }}
            </button>
            <button type="button" class="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900" @click="resetForm">
              Reset form
            </button>
          </div>
        </form>
      </section>

      <section v-else class="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <div v-if="!isAdmin" class="mx-auto max-w-xl rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
          <h2 class="text-2xl font-bold text-slate-900">Admin dashboard access</h2>
          <p class="mt-2 text-sm text-slate-600">Use the admin key to view intake logs, export CSV, and generate print-ready PDFs from the Google Doc template.</p>
          <div class="mt-5 space-y-4">
            <div>
              <label class="mb-2 block text-sm font-medium text-slate-700">Admin key</label>
              <input v-model="admin.key" type="password" placeholder="Enter admin key" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900" />
            </div>
            <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
            <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>
            <button class="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700" @click="adminLogin">Unlock dashboard</button>
          </div>
        </div>

        <div v-else>
          <div class="mb-6 flex flex-col gap-4 rounded-[1.75rem] bg-slate-900 p-5 text-white lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 class="text-2xl font-bold">Admin Dashboard</h2>
              <p class="mt-2 text-sm text-slate-300">Search intake logs, export the register, and generate a print-ready PDF file.</p>
              <p v-if="lastLoadedAt" class="mt-2 text-xs text-slate-400">Last loaded: {{ lastLoadedAt }}</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <button class="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20" @click="loadResponses">Refresh</button>
              <button class="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20" @click="exportCsvClient">Quick CSV</button>
              <button class="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100" @click="exportCsvServer">Server CSV</button>
              <button class="rounded-2xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10" @click="logoutAdmin">Logout</button>
            </div>
          </div>

          <div class="mb-6 grid gap-4 md:grid-cols-5">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p class="text-xs uppercase tracking-wide text-slate-500">Total</p><p class="mt-2 text-3xl font-bold text-slate-900">{{ stats.total }}</p></div>
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p class="text-xs uppercase tracking-wide text-emerald-700">Accepted</p><p class="mt-2 text-3xl font-bold text-emerald-900">{{ stats.accepted }}</p></div>
            <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4"><p class="text-xs uppercase tracking-wide text-rose-700">Rejected intake</p><p class="mt-2 text-3xl font-bold text-rose-900">{{ stats.rejected }}</p></div>
            <div class="rounded-2xl border border-amber-200 bg-amber-50 p-4"><p class="text-xs uppercase tracking-wide text-amber-700">Manual review</p><p class="mt-2 text-3xl font-bold text-amber-900">{{ stats.manualReview }}</p></div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p class="text-xs uppercase tracking-wide text-slate-500">Today</p><p class="mt-2 text-3xl font-bold text-slate-900">{{ stats.today }}</p></div>
          </div>

          <div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <input v-model="admin.search" type="search" placeholder="Search by intake, status, requester, requirement, deficiency" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 lg:max-w-md" />
            <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
            <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>
          </div>

          <div class="overflow-hidden rounded-[1.75rem] border border-slate-200">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-4 py-3">Timestamp</th>
                    <th class="px-4 py-3">Intake</th>
                    <th class="px-4 py-3">Status</th>
                    <th class="px-4 py-3">Request Type</th>
                    <th class="px-4 py-3">Requester</th>
                    <th class="px-4 py-3">Institution Type</th>
                    <th class="px-4 py-3">Declared</th>
                    <th class="px-4 py-3">Missing</th>
                    <th class="px-4 py-3">Deficiency</th>
                    <th class="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  <tr v-if="loadingResponses">
                    <td colspan="10" class="px-4 py-10 text-center text-slate-500">Loading intake records…</td>
                  </tr>
                  <tr v-else-if="!filteredResponses.length">
                    <td colspan="10" class="px-4 py-10 text-center text-slate-500">No intake records found.</td>
                  </tr>
                  <tr v-for="row in filteredResponses" :key="row.intakeId">
                    <td class="px-4 py-4 align-top text-slate-600">{{ row.timestamp }}</td>
                    <td class="px-4 py-4 align-top font-semibold text-slate-900">{{ row.intakeId }}</td>
                    <td class="px-4 py-4 align-top">
                      <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="row.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700' : row.status === 'FOR_MANUAL_REVIEW' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'">{{ row.status }}</span>
                    </td>
                    <td class="px-4 py-4 align-top text-slate-700">{{ row.requestTypeLabel }}</td>
                    <td class="px-4 py-4 align-top text-slate-700">
                      <p class="font-medium text-slate-900">{{ row.name }}</p>
                      <p class="text-xs text-slate-500">{{ row.email }}</p>
                    </td>
                    <td class="px-4 py-4 align-top text-slate-700">{{ row.institutionType }}</td>
                    <td class="px-4 py-4 align-top text-slate-700">{{ row.declaredDocLabels || '—' }}</td>
                    <td class="px-4 py-4 align-top text-slate-700">{{ row.missingDocLabels || '—' }}</td>
                    <td class="px-4 py-4 align-top text-slate-700">
                      <textarea v-model="row.deficiencyReason" rows="3" placeholder="Leave blank if none" class="min-h-[84px] w-64 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"></textarea>
                      <p class="mt-2 text-xs text-slate-500">Prints as <span class="font-semibold">None</span> when left blank.</p>
                    </td>
                    <td class="px-4 py-4 align-top">
                      <div class="flex flex-col gap-2">
                        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="savingDeficiencyId === row.intakeId" @click="saveDeficiency(row)">
                          {{ savingDeficiencyId === row.intakeId ? 'Saving…' : 'Save deficiency' }}
                        </button>
                        <button class="rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50" :disabled="printingId === row.intakeId" @click="printRecord(row)">
                          {{ printingId === row.intakeId ? 'Generating…' : 'Print' }}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>
</template>
