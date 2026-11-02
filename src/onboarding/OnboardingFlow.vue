<script setup lang="ts">
import { useObject } from '@ai-sdk/vue'
import { computed, onMounted, ref } from 'vue'

import { authedFetch, fetchResult, loadDraft, ONBOARDING_API, saveDraft, toHistory, type Draft } from './api'
import { getAuth } from './auth'
import BirthStep from './BirthStep.vue'
import EstimateResult from './EstimateResult.vue'
import QuestionStep from './QuestionStep.vue'
import { turnSchema, type Birth, type OnboardingResult } from './schema'

const emit = defineEmits<{ ready: [result: OnboardingResult] }>()

const draft = ref<Draft | null>(loadDraft())
const result = ref<OnboardingResult | null>(null)
const signedIn = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)
const signInError = ref<string | null>(null)

const SIGN_IN_ERROR = "Sign-in didn't work this time. Give it another go in a minute."

const { submit, object, isLoading } = useObject({
  api: `${ONBOARDING_API}/next`,
  schema: turnSchema,
  fetch: authedFetch,
  onFinish: ({ object: turn }) => {
    const current = draft.value
    if (!turn || !current) return
    if (turn.estimate) {
      result.value = { ...toHistory(current), estimate: turn.estimate, completedAt: new Date().toISOString() }
      setDraft(null)
    } else if (turn.question) {
      setDraft({ ...current, steps: [...current.steps, { question: turn.question }] })
    }
  },
})

const pending = computed(() => {
  const last = draft.value?.steps[draft.value.steps.length - 1]
  return last && last.answer === undefined && !isLoading.value ? last.question : null
})

function setDraft(next: Draft | null) {
  draft.value = next
  saveDraft(next)
}

function requestNext() {
  if (draft.value) submit(toHistory(draft.value))
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    signedIn.value = await isSignedIn()
    if (signedIn.value && !draft.value) result.value = await fetchResult()
    // A returning user with a saved estimate goes straight to their Season Wheel.
    if (result.value) emit('ready', result.value)
    if (signedIn.value && draft.value && !pending.value) requestNext()
  } catch (cause) {
    loadError.value = cause instanceof Error ? cause.message : 'Something went wrong loading Joyo.'
  } finally {
    loading.value = false
  }
}

async function isSignedIn() {
  const returningFromSignIn = new URLSearchParams(window.location.search).has('code')
  try {
    const signedIn = (await getAuth()).getUser() !== null
    // AuthKit logs a failed code exchange instead of throwing it.
    if (returningFromSignIn && !signedIn) signInError.value = SIGN_IN_ERROR
    return signedIn
  } catch {
    signInError.value = SIGN_IN_ERROR
    return false
  }
}

async function signIn() {
  signInError.value = null
  try {
    await (await getAuth()).signIn()
  } catch {
    signInError.value = SIGN_IN_ERROR
  }
}

function start(birth: Birth) {
  setDraft({ birth, steps: [] })
  if (signedIn.value) requestNext()
}

function answer(value: string | null) {
  if (!draft.value) return
  const { steps } = draft.value
  const last = steps.length - 1
  setDraft({ ...draft.value, steps: steps.map((step, index) => (index === last ? { ...step, answer: value } : step)) })
  requestNext()
}

function restart() {
  result.value = null
  setDraft(null)
}

onMounted(load)
</script>

<template>
  <div class="onboarding">
    <p v-if="loading" class="status">Finding your place…</p>

    <div v-else-if="loadError" class="status">
      <p>{{ loadError }}</p>
      <button type="button" @click="load">Try again</button>
    </div>

    <EstimateResult
      v-else-if="result && !draft"
      :estimate="result.estimate"
      @open="emit('ready', result)"
      @restart="restart"
    />

    <QuestionStep
      v-else-if="pending"
      :key="draft?.steps.length"
      :question="pending"
      :number="draft?.steps.length ?? 1"
      @answer="answer"
    />

    <div v-else-if="isLoading" class="status" aria-live="polite">
      <p v-if="object?.question?.text" class="preview">{{ object.question.text }}</p>
      <p v-else-if="object?.estimate">Working out your window…</p>
      <p v-else>Thinking about what to ask next…</p>
    </div>

    <div v-else-if="draft && !signedIn" class="status">
      <h2>Lovely. Now sign in so we can ask the next bit.</h2>
      <p>Your answers stay on this device until your estimate is ready, then we save it to your account.</p>
      <p v-if="signInError">{{ signInError }}</p>
      <button type="button" @click="signIn">Sign in</button>
    </div>

    <div v-else-if="draft" class="status">
      <p>Something went wrong getting your next question.</p>
      <button type="button" @click="requestNext">Try again</button>
    </div>

    <BirthStep v-else @submit="start" />
  </div>
</template>

<style>
.onboarding .step,
.onboarding .status {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.onboarding h2 {
  margin: 0;
  font-size: 1.5rem;
  line-height: 1.3;
}

.onboarding label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-weight: 600;
}

.onboarding input,
.onboarding textarea,
.onboarding button {
  font: inherit;
  padding: 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #c8c8d0;
  max-width: 100%;
  box-sizing: border-box;
}

.onboarding button {
  cursor: pointer;
  background: #2f2a6b;
  color: #fff;
  border: none;
}

.onboarding .options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.onboarding .options button {
  background: #fff;
  color: #2f2a6b;
  border: 1px solid #2f2a6b;
  text-align: left;
}

.onboarding .skip {
  background: none;
  color: #5a5a66;
  text-decoration: underline;
}

.onboarding .count,
.onboarding .hint {
  margin: 0;
  color: #5a5a66;
}

.onboarding .preview {
  font-size: 1.5rem;
  opacity: 0.6;
}
</style>
