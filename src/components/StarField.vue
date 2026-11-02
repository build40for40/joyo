<script setup lang="ts">
const { count = 200 } = defineProps<{ count?: number }>()

const stars = Array.from({ length: count }, () => ({
  left: `${Math.random() * 100}%`,
  top: `${Math.random() * 100}%`,
  size: `${Math.random() < 0.85 ? 1 : 2}px`,
  opacity: (0.25 + Math.random() * 0.35).toFixed(2),
  delay: `${(-Math.random() * 8).toFixed(2)}s`,
  duration: `${(5 + Math.random() * 5).toFixed(2)}s`,
}))
</script>

<template>
  <div class="star-field" aria-hidden="true">
    <span
      v-for="(star, i) in stars"
      :key="i"
      class="star"
      :style="{
        left: star.left,
        top: star.top,
        width: star.size,
        height: star.size,
        '--star-opacity': star.opacity,
        animationDelay: star.delay,
        animationDuration: star.duration,
      }"
    />
  </div>
</template>

<style scoped>
.star-field {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}

.star {
  position: absolute;
  border-radius: 50%;
  background: var(--joyo-ivory);
  opacity: var(--star-opacity);
  animation: twinkle ease-in-out infinite alternate;
}

@keyframes twinkle {
  from {
    opacity: var(--star-opacity);
  }
  to {
    opacity: calc(var(--star-opacity) * 0.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .star {
    animation: none;
  }
}
</style>
