<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import client from '../api/client'
import type { components } from '../api/schema.d.ts'
import BalanceRow from '../components/BalanceRow.vue'

type Balance = components['schemas']['Balance']

const balances = ref<Balance[]>([])

onMounted(async () => {
  const { data } = await client.GET('/balances')
  if (data) {
    balances.value = data
  }
})

const maxAbsBalance = computed(() =>
  balances.value.reduce((max, entry) => Math.max(max, Math.abs(entry.balance)), 0),
)

function barWidth(balance: number): number {
  if (maxAbsBalance.value === 0) return 0
  return Math.round((Math.abs(balance) / maxAbsBalance.value) * 100)
}
</script>

<template>
  <div class="flex flex-col gap-7 lg:max-w-xl">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Balances</h1>
      <p class="mt-1 hidden text-sm text-slate-500 md:block">
        Net position for everyone in the group.
      </p>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <ul v-if="balances.length === 0" data-testid="balances-empty">
        <li class="px-5 py-4 text-sm text-slate-500">
          No balances yet — add a person and an expense to see balances.
        </li>
      </ul>
      <template v-else>
        <ul data-testid="balances-desktop" class="hidden md:block">
          <BalanceRow
            v-for="entry in balances"
            :key="entry.person_id"
            :balance="entry"
            :bar-width="barWidth(entry.balance)"
            :show-status="true"
            size="desktop"
          />
        </ul>
        <ul data-testid="balances-mobile" class="md:hidden">
          <BalanceRow
            v-for="entry in balances"
            :key="entry.person_id"
            :balance="entry"
            :bar-width="barWidth(entry.balance)"
            :show-status="false"
            size="mobile"
          />
        </ul>
      </template>
    </div>
  </div>
</template>
