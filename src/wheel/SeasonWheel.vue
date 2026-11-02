<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import type { OnboardingResult } from '@/onboarding/schema'
import { loadBirthRecord, RECORD_SOURCES, saveBirthRecord, type BirthRecord } from './birth'
import BirthCard from './BirthCard.vue'
import LifeTimeline from './LifeTimeline.vue'
import { loadAddedMilestones, saveAddedMilestones, type AddedMilestone } from './milestones'
import {
  birthMs,
  DAY_MS,
  eventMs,
  formatDay,
  formatMonth,
  houseAction,
  litMilestone,
  milestonesFrom,
  parseMilestone,
  seasonModel,
  type Milestone,
} from './season'
import WheelCanvas from './WheelCanvas.vue'

const props = defineProps<{ result: OnboardingResult; now?: Date }>()

const FORECAST_YEARS = 12
const SPEEDS = [2, 5, 10]

const { estimate } = props.result

// A birth time found written down replaces the estimate, and everything is measured from it.
const record = ref<BirthRecord | null>(loadBirthRecord(props.result.completedAt))
const birthDate = computed(() => record.value?.date ?? props.result.birth.date)
const birthTime = computed(() => record.value?.time ?? estimate.bestGuess)
const birth = computed(() => birthMs(birthDate.value))
const today = computed(() => Math.round(((props.now ?? new Date()).getTime() - birth.value) / DAY_MS))
const span = computed(() => today.value + Math.round(FORECAST_YEARS * 365.25))
const model = computed(() => seasonModel(`${birthDate.value}|${birthTime.value}`))

const added = ref<AddedMilestone[]>(loadAddedMilestones(props.result.completedAt))
const milestones = computed<Milestone[]>(() => [
  ...milestonesFrom(estimate.events, birthDate.value),
  ...added.value.flatMap(({ id, name, date, house }) => {
    const t = Math.round(((eventMs(date) ?? birth.value) - birth.value) / DAY_MS)
    return t < 0 ? [] : [{ id, name, house, t }]
  }),
])

const t = ref(today.value)
// Keep the playhead on the same calendar day when the birth date changes.
watch(birth, (next, previous) => (t.value = Math.max(0, t.value + Math.round((previous - next) / DAY_MS))))

const scores = computed(() => model.value.scores(t.value, milestones.value))
const lit = computed(() => litMilestone(t.value, milestones.value))
const age = computed(() => Math.max(0, Math.floor(t.value / 365.25)))
const place = props.result.birth.place.split(',')[0]
const at = (days: number) => birth.value + days * DAY_MS

// Playback through life.
const playing = ref(false)
const speed = ref(5)
let frame = 0
let last = 0

function step(time: number) {
  t.value = Math.min(span.value, t.value + ((time - last) / 1000) * speed.value * 365.25)
  last = time
  if (t.value >= span.value) playing.value = false
  else frame = requestAnimationFrame(step)
}

watch(playing, (on) => {
  cancelAnimationFrame(frame)
  if (!on) return
  if (t.value >= span.value) t.value = 0
  last = performance.now()
  frame = requestAnimationFrame(step)
})

onBeforeUnmount(() => cancelAnimationFrame(frame))

function jumpTo(days: number) {
  playing.value = false
  t.value = days
}

// Announce a milestone once as the playhead reaches it.
const announcement = ref('')
watch(lit, (milestone, previous) => {
  if (milestone && milestone !== previous) {
    announcement.value = `${milestone.name} · lights up ${houseAction(milestone.house)}`
  }
})

// Adding to the story.
const draft = ref('')
const hint = ref('')
const flash = ref(0)

