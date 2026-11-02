<script setup lang="ts">
import { computed } from 'vue'

import type { Progress } from './api'
import { MONTH_DATED_NEEDED, type LifeEvent } from './schema'

const props = defineProps<{ progress: Progress; note: string | null; events: LifeEvent[] }>()

const score = computed(() => props.progress.score)
const leaders = computed(() => score.value.candidates.slice(0, 2))
const dated = computed(() => Math.min(score.value.counts.month, MONTH_DATED_NEEDED))
const CONFIDENCE = { low: 'Low', medium: 'Medium', high: 'High' } as const
const BAR = { low: 33, medium: 66, high: 100 } as const
</script>

<template>
  <section class="progress" aria-live="polite" aria-label="Where your birth time stands">
    <p class="count">Where it stands</p>

    <div v-if="score.bestTime && score.range" class="readout">
      <span class="time">{{ score.bestTime }}</span>
      <span class="small">likely {{ score.range.start }}–{{ score.range.end }} · {{ leaders[0]?.lagna }} rising</span>
    </div>
    <div v-else-if="leaders.length && score.counts.usable" class="readout">
      <span class="lead">Not enough yet</span>
      <span class="small">
        Leading:
        <template v-for="(c, i) in leaders" :key="c.lagna + c.start">
          {{ i ? ' · ' : '' }}{{ c.lagna }} <span class="mono">{{ c.start }}–{{ c.end }}</span>
        </template>
      </span>
    </div>
    <div v-else class="readout">
      <span class="lead">Waiting for dated events</span>
      <span class="small">Each date you give is checked against the sky on the day you were born.</span>
    </div>

    <div class="meters">
      <div>
        <span class="small">Confidence: {{ CONFIDENCE[score.confidence] }}</span>
        <div class="bar" role="img" :aria-label="`${CONFIDENCE[score.confidence]} confidence`">
          <span :style="{ width: `${BAR[score.confidence]}%` }" />
        </div>
      </div>
      <div>
        <span class="small">{{ dated }} of {{ MONTH_DATED_NEEDED }} dated events</span>
        <div class="bar" role="img" :aria-label="`${dated} of ${MONTH_DATED_NEEDED} dated events`">
          <span :style="{ width: `${(dated / MONTH_DATED_NEEDED) * 100}%` }" />
        </div>
      </div>
    </div>

    <p v-if="note" class="note">✦ {{ note }}</p>
    <p v-else-if="events.length" class="small">{{ progress.moved }}</p>
  </section>
</template>

<style scoped>
.progress {
  display: flex;
  flex-direction: column;
  gap: var(--joyo-space-3);
  margin-bottom: var(--joyo-space-4);
  padding: var(--joyo-space-4) var(--joyo-space-5);
  background: var(--joyo-surface);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-card);
}

.readout {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--joyo-space-2) var(--joyo-space-3);
}

.time {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 34px;
  line-height: 1;
  color: var(--joyo-gold);
}

.lead {
  font-family: var(--joyo-font-display);
  font-size: 22px;
}

.mono {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
}

.small {
  font-size: 14px;
  color: var(--joyo-lavender);
}

.meters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--joyo-space-4);
}

.bar {
  height: 6px;
  margin-top: var(--joyo-space-1);
  background: var(--joyo-surface-2);
  border-radius: var(--joyo-radius-pill);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  background: var(--joyo-gold);
  border-radius: inherit;
  transition: width var(--joyo-dur) var(--joyo-ease);
}

.note {
  color: var(--joyo-ivory);
}

@media (max-width: 480px) {
  .meters {
    grid-template-columns: 1fr;
  }
}
</style>
