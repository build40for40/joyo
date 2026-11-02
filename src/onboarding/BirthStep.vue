<script setup lang="ts">
import { reactive, ref } from 'vue'

import type { Birth } from './schema'

const emit = defineEmits<{ submit: [birth: Birth] }>()

type Knowledge = 'exact' | 'rough' | 'none'

const birth = reactive<Birth>({
  date: '',
  place: '',
  timeOfDay: 'unknown',
  sureness: 'not_sure',
  time: null,
  timeSource: null,
  notes: '',
})
const knows = ref<Knowledge>('none')
const exactTime = ref('')
const today = new Date().toISOString().slice(0, 10)

const knowledge: { value: Knowledge; label: string }[] = [
  { value: 'exact', label: 'Yes, the exact time' },
  { value: 'rough', label: 'Roughly' },
  { value: 'none', label: 'No idea' },
]

const timesOfDay: { value: Birth['timeOfDay']; label: string }[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
  { value: 'night', label: 'Night' },
]

const sources: { value: NonNullable<Birth['timeSource']>; label: string }[] = [
  { value: 'certificate', label: 'Birth certificate' },
  { value: 'hospital', label: 'Hospital record' },
  { value: 'kundli', label: 'Kundli' },
  { value: 'diary', label: 'Family diary' },
  { value: 'memory', label: 'Someone remembers it' },
]

const sureness: { value: Birth['sureness']; label: string }[] = [
  { value: 'sure', label: 'Sure' },
  { value: 'fairly_sure', label: 'Fairly sure' },
  { value: 'not_sure', label: 'Not sure' },
]

function timeOfDayAt(time: string): Birth['timeOfDay'] {
  const hour = Number(time.slice(0, 2))
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

function pickKnowledge(value: Knowledge) {
  knows.value = value
  if (value === 'exact') birth.timeSource ??= 'certificate'
}

function details(): Birth {
  const { date, place, notes } = birth
  if (knows.value === 'exact' && exactTime.value) {
    const remembered = birth.timeSource === 'memory'
    return {
      date,
      place,
      notes,
      time: exactTime.value,
      timeSource: birth.timeSource,
      timeOfDay: timeOfDayAt(exactTime.value),
      sureness: remembered ? birth.sureness : 'sure',
    }
  }
  if (knows.value === 'rough') return { ...birth, time: null, timeSource: null }
  return { date, place, notes, timeOfDay: 'unknown', sureness: 'not_sure', time: null, timeSource: null }
}
</script>

<template>
  <form class="step" @submit.prevent="emit('submit', details())">
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
      <legend>Do you know what time you were born?</legend>
      <div class="chips">
        <button
          v-for="option in knowledge"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="knows === option.value"
          @click="pickKnowledge(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <template v-if="knows === 'exact'">
      <label>
        Time of birth
        <input v-model="exactTime" type="time" required />
        <small class="hint">Local time where you were born.</small>
      </label>

      <fieldset>
        <legend>Where's that time from?</legend>
        <div class="chips">
          <button
            v-for="option in sources"
            :key="option.value"
            type="button"
            class="chip"
            :aria-pressed="birth.timeSource === option.value"
            @click="birth.timeSource = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </fieldset>
    </template>

    <fieldset v-if="knows === 'rough'">
      <legend>Has anyone told you roughly when?</legend>
      <div class="chips">
        <button
          v-for="option in timesOfDay"
          :key="option.value"
          type="button"
          class="chip"
          :aria-pressed="birth.timeOfDay === option.value"
          @click="birth.timeOfDay = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </fieldset>

    <fieldset v-if="knows === 'rough' || (knows === 'exact' && birth.timeSource === 'memory')">
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
