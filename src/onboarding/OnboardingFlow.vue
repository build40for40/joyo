<script setup lang="ts">
import { useObject } from '@ai-sdk/vue'
import { computed, onMounted, ref } from 'vue'

import { authedFetch, fetchResult, loadDraft, ONBOARDING_API, saveDraft, toHistory, type Draft } from './api'
import { getAuth } from './auth'
import BirthStep from './BirthStep.vue'
import EstimateResult from './EstimateResult.vue'
import LoadingStars from './LoadingStars.vue'
import QuestionStep from './QuestionStep.vue'
import { turnSchema, type Birth, type OnboardingResult } from './schema'
import SplashStep from './SplashStep.vue'

const emit = defineEmits<{ ready: [result: OnboardingResult] }>()

const draft = ref<Draft | null>(loadDraft())
const result = ref<OnboardingResult | null>(null)
const signedIn = ref(false)
/** Signed-out visitors choose between starting new and signing in to their saved estimate. */
const startingNew = ref(false)
const loading = ref(true)
const loadError = ref<string | null>(null)
const signInError = ref<string | null>(null)

/** useObject clears isLoading a tick before onFinish, which would flash the error state. */
const thinking = ref(false)

const SIGN_IN_ERROR = "Sign-in didn't work this time. Give it another go in a minute."

const { submit, object } = useObject({
  api: `${ONBOARDING_API}/next`,
  schema: turnSchema,
  fetch: authedFetch,
  onError: () => (thinking.value = false),
  onFinish: ({ object: turn }) => {
    thinking.value = false
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
  return last && last.answer === undefined && !thinking.value ? last.question : null
})

function setDraft(next: Draft | null) {
  draft.value = next
  saveDraft(next)
}

function requestNext() {
  if (!draft.value) return
  thinking.value = true
  submit(toHistory(draft.value))
}

async function load() {
  loading.value = true
  loadError.value = null
  try {
    signedIn.value = await isSignedIn()
    if (signedIn.value) result.value = await fetchResult()
    // Anyone with a saved estimate goes straight to their Season Wheel, even mid-way through a new draft.
    if (result.value) {
      setDraft(null)
      emit('ready', result.value)
    } else if (signedIn.value && draft.value && !pending.value) requestNext()
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

onMounted(load)
</script>

<template>
  <div class="onboarding">
    <LoadingStars v-if="loading" label="Finding your place" />

    <div v-else-if="loadError" class="status">
      <p>{{ loadError }}</p>
      <button type="button" @click="load">Try again</button>
    </div>

    <EstimateResult
      v-else-if="result && !draft"
      :estimate="result.estimate"
      @open="emit('ready', result)"
    />

    <QuestionStep
      v-else-if="pending"
      :key="draft?.steps.length"
      :question="pending"
      :number="draft?.steps.length ?? 1"
      @answer="answer"
    />

    <LoadingStars
      v-else-if="thinking"
      :label="object?.estimate ? 'Working out your window' : 'Thinking about what to ask next'"
    />

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

    <SplashStep v-else-if="!signedIn && !startingNew" :error="signInError" @start="startingNew = true" @sign-in="signIn" />

    <BirthStep v-else @submit="start" />
  </div>
</template>

<style>
.onboarding .step,
.onboarding .status {
  display: flex;
  flex-direction: column;
  gap: var(--joyo-space-4);
}

.onboarding .step {
  background: var(--joyo-surface);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-card);
  padding: var(--joyo-space-6);
  animation: joyo-step-in var(--joyo-dur) var(--joyo-ease);
}

@keyframes joyo-step-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
}

.onboarding h2 {
  font-family: var(--joyo-font-display);
  font-weight: 400;
  font-size: 28px;
  line-height: 1.25;
}

.onboarding p {
  margin: 0;
}

.onboarding label,
.onboarding fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--joyo-space-2);
  margin: 0;
  padding: 0;
  border: none;
  font-weight: 500;
}

