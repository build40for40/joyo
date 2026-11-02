<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

import { getAuth } from '@/onboarding/auth'

export interface AccountUser {
  firstName: string | null
  lastName: string | null
  email: string
}

const props = defineProps<{
  /** Shows this person instead of asking AuthKit, for the dev preview. */
  previewUser?: AccountUser
  /** Offers "Update my birthday or time" when there's a birth to update. */
  canUpdateBirth?: boolean
}>()

const emit = defineEmits<{ updateBirth: [] }>()

// Shown, never stored: the email only lives in AuthKit's session.
const user = ref<AccountUser | null>(props.previewUser ?? null)
const open = ref(false)
const signingOut = ref(false)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()

const name = computed(() => {
  const full = [user.value?.firstName, user.value?.lastName].filter(Boolean).join(' ')
  return full || user.value?.email || ''
})
const initial = computed(() => name.value.charAt(0).toUpperCase())

async function toggle() {
  open.value = !open.value
  if (!open.value) return
  await nextTick()
  menu.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
}

function close(returnFocus = true) {
  if (!open.value) return
  open.value = false
  if (returnFocus) button.value?.focus()
}

function updateBirth() {
  close(false)
  emit('updateBirth')
}

async function signOut() {
  if (props.previewUser) return close()
  signingOut.value = true
  const auth = await getAuth()
  auth.signOut({ returnTo: new URL(import.meta.env.BASE_URL, window.location.origin).href })
}

/** Arrow keys move between items, like any menu. */
function onMenuKeydown(event: KeyboardEvent) {
  const items = [...(menu.value?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const index = items.indexOf(document.activeElement as HTMLElement)
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
  if (step) {
    event.preventDefault()
    items[(index + step + items.length) % items.length]?.focus()
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node)) close(false)
}

function onDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(async () => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  if (props.previewUser) return
  try {
    const found = (await getAuth()).getUser()
    if (found) user.value = { firstName: found.firstName ?? null, lastName: found.lastName ?? null, email: found.email ?? '' }
  } catch {
    // Without a session there's no account to show, so the menu stays hidden.
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <div v-if="user" ref="root" class="account">
    <button
      ref="button"
      type="button"
      class="trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      aria-controls="account-menu"
      aria-label="Account menu"
      @click="toggle"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
    </button>

    <div v-if="open" id="account-menu" ref="menu" class="menu" role="menu" aria-label="Account" @keydown="onMenuKeydown">
      <div class="who">
        <span class="avatar" aria-hidden="true">{{ initial }}</span>
        <span class="names">
          <span class="name">{{ name }}</span>
          <span v-if="user.email && user.email !== name" class="email">{{ user.email }}</span>
        </span>
      </div>
      <button v-if="canUpdateBirth" type="button" role="menuitem" @click="updateBirth">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
        Update my birthday or time
      </button>
      <button type="button" role="menuitem" :disabled="signingOut" @click="signOut">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
        </svg>
        {{ signingOut ? 'Signing out…' : 'Sign out' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.account {
  position: relative;
}

button {
  font: inherit;
  cursor: pointer;
}

.trigger {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid var(--joyo-line);
  border-radius: 50%;
  background: var(--joyo-surface);
  color: var(--joyo-ivory);
  transition:
    border-color var(--joyo-dur-fast),
    color var(--joyo-dur-fast);
}

.trigger:hover,
.trigger[aria-expanded='true'] {
  border-color: var(--joyo-gold);
  color: var(--joyo-gold);
}

svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.menu {
  position: absolute;
  top: calc(100% + var(--joyo-space-2));
  right: 0;
  z-index: 10;
  display: grid;
  width: min(280px, calc(100vw - 2 * var(--joyo-space-4)));
  padding: var(--joyo-space-2);
  border: 1px solid var(--joyo-line);
  border-radius: var(--joyo-radius-card);
  background: var(--joyo-surface);
  animation: drop var(--joyo-dur-fast) var(--joyo-ease);
}

@keyframes drop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.who {
  display: flex;
  align-items: center;
  gap: var(--joyo-space-3);
  margin-bottom: var(--joyo-space-1);
  padding: var(--joyo-space-2) var(--joyo-space-2) var(--joyo-space-3);
  border-bottom: 1px solid var(--joyo-line);
}

.avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--joyo-gold-soft);
  color: var(--joyo-gold);
  font-family: var(--joyo-font-display);
  font-size: 18px;
}

.names {
  display: grid;
  min-width: 0;
}

.name,
.email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name {
  font-weight: 600;
}

.email {
  font-size: 13px;
  color: var(--joyo-lavender);
}

[role='menuitem'] {
  display: flex;
  align-items: center;
  gap: var(--joyo-space-3);
  min-height: 44px;
  padding: 0 var(--joyo-space-2);
  border: 0;
  border-radius: var(--joyo-radius-input);
  background: none;
  color: var(--joyo-ivory);
  font-size: 15px;
  text-align: left;
}

[role='menuitem']:hover,
[role='menuitem']:focus-visible {
  background: var(--joyo-gold-soft);
  color: var(--joyo-gold);
}

[role='menuitem']:disabled {
  opacity: 0.5;
  cursor: default;
}

[role='menuitem'] svg {
  color: var(--joyo-lavender);
}
</style>
