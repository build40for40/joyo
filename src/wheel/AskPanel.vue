<script setup lang="ts">
import { computed, ref } from 'vue'

import { matchQuestion, QUESTIONS, type Question, type Reading } from './questions'
import { DAY_MS, formatMonth, formatRange } from './season'

const props = defineProps<{
  reading: Reading | null
  /** The question as the user typed it, when they typed one. */
  asked: string
  /** Birth, as UTC ms. */
  birth: number
  /** Where the birth time came from when it's written down, or null while it's estimated. */
  recordSource: string | null
}>()

const emit = defineEmits<{ ask: [question: Question | null, text: string]; jump: [t: number] }>()

const draft = ref('')
const hint = ref('')

const ms = (days: number) => props.birth + days * DAY_MS
const heading = computed(() => props.asked || props.reading?.question.ask || '')
const asksShould = computed(() => /^\s*should\b/i.test(props.asked))

function choose(question: Question) {
  hint.value = ''
  draft.value = ''
  emit('ask', props.reading?.question.key === question.key ? null : question, '')
}

function ask() {
  const text = draft.value.trim()
  if (!text) {
    hint.value = 'Type a question, or pick one above.'
    return
  }
  const question = matchQuestion(text)
  if (!question) {
    hint.value = 'Joyo can answer about marriage, home, work, business, moving, children, study, money and health.'
    return
  }
  hint.value = ''
  emit('ask', question, text)
}
</script>

<template>
  <div class="ask">
    <p class="intro">
      Joyo reads your Vedic chart (Jyotish) to find the good seasons for life's big moments. Pick one, or ask your own,
      and they're marked on your timeline with ✦.
    </p>

    <div class="chips" role="group" aria-label="Questions">
      <button
        v-for="question in QUESTIONS"
        :key="question.key"
        type="button"
        class="chip"
        :aria-pressed="reading?.question.key === question.key"
        @click="choose(question)"
      >
        {{ question.label }}
      </button>
    </div>

    <form class="composer" @submit.prevent="ask">
      <label class="sr-only" for="question">Your question</label>
      <textarea
        id="question"
        v-model="draft"
        rows="2"
        placeholder="e.g. Should I move to another country?"
        @keydown.enter.exact.prevent="ask"
      />
      <div class="composer-bar">
        <span class="hint" aria-live="polite">{{ hint }}</span>
        <button type="submit" class="primary">Ask</button>
      </div>
    </form>

    <section v-if="reading" class="answer" aria-live="polite" aria-labelledby="answer-heading">
      <h3 id="answer-heading">{{ heading }}</h3>
      <p v-if="asksShould" class="note">If you do, these seasons support it.</p>

      <ul class="windows">
        <li v-for="window in reading.windows" :key="window.start">
          <button type="button" @click="emit('jump', window.peak)">
            <span class="when">
              <span class="star" aria-hidden="true">✦</span>
              <span class="range">{{ formatRange(ms(window.start), ms(window.end)) }}</span>
              <span v-if="window.strongest" class="tag">strongest</span>
            </span>
            <span class="why">{{ window.why }}</span>
          </button>
        </li>
      </ul>

      <p v-if="reading.quiet" class="note">
        <span class="range">{{ formatRange(ms(reading.quiet.start), ms(reading.quiet.end)) }}</span> is quieter, better
        for planning than big steps.
      </p>
      <p v-if="reading.matches.length" class="note">
        In your story:
        <template v-for="(milestone, i) in reading.matches" :key="milestone.t">
          {{ i ? ', ' : '' }}{{ milestone.name }} · {{ formatMonth(ms(milestone.t)) }}
        </template>
      </p>
      <p v-if="reading.question.key === 'health'" class="note">
        Go with your doctor's timing first. This only shows which seasons support it.
      </p>
      <p class="small">
        <template v-if="recordSource">Based on your birth time from your {{ recordSource }}.</template>
        <template v-else>
          This leans on your estimated birth time, so treat the edges of each window loosely. A written birth time would
          sharpen it.
        </template>
        These are seasons, not certainties.
      </p>
      <button type="button" class="link" @click="emit('ask', null, '')">Clear question</button>
    </section>
  </div>
</template>

<style scoped>
.ask {
  display: grid;
  gap: var(--joyo-space-3);
}

.intro,
.note,
.small {
  margin: 0;
  font-size: 14px;
  color: var(--joyo-lavender);
}

.small {
  font-size: 12.5px;
}

button {
  font: inherit;
  cursor: pointer;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--joyo-space-2);
}

.chip {
  min-height: 40px;
  padding: 6px 14px;
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-pill);
  background: var(--joyo-surface-2);
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
  min-height: 44px;
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

.hint {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--joyo-lavender);
}

.primary {
  min-height: 44px;
  padding: var(--joyo-space-2) 22px;
  border: 1px solid var(--joyo-gold);
  border-radius: var(--joyo-radius-pill);
  background: var(--joyo-gold);
  color: var(--joyo-on-gold);
  font-weight: 600;
  box-shadow: 0 0 22px var(--joyo-gold-soft);
}

.primary:hover {
  border-color: var(--joyo-gold-hover);
  background: var(--joyo-gold-hover);
}

.answer {
  display: grid;
  gap: var(--joyo-space-3);
  padding: var(--joyo-space-4);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  background: var(--joyo-surface-2);
}

.answer h3 {
  font-family: var(--joyo-font-display);
  font-size: 22px;
  line-height: 1.25;
}

.windows {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.windows button {
  display: grid;
  gap: 2px;
  width: 100%;
  min-height: 44px;
  padding: var(--joyo-space-2) var(--joyo-space-3);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  background: var(--joyo-surface);
  color: var(--joyo-ivory);
  text-align: left;
}

.windows button:hover {
  border-color: var(--joyo-gold);
}

.when {
  display: flex;
  align-items: baseline;
  gap: var(--joyo-space-2);
}

.star {
  color: var(--joyo-gold);
}

.range {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
}

.when .range {
  font-size: 15px;
  color: var(--joyo-gold);
}

.tag {
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--joyo-lavender);
}

.why {
  font-size: 13px;
  color: var(--joyo-lavender);
}

.link {
  justify-self: start;
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

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
