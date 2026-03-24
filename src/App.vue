<script setup>
import { computed, reactive, ref } from 'vue'

const API_URL = import.meta.env.VITE_GAS_WEB_APP_URL || ''

const form = reactive({
  name: '',
  email: '',
  agency: '',
  sex: '',
  purpose: '',
})

const sexOptions = ['Male', 'Female', 'Prefer not to say']
const submitting = ref(false)
const submitError = ref('')
const submitSuccess = ref('')

const emailIsValid = computed(() => {
  if (!form.email) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
})

function resetMessages() {
  submitError.value = ''
  submitSuccess.value = ''
}

function validateForm() {
  const missing = []
  if (!form.name.trim()) missing.push('Name')
  if (!form.email.trim()) missing.push('Email')
  if (!form.agency.trim()) missing.push('Agency')
  if (!form.sex.trim()) missing.push('Sex')
  if (!form.purpose.trim()) missing.push('Purpose')

  if (missing.length) {
    submitError.value = `Please complete: ${missing.join(', ')}`
    return false
  }

  if (!emailIsValid.value) {
    submitError.value = 'Email format is invalid.'
    return false
  }

  if (!API_URL) {
    submitError.value = 'Missing VITE_GAS_WEB_APP_URL. Add it in Netlify environment variables.'
    return false
  }

  return true
}

async function submitForm() {
  resetMessages()

  if (!validateForm()) return

  submitting.value = true

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({ ...form }),
    })

    const raw = await res.text()
    let data = {}

    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      throw new Error('Backend did not return valid JSON.')
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Submission failed.')
    }

    submitSuccess.value = 'Form submitted successfully.'
    form.name = ''
    form.email = ''
    form.agency = ''
    form.sex = ''
    form.purpose = ''
  } catch (error) {
    submitError.value = error?.message || 'Something went wrong while submitting the form.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 px-4 py-10">
    <div class="mx-auto max-w-2xl">
      <div class="mb-6 text-center">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Commission on Higher Education</p>
        <h1 class="mt-2 text-4xl font-bold text-slate-900">Document Request Form</h1>
        <p class="mt-3 text-sm text-slate-600">
          Follow up and track you documents.
        </p>
      </div>

      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <div class="mb-6 rounded-2xl bg-slate-900 px-5 py-4 text-white">
          <h2 class="text-lg font-semibold">Submit your details</h2>
          <p class="mt-1 text-sm text-slate-300">Data is collected and processed within a secure, access-controlled environment, in full compliance with the Data Privacy Act of 2012.</p>
        </div>

        <form class="space-y-5" @submit.prevent="submitForm">
          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Name</label>
            <input
              v-model="form.name"
              type="text"
              placeholder="Enter your full name"
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Email</label>
            <input
              v-model="form.email"
              type="text"
              placeholder="Enter your email"
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
            />
            <p v-if="form.email && !emailIsValid" class="mt-2 text-sm text-rose-600">Use a valid email address.</p>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Agency</label>
            <input
              v-model="form.agency"
              type="text"
              placeholder="Enter your agency"
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
            />
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Sex</label>
            <select
              v-model="form.sex"
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
            >
              <option value="" disabled>Select sex</option>
              <option v-for="option in sexOptions" :key="option" :value="option">{{ option }}</option>
            </select>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-700">Purpose</label>
            <textarea
              v-model="form.purpose"
              rows="4"
              placeholder="State the purpose"
              class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-slate-900"
            ></textarea>
          </div>

          <div v-if="submitError" class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {{ submitError }}
          </div>

          <div v-if="submitSuccess" class="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {{ submitSuccess }}
          </div>

          <button
            type="submit"
            :disabled="submitting"
            class="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ submitting ? 'Submitting...' : 'Submit Form' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
