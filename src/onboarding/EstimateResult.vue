<script setup lang="ts">
import type { Estimate } from './schema'

defineProps<{ estimate: Estimate }>()
const emit = defineEmits<{ restart: [] }>()
</script>

<template>
  <section class="step">
    <p class="count">Your first estimate</p>
    <h2>Between {{ estimate.earliest }} and {{ estimate.latest }}</h2>
    <p>
      Best guess <strong>{{ estimate.bestGuess }}</strong>, local time where you were born.
      Confidence: <strong>{{ estimate.confidence }}</strong>.
    </p>
    <p>{{ estimate.summary }}</p>

    <template v-if="estimate.basis.length">
      <h3>What shaped it</h3>
      <ul>
        <li v-for="reason in estimate.basis" :key="reason">{{ reason }}</li>
      </ul>
    </template>

    <button type="button" class="skip" @click="emit('restart')">Start again</button>
  </section>
</template>
