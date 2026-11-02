<script setup lang="ts">
import { shallowRef, useTemplateRef } from 'vue'

import AccountMenu, { type AccountUser } from '@/components/AccountMenu.vue'
import StarField from '@/components/StarField.vue'
import OnboardingFlow from '@/onboarding/OnboardingFlow.vue'
import type { OnboardingResult } from '@/onboarding/schema'
import SeasonWheel from '@/wheel/SeasonWheel.vue'

const result = shallowRef<OnboardingResult | null>(null)
const previewUser = shallowRef<AccountUser>()
const wheel = useTemplateRef<InstanceType<typeof SeasonWheel>>('wheel')

if (import.meta.env.DEV && window.location.hash === '#wheel-preview') {
  previewUser.value = { firstName: 'Preview', lastName: 'Person', email: 'preview@example.com' }
  import('@/wheel/preview').then((preview) => (result.value = preview.previewResult))
}
</script>

<template>
  <StarField />
  <div class="bar" :class="{ wide: result }">
    <AccountMenu
      :key="previewUser ? 'preview' : 'account'"
      :preview-user="previewUser"
      :can-update-birth="!!result"
      @update-birth="wheel?.editBirth()"
    />
  </div>
  <main v-if="result" class="wide">
    <SeasonWheel ref="wheel" :result="result" />
  </main>
  <main v-else>
    <h1>Joyo</h1>
    <OnboardingFlow @ready="result = $event" />
  </main>
</template>

<style scoped>
.bar {
  display: flex;
  justify-content: flex-end;
  max-width: 560px;
  margin: 0 auto;
  padding: var(--joyo-space-4) var(--joyo-space-4) 0;
}

main {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--joyo-space-5) var(--joyo-space-4) var(--joyo-space-7);
}

.bar.wide,
main.wide {
  max-width: 1180px;
}

main.wide {
  padding-top: var(--joyo-space-2);
}
</style>
