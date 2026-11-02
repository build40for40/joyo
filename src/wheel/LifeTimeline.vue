<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { DAY_MS, formatMonth, MILESTONE_REACH, type Milestone } from './season'

const props = defineProps<{
  /** Birth, as UTC ms. */
  birth: number
  /** Days from birth to the end of the timeline. */
  span: number
  /** Days from birth to today. */
  today: number
  milestones: readonly Milestone[]
}>()

const t = defineModel<number>({ required: true })

const svg = ref<SVGSVGElement>()
const width = ref(0)
const HEIGHT = 112
const PAD = 14
const AXIS = 76
const ROWS = [12, 28, 44, 60]

const x = (days: number) => PAD + (days / props.span) * (width.value - PAD * 2)

const ticks = computed(() => {
  const first = new Date(props.birth).getUTCFullYear()
  const last = new Date(props.birth + props.span * DAY_MS).getUTCFullYear()
  const step = last - first > 50 ? 20 : 10
  const years = []
  for (let year = Math.ceil((first + 3) / step) * step; year <= last - 2; year += step) {
    years.push({ year, x: x((Date.UTC(year, 0, 1) - props.birth) / DAY_MS) })
  }
  return years
})

/** Lays labels out in up to four rows so they don't overlap. Lit labels always show. */
const marks = computed(() => {
  const rowEnds: number[] = []
  const lit = (m: Milestone) => Math.abs(t.value - m.t) < MILESTONE_REACH
  return [...props.milestones]
    .sort((a, b) => Number(lit(b)) - Number(lit(a)) || a.t - b.t)
    .map((milestone) => {
      const mx = x(milestone.t)
      const textWidth = milestone.name.length * 6.3
      const anchor = mx > width.value - textWidth / 2 - PAD ? 'end' : mx < textWidth / 2 + PAD ? 'start' : 'middle'
      const left = anchor === 'end' ? mx - textWidth : anchor === 'start' ? mx : mx - textWidth / 2
      let row = rowEnds.findIndex((end) => end < left - 8)
      if (row < 0) row = rowEnds.length
      if (row < ROWS.length) rowEnds[row] = left + textWidth
      return {
        milestone,
        x: mx,
        y: ROWS[Math.min(row, ROWS.length - 1)]!,
        anchor,
        lit: lit(milestone),
        labelled: row < ROWS.length || lit(milestone),
      }
    })
})

function scrub(event: PointerEvent) {
  const box = svg.value!.getBoundingClientRect()
  const fraction = (event.clientX - box.left - PAD) / (box.width - PAD * 2)
  t.value = Math.round(Math.min(1, Math.max(0, fraction)) * props.span)
}

function onPointerDown(event: PointerEvent) {
  scrub(event)
  svg.value?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (svg.value?.hasPointerCapture?.(event.pointerId)) scrub(event)
}

let resize: ResizeObserver | undefined
onMounted(() => {
  width.value = svg.value?.clientWidth ?? 0
  if (typeof ResizeObserver === 'undefined' || !svg.value) return
  resize = new ResizeObserver(() => (width.value = svg.value?.clientWidth ?? 0))
  resize.observe(svg.value)
})
onBeforeUnmount(() => resize?.disconnect())
</script>

<template>
  <svg
    ref="svg"
    class="timeline"
    :viewBox="`0 0 ${width} ${HEIGHT + 20}`"
    role="img"
    aria-label="Your life timeline with milestones. Use the slider below to move through it."
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
  >
    <template v-if="width">
      <rect class="forecast" :x="x(today)" y="2" :width="Math.max(0, width - PAD - x(today))" :height="HEIGHT - 2" />
      <text class="forecast-label" :x="(x(today) + width - PAD) / 2" y="52" text-anchor="middle">FORECAST</text>
      <line class="axis" :x1="PAD" :x2="width - PAD" :y1="AXIS" :y2="AXIS" />

      <g v-for="tick in ticks" :key="tick.year">
        <line class="axis" :x1="tick.x" :x2="tick.x" :y1="HEIGHT + 2" :y2="HEIGHT + 6" />
        <text class="year" :x="tick.x" :y="HEIGHT + 17" text-anchor="middle">{{ tick.year }}</text>
      </g>

      <g v-for="mark in marks" :key="`${mark.milestone.name}-${mark.milestone.t}`" :class="{ lit: mark.lit }">
        <line v-if="mark.labelled" class="stem" :x1="mark.x" :x2="mark.x" :y1="mark.y + 6" :y2="AXIS - 6" />
        <path
          class="star"
          :transform="`translate(${mark.x} ${AXIS}) scale(${mark.lit ? 1.4 : 1})`"
          d="M0-7L1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z"
        >
          <title>{{ mark.milestone.name }} · {{ formatMonth(birth + mark.milestone.t * DAY_MS) }}</title>
        </path>
        <text v-if="mark.labelled" class="label" :x="mark.x" :y="mark.y" :text-anchor="mark.anchor">
          {{ mark.milestone.name }}
        </text>
      </g>

      <g class="birth-mark">
        <circle :cx="x(0)" :cy="AXIS" r="5" />
        <text :x="x(0)" :y="AXIS + 18">Born</text>
        <title>Born · {{ formatMonth(birth) }}</title>
      </g>

      <line class="today" :x1="x(today)" :x2="x(today)" y1="2" :y2="HEIGHT" />
      <text class="today-label" :x="x(today) + 6" :y="HEIGHT - 4">TODAY</text>

      <line class="playhead" :x1="x(t)" :x2="x(t)" y1="4" :y2="HEIGHT" />
      <circle class="playhead-dot" :cx="x(t)" :cy="AXIS" r="5" />
    </template>
  </svg>
</template>

<style scoped>
.timeline {
  display: block;
  width: 100%;
  height: 132px;
  cursor: pointer;
  touch-action: none;
  font-family: var(--joyo-font-body);
}

.forecast {
  fill: var(--joyo-lavender);
  opacity: 0.06;
}

.forecast-label {
  font-size: 10.5px;
  letter-spacing: 1.5px;
  fill: var(--joyo-lavender);
}

.axis {
  stroke: var(--joyo-line);
}

.year,
.today-label {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 10.5px;
  fill: var(--joyo-lavender);
}

.today {
  stroke: var(--joyo-gold);
  stroke-dasharray: 3 3;
  opacity: 0.7;
}

.today-label {
  fill: var(--joyo-gold);
}

.stem {
  stroke: var(--joyo-line);
}

.star {
  fill: var(--joyo-gold);
}

.label {
  font-size: 11.5px;
  fill: var(--joyo-ivory);
}

.lit .stem {
  stroke: var(--joyo-gold);
}

.lit .star {
  fill: var(--joyo-scale-8);
  filter: drop-shadow(0 0 6px var(--joyo-scale-8));
}

.lit .label {
  fill: var(--joyo-scale-8);
}

.birth-mark circle {
  fill: var(--joyo-night);
  stroke: var(--joyo-gold);
  stroke-width: 1.5;
}

.birth-mark text {
  font-size: 11px;
  fill: var(--joyo-gold);
}

.playhead {
  stroke: var(--joyo-ivory);
  stroke-width: 1.5;
}

.playhead-dot {
  fill: var(--joyo-ivory);
}
</style>
