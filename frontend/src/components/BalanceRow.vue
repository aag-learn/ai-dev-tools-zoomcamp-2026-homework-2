<script setup lang="ts">
import { computed } from 'vue'
import type { components } from '../api/schema.d.ts'

type Balance = components['schemas']['Balance']

const props = withDefaults(
  defineProps<{
    balance: Balance
    barWidth: number
    showStatus: boolean
    size?: 'desktop' | 'mobile'
  }>(),
  {
    size: 'desktop',
  },
)

const initial = computed(() => props.balance.name.charAt(0).toUpperCase())

const statusWord = computed(() => {
  if (props.balance.balance > 0) return 'is owed'
  if (props.balance.balance < 0) return 'owes'
  return 'settled up'
})

const amountText = computed(() => {
  const abs = Math.abs(props.balance.balance).toFixed(2)
  if (props.balance.balance > 0) return `+$${abs}`
  if (props.balance.balance < 0) return `−$${abs}`
  return `$${abs}`
})

const amountClass = computed(() => {
  if (props.balance.balance > 0) return 'text-emerald-600'
  if (props.balance.balance < 0) return 'text-rose-600'
  return 'text-slate-500'
})

const barColorClass = computed(() => {
  if (props.balance.balance > 0) return 'bg-emerald-500'
  if (props.balance.balance < 0) return 'bg-rose-500'
  return 'bg-slate-500'
})

const avatarSizeClass = computed(() =>
  props.size === 'mobile' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm',
)

const amountSizeClass = computed(() => (props.size === 'mobile' ? 'text-sm' : 'text-base'))
</script>

<template>
  <li
    data-testid="balance-row"
    class="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 last:border-b-0"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <div
          class="flex flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 font-semibold text-indigo-700"
          :class="avatarSizeClass"
        >
          {{ initial }}
        </div>
        <div class="flex flex-col">
          <span class="text-sm font-medium text-slate-900">{{ balance.name }}</span>
          <span v-if="showStatus" class="text-xs text-slate-500">{{ statusWord }}</span>
        </div>
      </div>
      <span
        data-testid="balance-amount"
        class="font-semibold"
        :class="[amountClass, amountSizeClass]"
        >{{ amountText }}</span
      >
    </div>
    <div class="h-[5px] w-full overflow-hidden rounded-full bg-slate-100">
      <div
        data-testid="balance-bar"
        class="h-full rounded-full"
        :class="barColorClass"
        :style="{ width: `${barWidth}%` }"
      ></div>
    </div>
  </li>
</template>
