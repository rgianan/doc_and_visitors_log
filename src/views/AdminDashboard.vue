<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { API_URL, postJson } from '../lib/api.js'

const loadingResponses = ref(false)
const printingId = ref('')
const savingDeficiencyId = ref('')
const adminError = ref('')
const adminSuccess = ref('')
const isAdmin = ref(false)
const loggingIn = ref(false)
const responses = ref([])
const lastLoadedAt = ref('')

const admin = reactive({ key: '', search: '' })
const stats = ref({ total: 0, accepted: 0, rejected: 0, manualReview: 0, today: 0, recentRequestType: '—' })

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

function resetAdminMessages() {
  adminError.value = ''
  adminSuccess.value = ''
}

async function adminLogin() {
  if (loggingIn.value) return
  resetAdminMessages()
  if (!API_URL) return (adminError.value = 'Missing VITE_GAS_WEB_APP_URL.')
  if (!admin.key.trim()) return (adminError.value = 'Enter the admin key.')
  loggingIn.value = true
  try {
    const data = await postJson({ action: 'adminLogin', adminKey: admin.key.trim() })
    isAdmin.value = true
    adminSuccess.value = data.message || 'Admin access granted.'
    await loadResponses()
  } catch (error) {
    adminError.value = error?.message || 'Admin login failed.'
    isAdmin.value = false
  } finally {
    loggingIn.value = false
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

onMounted(() => {
  if (typeof document !== 'undefined') {
    let robotsMeta = document.querySelector('meta[name="robots"]')
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow')
  }
})
</script>

<template>
  <section class="mx-auto w-full max-w-[1400px] rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:rounded-[2rem] sm:p-6 md:p-8 min-[1920px]:max-w-none">
    <div v-if="!isAdmin" class="mx-auto max-w-xl rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 sm:rounded-[1.75rem] sm:p-6">
      <h2 class="text-2xl font-bold text-slate-900">Admin dashboard access</h2>
      <p class="mt-2 text-sm text-slate-600">Use the admin key to view document screening logs, export CSV, and generate print-ready PDFs.</p>
      <div class="mt-5 space-y-4">
        <div>
          <label class="mb-2 block text-sm font-medium text-slate-700">Admin key</label>
          <input v-model="admin.key" type="password" placeholder="Enter admin key" :disabled="loggingIn" @keyup.enter="adminLogin" class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </div>
        <div v-if="adminError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{{ adminError }}</div>
        <div v-if="adminSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{{ adminSuccess }}</div>
        <button :disabled="loggingIn" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-slate-900" @click="adminLogin">
          <svg v-if="loggingIn" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25" stroke-width="4"></circle>
            <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
          </svg>
          {{ loggingIn ? 'Unlocking…' : 'Unlock dashboard' }}
        </button>
      </div>
    </div>

    <div v-else>
      <div class="mb-6 flex flex-col gap-4 rounded-[1.5rem] bg-slate-900 p-4 text-white sm:rounded-[1.75rem] sm:p-5 lg:flex-row lg:items-end lg:justify-between">
        <div class="min-w-0">
          <h2 class="text-xl font-bold sm:text-2xl">Admin Dashboard</h2>
          <p class="mt-2 text-sm text-slate-300">Search screening logs, export the register, and generate a print-ready PDF receiving copy.</p>
          <p v-if="lastLoadedAt" class="mt-2 text-xs text-slate-400">Last loaded: {{ lastLoadedAt }}</p>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <button class="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm" @click="loadResponses">Refresh</button>
          <button class="rounded-2xl bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 sm:px-4 sm:text-sm" @click="exportCsvClient">Quick CSV</button>
          <button class="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-100 sm:px-4 sm:text-sm" @click="exportCsvServer">Server CSV</button>
          <button class="rounded-2xl border border-white/20 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10 sm:px-4 sm:text-sm" @click="logoutAdmin">Logout</button>
        </div>
      </div>

      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
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

      <div class="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white">
        <div class="w-full overflow-x-auto">
          <table class="w-full min-w-[1100px] table-fixed divide-y divide-slate-200 text-sm">
            <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th class="w-[140px] px-3 py-3">Timestamp</th>
                <th class="w-[110px] px-3 py-3">Intake</th>
                <th class="w-[140px] px-3 py-3">Status</th>
                <th class="w-[150px] px-3 py-3">Request Type</th>
                <th class="w-[180px] px-3 py-3">Requester</th>
                <th class="w-[120px] px-3 py-3">Institution Type</th>
                <th class="w-[180px] px-3 py-3">Declared</th>
                <th class="w-[180px] px-3 py-3">Missing</th>
                <th class="w-[220px] px-3 py-3">Deficiency</th>
                <th class="w-[130px] px-3 py-3">Actions</th>
              </tr>
            </thead>

            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-if="loadingResponses">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">
                  Loading intake records…
                </td>
              </tr>

              <tr v-else-if="!filteredResponses.length">
                <td colspan="10" class="px-4 py-10 text-center text-slate-500">
                  No intake records found.
                </td>
              </tr>

              <tr
                v-for="row in filteredResponses"
                :key="row.intakeId"
                class="align-top"
              >
                <td class="px-3 py-4 text-slate-600 break-words">
                  {{ row.timestamp }}
                </td>

                <td class="px-3 py-4 font-semibold text-slate-900 break-words">
                  {{ row.intakeId }}
                </td>

                <td class="px-3 py-4">
                  <span
                    class="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold leading-tight"
                    :class="row.status === 'ACCEPTED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : row.status === 'FOR_MANUAL_REVIEW'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-rose-100 text-rose-700'"
                  >
                    {{ row.status }}
                  </span>
                </td>

                <td class="px-3 py-4 text-slate-700 break-words">
                  {{ row.requestTypeLabel }}
                </td>

                <td class="px-3 py-4 text-slate-700">
                  <p class="font-medium text-slate-900 break-words">{{ row.name }}</p>
                  <p class="text-xs text-slate-500 break-all">{{ row.email }}</p>
                </td>

                <td class="px-3 py-4 text-slate-700 break-words">
                  {{ row.institutionType }}
                </td>

                <td class="px-3 py-4 text-slate-700 break-words">
                  {{ row.declaredDocLabels || '—' }}
                </td>

                <td class="px-3 py-4 text-slate-700 break-words">
                  {{ row.missingDocLabels || '—' }}
                </td>

                <td class="px-3 py-4 text-slate-700">
                  <textarea
                    v-model="row.deficiencyReason"
                    rows="3"
                    placeholder="Leave blank if none"
                    class="min-h-[84px] w-full min-w-[180px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-900"
                  ></textarea>
                  <p class="mt-2 text-xs text-slate-500">
                    Prints as <span class="font-semibold">None</span> when left blank.
                  </p>
                </td>

                <td class="px-3 py-4">
                  <div class="flex flex-col gap-2">
                    <button
                      class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="savingDeficiencyId === row.intakeId"
                      @click="saveDeficiency(row)"
                    >
                      {{ savingDeficiencyId === row.intakeId ? 'Saving…' : 'Save deficiency' }}
                    </button>

                    <button
                      class="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="printingId === row.intakeId"
                      @click="printRecord(row)"
                    >
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
</template>