function add() {
  const text = draft.value.trim()
  if (!text) {
    hint.value = 'Type a milestone first.'
    return
  }
  const parsed = parseMilestone(text)
  if (!parsed.date) {
    hint.value = 'Add a month and year, like "March 2026", so Joyo can place it.'
    return
  }
  const at = eventMs(parsed.date)!
  if (at < birth.value) {
    hint.value = 'That date is before you were born. Check the year.'
    return
  }
  const milestone = { id: crypto.randomUUID(), name: parsed.name, date: parsed.date, house: parsed.house }
  added.value = [...added.value, milestone]
  saveAddedMilestones(props.result.completedAt, added.value)
  draft.value = ''
  hint.value = `Added · ${formatMonth(at)} → ${houseAction(parsed.house)}`
  jumpTo(Math.round((at - birth.value) / DAY_MS))
  flash.value++
}

function setRecord(next: BirthRecord | null) {
  record.value = next
  saveBirthRecord(props.result.completedAt, next)
  flash.value++
}

function remove(id: string) {
  added.value = added.value.filter((milestone) => milestone.id !== id)
  saveAddedMilestones(props.result.completedAt, added.value)
}

// Voice input, where the browser supports it.
type Recognition = {
  lang: string
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
}
const Speech = (window as unknown as Record<string, (new () => Recognition) | undefined>).SpeechRecognition ??
  (window as unknown as Record<string, (new () => Recognition) | undefined>).webkitSpeechRecognition
const listening = ref(false)

function listen() {
  if (!Speech || listening.value) return
  const recognition = new Speech()
  recognition.lang = 'en-GB'
  recognition.onresult = (event) => {
    draft.value = event.results[0]?.[0]?.transcript ?? ''
    hint.value = 'Check the text, then press Add.'
  }
  recognition.onerror = () => (hint.value = "Joyo couldn't hear that. Try again, or type it.")
  recognition.onend = () => (listening.value = false)
  listening.value = true
  hint.value = 'Listening…'
  recognition.start()
}

const sortedMilestones = computed(() => [...milestones.value].sort((a, b) => b.t - a.t))
</script>

<template>
  <div class="season">
    <header>
      <h1>Season Wheel</h1>
      <p class="person">
        Born <b>{{ formatDay(birth) }}</b> · <b>{{ place }}</b> ·
        <template v-if="record">
          <b class="mono">{{ record.time }}</b> ({{ RECORD_SOURCES[record.source] }})
        </template>
        <template v-else><b class="mono">{{ estimate.earliest }}–{{ estimate.latest }}</b> (estimated)</template>
      </p>
    </header>

    <div class="main">
      <div class="wheel-column">
        <WheelCanvas
          :scores="scores"
          :lit="lit ? lit.house - 1 : -1"
          :title="formatMonth(at(t))"
          :subtitle="t > today + 15 ? `Age ${age} · forecast` : `Age ${age}`"
          :detail="record ? `born ${record.time}` : `born ~${estimate.bestGuess}`"
          :flash="flash"
        />
        <p class="toast" aria-live="polite">{{ announcement }}</p>

        <div class="legend" aria-hidden="true">
          <div class="legend-bar" />
          <div class="legend-labels"><span>Resting</span><span>Steady</span><span>Active</span></div>
        </div>

        <section class="timeline-card" aria-label="Life timeline">
          <div class="timeline-head">
            <button type="button" class="play" :aria-label="playing ? 'Pause' : 'Play your life'" @click="playing = !playing">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="playing" d="M6 4h4v16H6zM14 4h4v16h-4z" />
                <path v-else d="M7 4l13 8-13 8z" />
              </svg>
            </button>
            <p class="date">
              {{ formatDay(at(t)) }}<small v-if="t > today + 15">forecast</small>
            </p>
            <div class="speed" role="group" aria-label="Playback speed">
              <button
                v-for="s in SPEEDS"
                :key="s"
                type="button"
                :aria-pressed="speed === s"
                @click="speed = s"
              >
                {{ s }} yr/s
              </button>
            </div>
          </div>
          <LifeTimeline v-model="t" :birth="birth" :span="span" :today="today" :milestones="milestones" />
          <input
            v-model.number="t"
            type="range"
            min="0"
            :max="span"
            step="1"
            aria-label="Date in your life"
            :aria-valuetext="formatDay(at(t))"
            @input="playing = false"
          />
        </section>
      </div>

      <section class="panel" aria-labelledby="story-heading">
        <BirthCard
          :date="result.birth.date"
          :estimate="estimate"
          :record="record"
          @save="setRecord"
          @clear="setRecord(null)"
          @jump="jumpTo(0)"
        />

        <div>
          <h2 id="story-heading">Add to your story</h2>
          <p>Type or say a milestone and roughly when it happened. Month and year is enough.</p>
        </div>

        <form class="composer" @submit.prevent="add">
          <label class="sr-only" for="milestone">New milestone</label>
          <textarea
            id="milestone"
            v-model="draft"
            rows="3"
            placeholder="e.g. Started a new role in March 2026"
            @keydown.enter.exact.prevent="add"
          />
          <div class="composer-bar">
            <button
              v-if="Speech"
              type="button"
              class="icon"
              :class="{ listening }"
              aria-label="Say a milestone"
              @click="listen"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
              </svg>
            </button>
            <span class="hint" aria-live="polite">{{ hint }}</span>
            <button type="submit" class="primary">Add</button>
          </div>
        </form>

        <div>
          <h3 class="label">Your milestones</h3>
          <ul class="milestones">
            <li
              v-for="milestone in sortedMilestones"
              :key="milestone.id ?? `${milestone.name}-${milestone.t}`"
              :class="{ lit: milestone === lit }"
            >
              <button type="button" class="jump" @click="jumpTo(milestone.t)">
                <b>{{ milestone.name }}<span v-if="milestone.id" class="new"> · added</span></b>
                <span>{{ formatMonth(at(milestone.t)) }} → {{ houseAction(milestone.house) }}</span>
              </button>
              <button
                v-if="milestone.id"
                type="button"
                class="remove"
                :aria-label="`Remove ${milestone.name}`"
                @click="remove(milestone.id)"
              >
                ×
              </button>
            </li>
            <li v-if="!sortedMilestones.length" class="empty">No dated moments yet. Add one above.</li>
          </ul>
        </div>
      </section>
    </div>

    <p class="note">
      Season colours are an early preview built from your milestones. Milestones and birth times you add here are saved on this device.
    </p>
  </div>