.onboarding legend {
  padding: 0;
  margin-bottom: var(--joyo-space-2);
  font-weight: 500;
}

.onboarding input,
.onboarding textarea {
  max-width: 100%;
  padding: 14px;
  background: var(--joyo-surface-2);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
}

.onboarding input::placeholder,
.onboarding textarea::placeholder {
  color: var(--joyo-lavender);
}

.onboarding input:focus,
.onboarding textarea:focus {
  outline: none;
  border-color: var(--joyo-gold);
  box-shadow: 0 0 0 3px var(--joyo-gold-soft);
}

.onboarding button {
  min-height: 44px;
  padding: 12px 22px;
  border-radius: var(--joyo-radius-pill);
  border: none;
  background: var(--joyo-gold);
  color: var(--joyo-on-gold);
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 0 18px var(--joyo-gold-soft);
  transition: background var(--joyo-dur-fast) var(--joyo-ease);
}

.onboarding button:hover {
  background: var(--joyo-gold-hover);
}

.onboarding .secondary,
.onboarding .options button,
.onboarding .chip {
  background: transparent;
  color: var(--joyo-lavender);
  border: 1px solid var(--joyo-line);
  box-shadow: none;
}

.onboarding .secondary:hover,
.onboarding .options button:hover,
.onboarding .chip:hover {
  background: transparent;
  color: var(--joyo-gold);
  border-color: var(--joyo-gold);
}

.onboarding .actions,
.onboarding .options {
  display: flex;
  flex-direction: column;
  gap: var(--joyo-space-3);
}

.onboarding .options button {
  background: var(--joyo-surface-2);
  color: var(--joyo-ivory);
  border-radius: var(--joyo-radius-input);
  text-align: left;
}

.onboarding .chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--joyo-space-2);
}

.onboarding .chip {
  min-height: 44px;
  padding: 8px 16px;
  background: var(--joyo-surface-2);
  color: var(--joyo-ivory);
  font-weight: 500;
}

.onboarding .chip[aria-pressed='true'] {
  background: var(--joyo-gold-soft);
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

.onboarding .skip {
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
  background: none;
  box-shadow: none;
  color: var(--joyo-lavender);
  font-weight: 500;
  text-decoration: underline;
}

.onboarding .skip:hover {
  background: none;
  color: var(--joyo-gold);
}

.onboarding .count,
.onboarding .hint {
  color: var(--joyo-lavender);
}

.onboarding .count {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.onboarding .error {
  color: var(--joyo-error);
}

.onboarding button:disabled {
  opacity: 0.5;
  cursor: default;
}

.onboarding .inputs {
  display: flex;
  gap: var(--joyo-space-3);
  align-items: stretch;
}

.onboarding .mic {
  flex: none;
  width: 48px;
  height: 48px;
  min-height: 48px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--joyo-surface-2);
  border: 1px solid var(--joyo-line);
  color: var(--joyo-ivory);
  box-shadow: none;
}

.onboarding .mic:hover,
.onboarding .mic.listening {
  background: var(--joyo-surface-2);
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

.onboarding .mic.listening {
  animation: joyo-pulse 1.6s var(--joyo-ease) infinite;
}

@keyframes joyo-pulse {
  50% {
    box-shadow: 0 0 0 8px var(--joyo-gold-soft);
  }
}

.onboarding .mic svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.onboarding .dropzone {
  flex: 1;
  gap: var(--joyo-space-1);
  padding: var(--joyo-space-3) var(--joyo-space-4);
  border: 1px dashed var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  cursor: pointer;
  transition: border-color var(--joyo-dur-fast) var(--joyo-ease);
}

.onboarding .dropzone:hover,
.onboarding .dropzone.dragging,
.onboarding .dropzone:focus-within {
  border-color: var(--joyo-gold);
}

.onboarding .dropzone small {
  font-weight: 400;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .onboarding .step {
    padding: 20px;
  }

  .onboarding h2 {
    font-size: 22px;
  }
}
</style>
