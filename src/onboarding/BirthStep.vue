<script setup lang="ts">
import { reactive } from 'vue'

import type { Birth } from './schema'

const emit = defineEmits<{ submit: [birth: Birth] }>()

const birth = reactive<Birth>({ date: '', place: '', timeOfDay: 'unknown', sureness: 'not_sure', notes: '' })
const today = new Date().toISOString().slice(0, 10)

const timesOfDay: { value: Birth['timeOfDay']; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
  { value: 'unknown', label: 'No idea' },
]

const sureness: { value: Birth['sureness']; label: string }[] = [
  { value: 'sure', label: 'Sure' },
  { value: 'fairly_sure', label: 'Fairly sure' },
  { value: 'not_sure', label: 'Not sure' },
]

function pickTimeOfDay(value: Birth['timeOfDay']) {
  birth.timeOfDay = value
  if (value === 'unknown') birth.sureness = 'not_sure'
}
</script>

<template>
  <form class="step" @submit.prevent="emit('submit', { ...birth })">
    <h2>When and where were you born?</h2>

    <label>
      Date of birth
      <input v-model="birth.date" type="date" :max="today" required />
    </label>

    <label>
      Place of birth
      <input v-model="birth.place" type="text" placeholder="Town or city, and country" required />
    </label>

    <fieldset>
      <legend>Has anyone told you roughly when?</legend>
      <div class="chips">
        <button
          v-for="option in timesOfDay"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="birth.timeOfDay === option.value"
          @click="pickTimeOfDay(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="birth.timeOfDay !== 'unknown'">
      <legend>How sure are they?</legend>
      <div class="chips">
        <button
          v-for="option in sureness"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="birth.sureness === option.value"
          @click="birth.sureness = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <label>
      Anything else you've heard about the time?
      <textarea
        v-model="birth.notes"
        rows="3"
        placeholder="Mum says just after breakfast. Or leave it blank, that's fine too."
      />
    </label>

    <button type="submit">Let's go</button>
  </form>
</template>
