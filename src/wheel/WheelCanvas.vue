<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { houseAction, HOUSES, seasonWord } from './season'

const props = defineProps<{
  scores: number[]
  /** House index (0 to 11) lit by a nearby milestone, or -1. */
  lit: number
  title: string
  subtitle: string
  detail: string
  /** Changes whenever a milestone is added, to flash the ring. */
  flash: number
}>()

const canvas = ref<HTMLCanvasElement>()
const tip = ref<{ x: number; y: number; house: number } | null>(null)

const RES = 320
const OUTER = 0.84
const BLEND = 0.34
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

type Rgb = [number, number, number]
interface Palette {
  scale: Rgb[]
  night: Rgb
  ivory: string
  lavender: string
  gold: string
  goldLight: string
  display: string
  body: string
  mono: string
}

let palette: Palette | undefined
let ring: { ctx: CanvasRenderingContext2D; image: ImageData; angle: Float32Array; radius: Float32Array } | undefined
let ringCanvas: HTMLCanvasElement | undefined
let frame = 0
let flashAt = 0
let hover = -1

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function rgb(hex: string): Rgb {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as Rgb
}

function readPalette(): Palette {
  return {
    scale: Array.from({ length: 8 }, (_, i) => rgb(token(`--joyo-scale-${i + 1}`))),
    night: rgb(token('--joyo-night')),
    ivory: token('--joyo-ivory'),
    lavender: token('--joyo-lavender'),
    gold: token('--joyo-gold'),
    goldLight: token('--joyo-scale-8'),
    display: token('--joyo-font-display'),
    body: token('--joyo-font-body'),
    mono: token('--joyo-font-mono'),
  }
}

function scaleColour(scale: Rgb[], value: number): Rgb {
  const x = value * (scale.length - 1)
  const i = Math.min(scale.length - 2, Math.floor(x))
  const f = x - i
  return scale[i]!.map((c, k) => c + (scale[i + 1]![k]! - c) * f) as Rgb
}

/** House 1 starts at 9 o'clock and the houses run anticlockwise. Takes maths degrees, returns 0 to 12. */
const housePosition = (degrees: number) => ((((degrees - 180) % 360) + 360) % 360) / 30

function setUpRing() {
  ringCanvas = document.createElement('canvas')
  ringCanvas.width = ringCanvas.height = RES
  const ctx = ringCanvas.getContext('2d')
  if (!ctx) return
  const angle = new Float32Array(RES * RES)
  const radius = new Float32Array(RES * RES)
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const dx = x - RES / 2 + 0.5
      const dy = -(y - RES / 2 + 0.5)
      angle[y * RES + x] = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360
      radius[y * RES + x] = Math.hypot(dx, dy) / (RES / 2)
    }
  }
  ring = { ctx, image: ctx.createImageData(RES, RES), angle, radius }
}

/** Paints the wedges so neighbours blend into each other and the centre settles to their average, like a mood ring. */
function paintRing(scores: number[], time: number) {
  if (!ring || !palette) return
  const { scale } = palette
  const colours = scores.map((value) => scaleColour(scale, value))
  const average = [0, 1, 2].map((k) => colours.reduce((sum, c) => sum + c[k]!, 0) / colours.length)
  const data = ring.image.data
  for (let p = 0; p < RES * RES; p++) {
    const r = ring.radius[p]!
    const o = p * 4
    if (r > OUTER + 0.03) {
      data[o + 3] = 0
      continue
    }
    const angle = ring.angle[p]!
    const position = housePosition(angle) - 0.5
    const index = Math.floor(position)
    let k = (position - index - (0.5 - BLEND)) / (2 * BLEND)
    k = k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k)
    const a = colours[(index + 12) % 12]!
    const b = colours[(index + 13) % 12]!
    let centre = r / 0.42
    centre = centre > 1 ? 0 : 1 - centre * centre * (3 - 2 * centre)
    const shimmer = 1 + 0.045 * Math.sin(angle * 0.0349 + r * 9 - time / 900)
    const shade = shimmer * (1 - 0.06 * (r / OUTER))
    for (let q = 0; q < 3; q++) {
      const v = a[q]! + (b[q]! - a[q]!) * k
      data[o + q] = Math.min(255, (v + (average[q]! - v) * centre * 0.85) * shade)
    }
    data[o + 3] = 255 * Math.max(0, Math.min((OUTER + 0.03 - r) / 0.06, 1))
  }
  ring.ctx.putImageData(ring.image, 0, 0)
}

