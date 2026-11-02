<script setup lang="ts">
import { ref } from 'vue'

import type { Estimate } from '@/onboarding/schema'
import { outsideWindow, RECORD_SOURCES, type BirthRecord, type RecordSource } from './birth'
import { birthMs, formatDay } from './season'

const props = defineProps<{
  /** The birth date given at onboarding. */
  date: string
  estimate: Estimate
  record: BirthRecord | null
}>()

const emit = defineEmits<{ save: [record: BirthRecord]; clear: []; jump: [] }>()

const editing = ref(false)
const formDate = ref('')
const formTime = ref('')
const source = ref<RecordSource | null>(null)
const error = ref('')
const today = new Date().toISOString().slice(0, 10)

function open() {
  formDate.value = props.record?.date ?? props.date
  formTime.value = props.record?.time ?? ''
  source.value = props.record?.source ?? null
  error.value = ''
  editing.value = true
}

function save() {
  if (!formDate.value || formDate.value > today) return (error.value = 'Add the date you were born.')
  if (!formTime.value) return (error.value = 'Add the time it says.')
  if (!source.value) return (error.value = 'Pick where the time is written down.')
  emit('save', { date: formDate.value, time: formTime.value, source: source.value })
  editing.value = false
}

function useEstimate() {
  emit('clear')
  editing.value = false
}
</script>

<template>
  <section class="birth" aria-labelledby="birth-heading">
    <div class="head">
      <h3 id="birth-heading" class="label">Your birth</h3>
      <button v-if="!editing" type="button" class="link" @click="open">
        {{ record ? 'Change' : 'Found your birth time?' }}
      </button>
    </div>

    <button type="button" class="jump" title="Go to your birth on the timeline" @click="emit('jump')">
      <span class="day">{{ formatDay(birthMs(record?.date ?? date)) }}</span>
      <span class="time">{{ record ? record.time : `${estimate.earliest}–${estimate.latest}` }}</span>
    </button>

    <template v-if="record">
      <p class="source">From your {{ RECORD_SOURCES[record.source] }}</p>
      <p v-if="outsideWindow(record.time, estimate)" class="small">
        Your milestones pointed to <span class="mono">{{ estimate.earliest }}–{{ estimate.latest }}</span>. Written
        times are sometimes rounded, so Joyo uses yours.
      </p>
    </template>
    <template v-else>
      <p class="source">Estimated from your milestones · {{ estimate.confidence }} confidence</p>
      <p class="small">This is a best fit to the events you gave, not a certainty.</p>
    </template>

    <form v-if="editing" class="record" novalidate @submit.prevent="save">
      <p class="small">If your birth time is written down somewhere, Joyo uses it instead of the estimate.</p>
      <div class="fields">
        <label>
          <span class="label">Date</span>
          <input v-model="formDate" type="date" class="field mono" :max="today" />
        </label>
        <label>
          <span class="label">Time it says</span>
          <input v-model="formTime" type="time" class="field mono" />
        </label>
      </div>
      <fieldset>
        <legend class="label">Where is it written?</legend>
        <div class="chips">
          <button
            v-for="(label, key) in RECORD_SOURCES"
            :key="key"
            type="button"
            class="chip"
            :aria-pressed="source === key"
            @click="source = key"
          >
            {{ label.charAt(0).toUpperCase() + label.slice(1) }}
          </button>
        </div>
      </fieldset>
      <p v-if="error" class="error" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.3" /></svg>
        {{ error }}
      </p>
      <div class="actions">
        <button v-if="record" type="button" class="link" @click="useEstimate">Use the estimate instead</button>
        <button type="button" class="link" @click="editing = false">Cancel</button>
        <button type="submit" class="save">Use this time</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.birth {
  display: grid;
  gap: 6px;
  padding: 14px var(--joyo-space-4);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  background: var(--joyo-surface-2);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--joyo-space-3);
}

.label {
  margin: 0;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--joyo-lavender);
}

button {
  font: inherit;
  cursor: pointer;
}

.link {
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--joyo-lavender);
  font-size: 13px;
  font-weight: 500;
  text-decoration: underline;
  text-decoration-color: var(--joyo-line);
  text-underline-offset: 3px;
}

.link:hover {
  color: var(--joyo-gold);
  text-decoration-color: var(--joyo-gold);
}

.jump {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--joyo-space-1) var(--joyo-space-3);
  padding: 0;
  border: 0;
  background: none;
  color: var(--joyo-ivory);
  text-align: left;
}

.day {
  font-family: var(--joyo-font-display);
  font-size: 22px;
}

.time,
.mono {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
}

.time {
  font-size: 18px;
}

.jump:hover .day,
.jump:hover .time {
  color: var(--joyo-gold);
}

.source {
  margin: 0;
  font-size: 13px;
  color: var(--joyo-ivory);
}

.small {
  margin: 0;
  font-size: 12.5px;
  color: var(--joyo-lavender);
}

.record {
  display: grid;
  gap: var(--joyo-space-3);
  margin-top: var(--joyo-space-2);
  padding-top: var(--joyo-space-3);
  border-top: 1px solid var(--joyo-line);
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
}

.fields label {
  display: grid;
  gap: 6px;
}

.field {
  width: 100%;
  min-height: 44px;
  padding: 10px var(--joyo-space-3);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  background: var(--joyo-surface);
  color: var(--joyo-ivory);
  font-size: 16px;
  outline: none;
}

.field:focus {
  border-color: var(--joyo-gold);
  box-shadow: 0 0 0 3px var(--joyo-gold-soft);
}

fieldset {
  display: grid;
  gap: var(--joyo-space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  padding: 0;
  margin-bottom: var(--joyo-space-2);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--joyo-space-2);
}

.chip {
  min-height: 44px;
  padding: var(--joyo-space-2) 14px;
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-pill);
  background: var(--joyo-surface);
  color: var(--joyo-ivory);
  font-size: 14px;
  font-weight: 500;
}

.chip:hover {
  border-color: var(--joyo-gold);
}

.chip[aria-pressed='true'] {
  border-color: var(--joyo-gold);
  background: var(--joyo-gold-soft);
  color: var(--joyo-gold);
}

.chip[aria-pressed='true']::before {
  content: '✓ ';
}

.error {
  display: flex;
  align-items: center;
  gap: var(--joyo-space-2);
  margin: 0;
  font-size: 14px;
  color: var(--joyo-error);
}

.error svg {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--joyo-space-3);
}

/* Secondary: the panel's one gold primary is the milestone Add button. */
.save {
  min-height: 44px;
  margin-left: auto;
  padding: var(--joyo-space-2) 18px;
  border: 1px solid var(--joyo-gold);
  border-radius: var(--joyo-radius-pill);
  background: transparent;
  color: var(--joyo-gold);
  font-weight: 600;
}

.save:hover {
  background: var(--joyo-gold-soft);
}
</style>
