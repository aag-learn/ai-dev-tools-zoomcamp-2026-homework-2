<script setup lang="ts">
import { onMounted, ref } from 'vue'
import client from '../api/client'
import type { components } from '../api/schema.d.ts'
import PlusIcon from '../components/icons/PlusIcon.vue'
import PencilIcon from '../components/icons/PencilIcon.vue'
import TrashIcon from '../components/icons/TrashIcon.vue'

type Expense = components['schemas']['Expense']
type Person = components['schemas']['Person']

const MONTH_ABBREVIATIONS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

const expenses = ref<Expense[]>([])
const people = ref<Person[]>([])
const rowErrors = ref<Record<number, string>>({})

async function load() {
  try {
    const [expensesResult, peopleResult] = await Promise.all([
      client.GET('/expenses'),
      client.GET('/people'),
    ])
    if (expensesResult.data) {
      expenses.value = expensesResult.data
    }
    if (peopleResult.data) {
      people.value = peopleResult.data
    }
  } catch {
    // Network-level failure (e.g. connection refused): leave the lists
    // empty rather than crash with an unhandled rejection, same pattern as
    // PeopleView's loadPeople. No inline error UI for the initial load is
    // specified by the spec.
  }
}

onMounted(load)

/**
 * Resolves a person id to a display name. Per the spec's edge cases, a
 * payer_id/participant id that doesn't match anyone in the GET /people
 * response (the two mocked datasets disagreeing) falls back to the raw
 * numeric id rather than throwing.
 */
function personName(id: number): string {
  return people.value.find((person) => person.id === id)?.name ?? String(id)
}

/**
 * Joins participant names in ascending person-id order -- i.e. the order
 * GET /people returns them in -- not whatever order participant_ids lists
 * them in. Resolves each id independently (via personName, including its
 * raw-id fallback) rather than filtering the GET /people response, so a
 * single unresolved id doesn't silently drop from the list.
 */
function participantNames(participantIds: number[]): string {
  return [...participantIds]
    .sort((a, b) => a - b)
    .map((id) => personName(id))
    .join(', ')
}

function isEveryone(participantIds: number[]): boolean {
  return participantIds.length === people.value.length
}

function formatAmount(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function formatDate(date: string): string {
  const [, monthPart, dayPart] = date.split('-')
  const month = Number(monthPart)
  const day = Number(dayPart)
  return `${MONTH_ABBREVIATIONS[month - 1]} ${day}`
}

async function handleDelete(expense: Expense) {
  try {
    const { response } = await client.DELETE('/expenses/{expense_id}', {
      params: { path: { expense_id: expense.id } },
    })

    if (!response.ok) {
      rowErrors.value = { ...rowErrors.value, [expense.id]: "Couldn't delete that expense. Please try again." }
      return
    }

    expenses.value = expenses.value.filter((item) => item.id !== expense.id)
    const updatedErrors = { ...rowErrors.value }
    delete updatedErrors[expense.id]
    rowErrors.value = updatedErrors
  } catch {
    rowErrors.value = { ...rowErrors.value, [expense.id]: "Couldn't delete that expense. Please try again." }
  }
}
</script>

<template>
  <div class="flex flex-col gap-6 md:-mx-14 md:-my-12 md:px-8 md:py-9 lg:mx-0 lg:my-0 lg:px-0 lg:py-0 lg:max-w-3xl">
    <div class="flex items-center justify-between gap-4 md:items-start">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">Expenses</h1>
        <p class="mt-1 hidden text-sm text-slate-500 md:block">Most recent first.</p>
      </div>
      <button
        type="button"
        aria-label="Add expense"
        class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white md:hidden"
      >
        <PlusIcon :size="18" />
      </button>
      <button
        type="button"
        class="hidden flex-shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white md:flex"
      >
        <PlusIcon :size="16" />
        Add expense
      </button>
    </div>

    <div class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div v-if="expenses.length === 0" class="px-4 py-3.5 text-sm text-slate-500 md:px-5 md:py-4">
        No expenses yet — add one above.
      </div>
      <div
        v-for="(expense, index) in expenses"
        :key="expense.id"
        :data-testid="`expense-row-${expense.id}`"
        :class="index < expenses.length - 1 ? 'border-b border-slate-100' : ''"
      >
        <!-- Desktop/tablet: single-line row -->
        <div class="hidden items-center justify-between gap-4 px-5 py-4 md:flex">
          <div class="flex min-w-0 flex-col gap-1">
            <span class="text-[15px] font-semibold text-slate-900">{{ expense.description }}</span>
            <span
              class="truncate text-[13px] text-slate-500 lg:overflow-visible lg:text-clip lg:whitespace-normal"
            >
              {{ formatDate(expense.date) }} · Paid by {{ personName(expense.payer_id) }} · Split between
              {{ participantNames(expense.participant_ids) }}
            </span>
          </div>
          <div class="flex flex-shrink-0 items-center gap-4">
            <span class="text-[15px] font-semibold text-slate-900">{{ formatAmount(expense.amount) }}</span>
            <div class="flex gap-1">
              <button
                type="button"
                :aria-label="`Edit ${expense.description}`"
                class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:h-[28px] md:w-[28px] lg:h-[30px] lg:w-[30px]"
              >
                <PencilIcon :size="16" />
              </button>
              <button
                type="button"
                :aria-label="`Delete ${expense.description}`"
                class="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:h-[28px] md:w-[28px] lg:h-[30px] lg:w-[30px]"
                @click="handleDelete(expense)"
              >
                <TrashIcon :size="16" />
              </button>
            </div>
          </div>
        </div>

        <!-- Mobile: two-line row -->
        <div class="flex flex-col gap-1.5 px-4 py-3.5 md:hidden">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[15px] font-semibold text-slate-900">{{ expense.description }}</span>
            <span class="text-[15px] font-semibold text-slate-900">{{ formatAmount(expense.amount) }}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="min-w-0 flex-1 truncate text-xs text-slate-500">
              {{ formatDate(expense.date) }} · Paid by {{ personName(expense.payer_id) }} · Split with
              {{ isEveryone(expense.participant_ids) ? 'everyone' : participantNames(expense.participant_ids) }}
            </span>
            <div class="flex flex-shrink-0 gap-1">
              <button
                type="button"
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <PencilIcon :size="15" />
              </button>
              <button
                type="button"
                class="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                @click="handleDelete(expense)"
              >
                <TrashIcon :size="15" />
              </button>
            </div>
          </div>
        </div>

        <p v-if="rowErrors[expense.id]" class="px-4 pb-3 text-sm text-rose-600 md:px-5 md:pb-4">
          {{ rowErrors[expense.id] }}
        </p>
      </div>
    </div>
  </div>
</template>
