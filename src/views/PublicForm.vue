<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { API_URL, SUBMIT_TOKEN, TURNSTILE_SITE_KEY, postJson } from '../lib/api.js'
import { REQUEST_TYPE_RULES, INSTITUTION_TYPES } from '../lib/requestTypes.js'

const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')
const submitOutcome = ref('')
const turnstileToken = ref('')
const turnstileWidgetId = ref(null)
const turnstileHost = ref(null)
let startedAt = Date.now()

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

const turnstileEnabled = computed(() => !!TURNSTILE_SITE_KEY)

function resetTurnstile() {
  turnstileToken.value = ''
  if (typeof window !== 'undefined' && window.turnstile && turnstileWidgetId.value != null) {
    try {
      window.turnstile.reset(turnstileWidgetId.value)
    } catch (err) {}
  }
}

function renderTurnstile() {
  if (!turnstileEnabled.value || typeof window === 'undefined') return
  if (!window.turnstile || !turnstileHost.value) return
  if (turnstileWidgetId.value != null) return
  turnstileWidgetId.value = window.turnstile.render(turnstileHost.value, {
    sitekey: TURNSTILE_SITE_KEY,
    callback(token) {
      turnstileToken.value = token || ''
    },
    'expired-callback'() {
      turnstileToken.value = ''
    },
    'error-callback'() {
      turnstileToken.value = ''
    }
  })
}

function ensureTurnstileLoaded() {
  if (!turnstileEnabled.value || typeof window === 'undefined') return
  if (window.turnstile) {
    renderTurnstile()
    return
  }
  const existing = document.querySelector('script[data-turnstile-loader="1"]')
  if (existing) {
    existing.addEventListener('load', renderTurnstile, { once: true })
    return
  }
  const script = document.createElement('script')
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  script.async = true
  script.defer = true
  script.dataset.turnstileLoader = '1'
  script.addEventListener('load', renderTurnstile, { once: true })
  document.head.appendChild(script)
}

function resetPublicMessages() {
  submitError.value = ''
  submitSuccess.value = ''
  submitOutcome.value = ''
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
  if (!SUBMIT_TOKEN) {
    submitError.value = 'Missing VITE_SUBMIT_SHARED_TOKEN.'
    return false
  }
  if (turnstileEnabled.value && !turnstileToken.value) {
    submitError.value = 'Complete the CAPTCHA verification.'
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
  resetTurnstile()
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
      submitToken: SUBMIT_TOKEN,
      clientOrigin: window.location.origin,
      turnstileToken: turnstileToken.value,
    })
    submitOutcome.value = data.status || ''
    submitSuccess.value = data.message || 'Submission recorded.'
    resetForm()
  } catch (error) {
    submitError.value = error?.message || 'Something went wrong while submitting the form.'
    resetTurnstile()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  ensureTurnstileLoaded()
})

watch(turnstileHost, () => {
  renderTurnstile()
})
</script>

<template>
  <section class="mx-auto w-full max-w-5xl rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:p-8 min-[1920px]:max-w-[1600px]">
    <div class="mb-6 rounded-2xl bg-slate-900 px-4 py-4 text-white sm:px-5">
      <h2 class="text-lg font-semibold">Submit a document for screening</h2>
      <div class="mt-4">
        <p class="text-justify">
            Only <strong>required</strong> documentary submissions shall be considered in determining whether a request is accepted or rejected. <strong>Optional</strong> documents may still be assessed when applicable, but they shall not trigger automatic rejection.
        </p>
      </div>
    </div>

    <div class="mb-6 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:grid-cols-3">
      <div>
        <p class="font-semibold">Accepted</p>
        <p>All applicable required items are declared present.</p>
      </div>
      <div>
        <p class="font-semibold">Rejected</p>
        <p>One or more applicable required items are unchecked.</p>
      </div>
      <div>
        <p class="font-semibold">Manual review</p>
        <p>Other requests are still recorded for manual review instead of being automatically accepted.</p>
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

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:col-span-2 lg:col-span-1">
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

      <div v-if="activeRule" class="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 sm:rounded-[1.75rem] sm:p-5">
        <div class="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div class="min-w-0">
            <h3 class="text-lg font-semibold text-slate-900">Documentary checklist</h3>
            <p class="mt-1 text-sm text-slate-600">Required items matter for screening status. Optional items can be declared when available.</p>
          </div>
          <div class="self-start rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm sm:self-auto">{{ activeRule.label }}</div>
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

      <div v-if="turnstileEnabled" class="rounded-2xl border border-slate-200 bg-white p-4">
        <p class="mb-3 text-sm font-medium text-slate-700">CAPTCHA verification</p>
        <div ref="turnstileHost" class="min-h-16"></div>
      </div>

      <div v-if="submitError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ submitError }}</div>
      <div v-if="submitSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <p class="font-semibold">{{ submitOutcome || 'Recorded' }}</p>
        <p class="mt-1">{{ submitSuccess }}</p>
      </div>

      <div class="flex flex-col gap-3 pt-2 sm:flex-row">
        <div class="group relative">
          <button type="submit" :disabled="submitting" aria-describedby="submit-privacy-tooltip" class="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
            {{ submitting ? 'Submitting…' : 'Submit for document screening' }}
          </button>
          <div
            id="submit-privacy-tooltip"
            role="tooltip"
            class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 w-72 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs leading-relaxed text-white opacity-0 shadow-xl ring-1 ring-black/5 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:w-96"
          >
            By submitting this form, you acknowledge that you have read and understood the privacy policy and consent to the collection, processing, and storage of your personal data by the entity, in compliance with the Data Privacy Act of 2012 (Republic Act No. 10173). Your data will be used specifically for the stated purposes and protected according to these laws.
            <span class="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-slate-900"></span>
          </div>
        </div>
        <button type="button" class="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900" @click="resetForm">
          Reset form
        </button>
      </div>
    </form>
  </section>
</template>
