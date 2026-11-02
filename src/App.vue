<script setup lang="ts">
import StarField from '@/components/StarField.vue'
import OnboardingFlow from '@/onboarding/OnboardingFlow.vue'
</script>

<template>
  <StarField />
  <main>
    <h1>Joyo</h1>
    <OnboardingFlow />
  </main>
</template>

<style scoped>
main {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--joyo-space-7) var(--joyo-space-4);
}
</style>
