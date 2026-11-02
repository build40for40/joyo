<script setup lang="ts">
defineProps<{ error: string | null }>()
const emit = defineEmits<{ start: []; signIn: [] }>()
</script>

<template>
  <section class="step card">
    <h2 class="question">Find the time you were born</h2>
    <p>Joyo works out your birth time from the dated moments of your life, one question at a time.</p>

    <div class="actions">
      <button type="button" class="primary" @click="emit('start')">Starting new</button>
      <button type="button" class="secondary" @click="emit('signIn')">I have an account</button>
    </div>
    <p v-if="error" class="error" role="alert">✦ {{ error }}</p>
  </section>
</template>