</template>

<style scoped>
.season {
  display: grid;
  gap: var(--joyo-space-5);
}

header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--joyo-space-2) var(--joyo-space-5);
}

.person {
  margin: 0;
  font-size: 14px;
  color: var(--joyo-lavender);
}

.person b {
  font-weight: 500;
  color: var(--joyo-ivory);
}

.mono {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
}

.main {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  align-items: start;
  gap: var(--joyo-space-5);
}

@media (max-width: 860px) {
  .main {
    grid-template-columns: minmax(0, 1fr);
  }
}

.wheel-column {
  position: relative;
  display: grid;
  justify-items: center;
  gap: var(--joyo-space-3);
}

.toast {
  position: absolute;
  top: var(--joyo-space-2);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  max-width: 90%;
  font-size: 13px;
  color: var(--joyo-ivory);
  text-align: center;
  pointer-events: none;
}

.toast:not(:empty) {
  padding: var(--joyo-space-2) 14px;
  border: 1px solid var(--joyo-gold);
  border-radius: var(--joyo-radius-pill);
  background: var(--joyo-surface-2);
}

.legend {
  display: grid;
  gap: 6px;
  width: min(420px, 100%);
}

.legend-bar {
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(
    90deg,
    var(--joyo-scale-1),
    var(--joyo-scale-2),
    var(--joyo-scale-3),
    var(--joyo-scale-4),
    var(--joyo-scale-5),
    var(--joyo-scale-6),
    var(--joyo-scale-7),
    var(--joyo-scale-8)
  );
}

.legend-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--joyo-lavender);
}

.timeline-card,
.panel {
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-card);
  background: var(--joyo-surface);
}

.timeline-card {
  display: grid;
  gap: var(--joyo-space-3);
  width: 100%;
  margin-top: 6px;
  padding: 18px 20px var(--joyo-space-4);
}

