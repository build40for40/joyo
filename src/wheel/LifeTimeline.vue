<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { Reading } from './questions'
import { DAY_MS, formatMonth, formatRange, MILESTONE_REACH, type Milestone } from './season'

const props = defineProps<{
  /** Birth, as UTC ms. */
  birth: number
  /** The days since birth the timeline shows, from and to. */
  from: number
  to: number
  /** Days from birth to today. */
  today: number
  milestones: readonly Milestone[]
  /** The seasons for an asked question, drawn as a strip with its best windows starred. */
  reading?: Reading | null
}>()

const t = defineModel<number>({ required: true })

const svg = ref<SVGSVGElement>()
const width = ref(0)
const PAD = 14
const ROWS = [24, 38, 52, 66]
const AXIS = 84
const BAND_Y = 94
const BAND_H = 10
const HEIGHT = computed(() => (props.reading ? 128 : 104))

const x = (days: number) => PAD + ((days - props.from) / (props.to - props.from)) * (width.value - PAD * 2)
const inView = (days: number) => days >= props.from && days <= props.to

const ticks = computed(() => {
  const first = new Date(props.birth + props.from * DAY_MS).getUTCFullYear()
  const last = new Date(props.birth + props.to * DAY_MS).getUTCFullYear()
  const step = last - first > 50 ? 20 : last - first > 12 ? 10 : 1
  const margin = step === 1 ? 1 : 3
  const years = []
  for (let year = Math.ceil((first + margin) / step) * step; year <= last - (step === 1 ? 0 : 2); year += step) {
    years.push({ year, x: x((Date.UTC(year, 0, 1) - props.birth) / DAY_MS) })
  }
  return years
})

/** Lays labels out in up to four rows so they don't overlap. Lit labels always show. */
const marks = computed(() => {
  const rowEnds: number[] = []
  const lit = (m: Milestone) => Math.abs(t.value - m.t) < MILESTONE_REACH
  return props.milestones
    .filter((milestone) => inView(milestone.t))
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
        lit: lit(milestone) || !!props.reading?.matches.includes(milestone),
        labelled: row < ROWS.length || lit(milestone),
      }
    })
})

const BAND_CELL = 3

const band = computed(() => {
  const reading = props.reading
  if (!reading || !width.value) return []
  const cells = Math.ceil((width.value - PAD * 2) / BAND_CELL)
  // Each cell takes the nearest step of the mood scale, so the strip uses the tokens.
  return Array.from({ length: cells }, (_, i) => {
    const value = reading.at(props.from + ((i + 0.5) / cells) * (props.to - props.from))
    return { x: PAD + i * BAND_CELL, width: BAND_CELL + 0.5, level: 1 + Math.round(value * 7) }
  })
})

/** Window labels share one row, so a label that would overlap the one before is left to its tooltip. */
const windows = computed(() => {
  let lastEnd = -Infinity
  return (props.reading?.windows ?? []).filter((window) => inView(window.peak)).map((window) => {
    const text = formatRange(props.birth + window.start * DAY_MS, props.birth + window.end * DAY_MS)
    const cx = x(window.peak)
    const textWidth = text.length * 6.3
    const left = Math.min(Math.max(cx - textWidth / 2, PAD), width.value - PAD - textWidth)
    const labelled = left > lastEnd + 6
    if (labelled) lastEnd = left + textWidth
    return { window, text, cx, labelX: left + textWidth / 2, labelled }
  })
})

function jumpTo(days: number) {
  t.value = days
}

function scrub(event: PointerEvent) {
  const box = svg.value!.getBoundingClientRect()
  const fraction = (event.clientX - box.left - PAD) / (box.width - PAD * 2)
  t.value = Math.round(props.from + Math.min(1, Math.max(0, fraction)) * (props.to - props.from))
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
    :style="{ height: `${HEIGHT + 20}px` }"
    role="img"
    aria-label="Your life timeline with milestones. Use the slider below to move through it."
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
  >
    <template v-if="width">
      <rect
        class="forecast"
        :x="Math.max(PAD, x(today))"
        y="2"
        :width="Math.max(0, width - PAD - Math.max(PAD, x(today)))"
        :height="HEIGHT - 2"
      />
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

      <g v-if="reading" class="season-band">
        <rect
          v-for="(cell, i) in band"
          :key="i"
          :x="cell.x"
          :y="BAND_Y"
          :width="cell.width"
          :height="BAND_H"
          :style="{ fill: `var(--joyo-scale-${cell.level})` }"
        />
        <g
          v-for="item in windows"
          :key="item.window.start"
          class="window"
          :class="{ strongest: item.window.strongest }"
          @pointerdown.stop="jumpTo(item.window.peak)"
        >
          <rect
            class="window-span"
            :x="x(item.window.start)"
            :y="BAND_Y - 2"
            :width="Math.max(4, x(item.window.end) - x(item.window.start))"
            :height="BAND_H + 4"
            rx="3"
          />
          <path
            class="window-star"
            :transform="`translate(${item.cx} ${BAND_Y + BAND_H / 2}) scale(${item.window.strongest ? 1.7 : 1.35})`"
            d="M0-7L1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8Z"
          />
          <text v-if="item.labelled" class="window-label" :x="item.labelX" :y="BAND_Y + BAND_H + 18" text-anchor="middle">
            {{ item.text }}
          </text>
          <title>{{ reading.question.label }} · {{ item.text }}</title>
        </g>
      </g>

      <g v-if="inView(0)" class="birth-mark">
        <circle :cx="x(0)" :cy="AXIS" r="5" />
        <text :x="x(0)" :y="reading ? BAND_Y + BAND_H + 18 : AXIS + 16">Born</text>
        <title>Born · {{ formatMonth(birth) }}</title>
      </g>

      <line class="today" :x1="x(today)" :x2="x(today)" y1="2" :y2="HEIGHT" />
      <text class="today-label" :x="x(today) + 6" y="11">TODAY</text>

      <template v-if="inView(t)">
        <line class="playhead" :x1="x(t)" :x2="x(t)" y1="4" :y2="HEIGHT" />
        <circle class="playhead-dot" :cx="x(t)" :cy="AXIS" r="5" />
      </template>
    </template>
  </svg>
</template>

<style scoped>
.timeline {
  display: block;
  width: 100%;
  cursor: pointer;
  touch-action: none;
  font-family: var(--joyo-font-body);
}

.forecast {
  fill: var(--joyo-lavender);
  opacity: 0.06;
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

.window {
  cursor: pointer;
}

.window-span {
  fill: none;
  stroke: var(--joyo-gold);
  stroke-width: 1.5;
}

.window-star {
  fill: var(--joyo-scale-8);
  stroke: var(--joyo-night);
  stroke-width: 0.6;
  filter: drop-shadow(0 0 5px var(--joyo-gold));
}

.window-label {
  font-family: var(--joyo-font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  fill: var(--joyo-gold);
}

.strongest .window-label {
  font-weight: 500;
  fill: var(--joyo-scale-8);
}

.playhead {
  stroke: var(--joyo-ivory);
  stroke-width: 1.5;
}

.playhead-dot {
  fill: var(--joyo-ivory);
}
</style>
