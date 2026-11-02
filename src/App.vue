<script setup lang="ts">
import { shallowRef } from 'vue'

import StarField from '@/components/StarField.vue'
import OnboardingFlow from '@/onboarding/OnboardingFlow.vue'
import type { OnboardingResult } from '@/onboarding/schema'
import SeasonWheel from '@/wheel/SeasonWheel.vue'

const result = shallowRef<OnboardingResult | null>(null)

if (import.meta.env.DEV && window.location.hash === '#wheel-preview') {
  import('@/wheel/preview').then((preview) => (result.value = preview.previewResult))
}
</script>

<template>
  <StarField />
  <main v-if="result" class="wide">
    <SeasonWheel :result="result" />
  </main>
  <main v-else>
    <h1>Joyo</h1>
    <OnboardingFlow @ready="result = $event" />
  </main>
</template>

<style scoped>
main {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--joyo-space-7) var(--joyo-space-4);
}

main.wide {
  max-width: 1180px;
  padding-top: var(--joyo-space-5);
}
</style>