function wheelRadius(size: number) {
  return (size / 2) * (size < 480 ? 0.56 : 0.7)
}

function draw(time: number) {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx || !palette || !ringCanvas) return
  const size = el.clientWidth
  if (!size) return
  const dpr = window.devicePixelRatio || 1
  if (el.width !== Math.round(size * dpr)) el.width = el.height = Math.round(size * dpr)

  const W = el.width
  const C = W / 2
  const rr = wheelRadius(size) * dpr
  const { night } = palette
  const nightA = (alpha: number) => `rgba(${night.join(',')},${alpha})`
  const rad = (degrees: number) => (degrees * Math.PI) / 180
  const at = (degrees: number, r: number) => [C + Math.cos(rad(degrees)) * r, C - Math.sin(rad(degrees)) * r] as const

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, W, W)
  paintRing(props.scores, reduceMotion ? 0 : time)

  // A soft glow under the ring, then the ring itself.
  ctx.save()
  ctx.filter = `blur(${W * 0.03}px)`
  ctx.globalAlpha = 0.55
  ctx.drawImage(ringCanvas, C - rr, C - rr, rr * 2, rr * 2)
  ctx.restore()
  ctx.drawImage(ringCanvas, C - rr, C - rr, rr * 2, rr * 2)

  ctx.strokeStyle = nightA(0.35)
  ctx.lineWidth = dpr
  for (let h = 0; h < 12; h++) {
    const [x1, y1] = at(180 + 30 * h, rr * 0.45)
    const [x2, y2] = at(180 + 30 * h, rr * OUTER)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }

  const outlines: [number, string, number][] = [
    [props.lit, palette.goldLight, 3],
    [hover, palette.ivory, 1.5],
  ]
  for (const [house, colour, width] of outlines) {
    if (house < 0) continue
    ctx.strokeStyle = colour
    ctx.lineWidth = width * dpr
    ctx.shadowColor = palette.goldLight
    ctx.shadowBlur = house === props.lit ? 18 * dpr : 0
    ctx.beginPath()
    ctx.arc(C, C, rr * OUTER + 4 * dpr, -rad(180 + 30 * house), -rad(210 + 30 * house), true)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  const fs = Math.max(10, Math.min(14, size / 40)) * dpr
  const compact = size < 480
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  HOUSES.forEach((house, h) => {
    const angle = 195 + 30 * h
    const [ax, ay] = at(angle, rr * (OUTER + 0.07))
    const caption = compact ? house.name : `House ${h + 1} · ${house.name}`
    ctx.font = `400 ${fs * 0.78}px ${palette!.body}`
    const tw = Math.max(ctx.measureText(caption).width, fs * 6)
    const x = ax + (Math.cos(rad(angle)) * tw) / 2
    const y = ay - (Math.sin(rad(angle)) * fs * 3.2) / 2
    const isLit = h === props.lit
    ctx.font = `600 ${fs}px ${palette!.body}`
    ctx.fillStyle = isLit ? palette!.goldLight : palette!.ivory
    ctx.fillText(house.action, x, y - fs * 1.15)
    ctx.font = `400 ${fs * 0.8}px ${palette!.mono}`
    ctx.fillStyle = isLit ? palette!.gold : palette!.lavender
    ctx.fillText(seasonWord(props.scores[h]), x, y + fs * 0.05)
    ctx.font = `400 ${fs * 0.78}px ${palette!.body}`
    ctx.fillStyle = palette!.lavender
    ctx.fillText(caption, x, y + fs * 1.2)
  })

  // A dark pool in the middle for the date readout.
  const cr = rr * 0.3
  const pool = ctx.createRadialGradient(C, C, 0, C, C, cr)
  pool.addColorStop(0, nightA(0.88))
  pool.addColorStop(0.65, nightA(0.78))
  pool.addColorStop(1, nightA(0))
  ctx.fillStyle = pool
  ctx.beginPath()
  ctx.arc(C, C, cr, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = palette.ivory
  ctx.font = `400 ${fs * 1.7}px ${palette.display}`
  ctx.fillText(props.title, C, C - fs * 0.9)
  ctx.fillStyle = palette.lavender
  ctx.font = `500 ${fs * 0.85}px ${palette.body}`
  ctx.fillText(props.subtitle, C, C + fs * 0.6)
  ctx.font = `400 ${fs * 0.8}px ${palette.mono}`
  ctx.fillText(props.detail, C, C + fs * 1.8)

  if (flashAt && time - flashAt < 900) {
    const fade = 1 - (time - flashAt) / 900
    const [r, g, b] = palette.scale[7]!
    ctx.fillStyle = `rgba(${r},${g},${b},${0.35 * fade})`
    ctx.beginPath()
    ctx.arc(C, C, rr * OUTER * (1 + 0.08 * (1 - fade)), 0, Math.PI * 2)
    ctx.fill()
  }
}

function loop(time: number) {
  draw(time)
  frame = requestAnimationFrame(loop)
}

function onPointerMove(event: PointerEvent) {
  const el = canvas.value
  if (!el) return
  const box = el.getBoundingClientRect()
  const x = event.clientX - box.left - box.width / 2
  const y = -(event.clientY - box.top - box.height / 2)
  if (Math.hypot(x, y) / wheelRadius(box.width) > OUTER + 0.05) return onPointerLeave()
  hover = Math.floor(housePosition((Math.atan2(y, x) * 180) / Math.PI)) % 12
  tip.value = { x: event.clientX - box.left, y: event.clientY - box.top, house: hover }
  if (reduceMotion) draw(0)
}

function onPointerLeave() {
  hover = -1
  tip.value = null
  if (reduceMotion) draw(0)
}

watch(
  () => props.flash,
  () => (flashAt = performance.now()),
)

// With reduced motion there's no animation loop, so redraw only when something changes.
watch(
  () => [props.scores, props.lit, props.title],
  () => reduceMotion && draw(0),
)

let resize: ResizeObserver | undefined

onMounted(() => {
  if (!canvas.value?.getContext('2d')) return
  palette = readPalette()
  setUpRing()
  // Labels are drawn on the canvas, so redraw once the web fonts arrive.
  document.fonts?.ready.then(() => draw(0))
  if (reduceMotion) {
    draw(0)
    resize = new ResizeObserver(() => draw(0))
    resize.observe(canvas.value)
  } else {
    frame = requestAnimationFrame(loop)
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  resize?.disconnect()
})
</script>

<template>
  <div class="wheel">
    <canvas
      ref="canvas"
      role="img"
      aria-label="Twelve-house wheel coloured from indigo for resting to gold for active, for the chosen date"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    />
    <div v-if="tip" class="tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }" aria-hidden="true">
      {{ houseAction(tip.house + 1) }}
      <span>House {{ tip.house + 1 }} · {{ seasonWord(scores[tip.house]) }}</span>
    </div>
    <ul class="sr-only">
      <li v-for="(house, h) in HOUSES" :key="house.name">
        House {{ h + 1 }}, {{ house.action }}: {{ seasonWord(scores[h]) }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.wheel {
  position: relative;
  width: 100%;
  max-width: 600px;
}

canvas {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  touch-action: none;
  cursor: crosshair;
}

.tip {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -120%);
  padding: var(--joyo-space-2) var(--joyo-space-3);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-input);
  background: var(--joyo-surface-2);
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
}

.tip span {
  display: block;
  font-size: 12px;
  color: var(--joyo-lavender);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
</style>
