<script setup lang="ts">
import { reactive } from 'vue'

import type { Birth } from './schema'

const emit = defineEmits<{ submit: [birth: Birth] }>()

const birth = reactive<Birth>({ date: '', place: '', notes: '' })
const today = new Date().toISOString().slice(0, 10)
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

    <label>
      Anything you've heard about the time?
      <textarea
        v-model="birth.notes"
        rows="3"
        placeholder="Mum says just after breakfast. Or leave it blank, that's fine too."
      />
    </label>

    <button type="submit">Let's go</button>
  </form>
</template>
