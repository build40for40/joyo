<script setup lang="ts">
import { ref } from 'vue'

import { describeEvents, extractEvents } from './api'
import { useDictation } from './dictation'
import { UPLOAD_TYPES, type Question } from './schema'

defineProps<{ question: Question; number: number }>()
const emit = defineEmits<{ answer: [answer: string | null] }>()

const value = ref('')
const reading = ref(false)
const uploadError = ref<string | null>(null)
const dragging = ref(false)

function append(text: string) {
  if (text) value.value = value.value.trim() ? `${value.value.trim()}\n${text}` : text
}

const dictation = useDictation(append)

async function read(file: File | undefined) {
  if (!file) return
  reading.value = true
  uploadError.value = null
  try {
    const events = await extractEvents(file)
    if (events.length) append(describeEvents(events))
    else uploadError.value = "We couldn't find any dates in that document."
  } catch (cause) {
    uploadError.value = cause instanceof Error ? cause.message : "We couldn't read that document."
  } finally {
    reading.value = false
  }
}

function drop(event: DragEvent) {
  dragging.value = false
  read(event.dataTransfer?.files[0])
}
</script>

<template>
  <form class="step" @submit.prevent="emit('answer', value.trim() || null)">
    <p class="count">Question {{ number }}</p>
    <h2>{{ question.text }}</h2>
    <p v-if="question.hint" class="hint">{{ question.hint }}</p>

    <div v-if="question.input === 'choice'" class="options">
      <button
        v-for="option in question.options"
        :key="option"
        type="button"
        @click="emit('answer', option)"
      >
        {{ option }}
      </button>
    </div>
    <template v-else>
      <input v-if="question.input === 'date'" v-model="value" type="date" required />
      <input v-else-if="question.input === 'time'" v-model="value" type="time" required />
      <template v-else>
        <textarea v-model="value" rows="5" required aria-label="Your answer" placeholder="Type, speak or upload a document" />

        <div class="inputs">
          <button
            v-if="dictation.supported"
            type="button"
            class="mic"
            :class="{ listening: dictation.listening.value }"
            :aria-pressed="dictation.listening.value"
            @click="dictation.listening.value ? dictation.stop() : dictation.start()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
            <span class="visually-hidden">{{ dictation.listening.value ? 'Stop listening' : 'Speak your answer' }}</span>
          </button>

          <label
            class="dropzone"
            :class="{ dragging }"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="drop"
          >
            <input
              type="file"
              class="visually-hidden"
              :accept="UPLOAD_TYPES.join(',')"
              :disabled="reading"
              @change="read(($event.target as HTMLInputElement).files?.[0])"
            />
            <span>{{ reading ? 'Reading your document…' : 'Upload a CV, visa letter or certificate' }}</span>
            <small>PDF, photo or text, up to 10 MB. We only read dates, places and event types.</small>
          </label>
        </div>

        <p v-if="dictation.listening.value" class="hint" aria-live="polite">Listening… tap the mic again to stop.</p>
        <p v-if="dictation.error.value" class="error" role="alert">✦ {{ dictation.error.value }}</p>
        <p v-if="uploadError" class="error" role="alert">✦ {{ uploadError }}</p>
      </template>
      <button type="submit" :disabled="reading">Next</button>
    </template>

    <button type="button" class="skip" @click="emit('answer', null)">
      I don't know, skip
    </button>
  </form>
</template>