.timeline-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px 18px;
}

button {
  min-height: 44px;
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-pill);
  background: transparent;
  color: var(--joyo-lavender);
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--joyo-dur-fast),
    border-color var(--joyo-dur-fast),
    color var(--joyo-dur-fast);
}

button:hover {
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

.play {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  padding: 0;
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

.play:hover {
  background: var(--joyo-gold-soft);
}

.play svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}

.date {
  margin: 0;
  font-family: var(--joyo-font-display);
  font-size: 24px;
}

.date small {
  margin-left: 10px;
  font-family: var(--joyo-font-body);
  font-size: 13px;
}

.speed {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.speed button {
  padding: 6px 12px;
  font-size: 12px;
}

.speed button[aria-pressed='true'] {
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

input[type='range'] {
  width: 100%;
  height: 24px;
  margin: 0;
  background: transparent;
  appearance: none;
}

input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: var(--joyo-line);
}

input[type='range']::-moz-range-track {
  height: 4px;
  border-radius: 2px;
  background: var(--joyo-line);
}

input[type='range']::-webkit-slider-thumb {
  width: 18px;
  height: 18px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--joyo-gold);
  box-shadow: 0 0 0 4px var(--joyo-gold-soft);
  appearance: none;
}

input[type='range']::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border: 0;
  border-radius: 50%;
  background: var(--joyo-gold);
  box-shadow: 0 0 0 4px var(--joyo-gold-soft);
}

.panel {
  display: grid;
  gap: var(--joyo-space-4);
  padding: 20px;
}

.panel h2 {
  font-family: var(--joyo-font-display);
  font-weight: 400;
}

.panel p {
  margin: 0;
  font-size: 14px;
  color: var(--joyo-lavender);
}

.composer {
  display: grid;
  gap: var(--joyo-space-2);
  padding: var(--joyo-space-3);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-space-3);
  background: var(--joyo-surface-2);
  transition:
    border-color var(--joyo-dur-fast),
    box-shadow var(--joyo-dur-fast);
}

.composer:focus-within {
  border-color: var(--joyo-gold);
  box-shadow: 0 0 0 3px var(--joyo-gold-soft);
}

.composer textarea {
  min-height: 64px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 16px;
  resize: none;
}

.composer textarea::placeholder {
  color: var(--joyo-lavender);
}

.composer-bar {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
}

.icon svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon.listening {
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    box-shadow: 0 0 0 6px var(--joyo-gold-soft);
  }
}

.hint {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--joyo-lavender);
}

.primary {
  padding: var(--joyo-space-2) 22px;
  border-color: var(--joyo-gold);
  background: var(--joyo-gold);
  color: var(--joyo-on-gold);
  box-shadow: 0 0 22px var(--joyo-gold-soft);
}

.primary:hover {
  border-color: var(--joyo-gold-hover);
  background: var(--joyo-gold-hover);
  color: var(--joyo-on-gold);
}

.label {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--joyo-lavender);
}

.milestones {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.milestones li {
  display: flex;
  align-items: center;
  border-bottom: 1px dashed var(--joyo-line);
}

.jump {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 2px 10px;
  min-height: 40px;
  padding: 6px 0;
  border: 0;
  border-radius: 0;
  font-size: 13px;
  font-weight: 400;
  text-align: left;
}

.jump b {
  font-weight: 500;
  color: var(--joyo-ivory);
}

.jump:hover b,
.lit .jump b {
  color: var(--joyo-gold);
}

.new {
  font-weight: 400;
  font-size: 12px;
  color: var(--joyo-gold);
}

.remove {
  flex: none;
  width: 44px;
  padding: 0;
  border: 0;
  font-size: 18px;
  font-weight: 400;
}

.empty {
  padding: 6px 0;
  font-size: 13px;
  color: var(--joyo-lavender);
}

.note {
  margin: 0 auto;
  font-size: 12px;
  color: var(--joyo-lavender);
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
