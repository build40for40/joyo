<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <div class="loading-stars" role="status">
    <span class="visually-hidden">{{ label }}</span>
    <span
      v-for="star in 3"
      :key="star"
      class="star"
      :style="{ animationDelay: `${(star - 1) * 0.3}s` }"
      aria-hidden="true"
    >
      ✦
    </span>
  </div>
</template>

<style scoped>
.loading-stars {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--joyo-space-4);
  min-height: 240px;
  animation: loading-in var(--joyo-dur-slow) var(--joyo-ease) 200ms backwards;
}

.star {
  color: var(--joyo-gold);
  font-size: 18px;
  opacity: 0.25;
  animation: twinkle 1.8s var(--joyo-ease) infinite;
}

@keyframes loading-in {
  from {
    opacity: 0;
  }
}

@keyframes twinkle {
  40% {
    opacity: 1;
    transform: scale(1.25);
    text-shadow: 0 0 12px var(--joyo-gold-soft);
  }
}
</style>
