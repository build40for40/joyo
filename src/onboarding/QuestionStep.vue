<script setup lang="ts">
import { ref } from 'vue'

import type { Question } from './schema'

defineProps<{ question: Question; number: number }>()
const emit = defineEmits<{ answer: [answer: string | null] }>()

const value = ref('')
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
      <textarea v-else v-model="value" rows="4" required />
      <button type="submit">Next</button>
    </template>

    <button type="button" class="skip" @click="emit('answer', null)">
      I don't know, skip
    </button>
  </form>
</template>
