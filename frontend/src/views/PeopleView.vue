<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import client from '../api/client'
import type { components } from '../api/schema.d.ts'
import PlusIcon from '../components/icons/PlusIcon.vue'

type Person = components['schemas']['Person']

const people = ref<Person[]>([])
const newName = ref('')
const error = ref<string | null>(null)
const submitting = ref(false)

const canSubmit = computed(() => newName.value.trim().length > 0)

watch(newName, () => {
  error.value = null
})

async function loadPeople() {
  try {
    const { data } = await client.GET('/people')
    if (data) {
      people.value = data
    }
  } catch {
    // Network-level failure (e.g. connection refused): leave the list
    // empty rather than crash with an unhandled rejection. No inline
    // error UI for the initial load is specified by the spec.
  }
}

onMounted(loadPeople)

async function handleSubmit() {
  const trimmed = newName.value.trim()
  if (!trimmed || submitting.value) return

  error.value = null
  submitting.value = true
  try {
    const { data, error: requestError } = await client.POST('/people', {
      body: { name: trimmed },
    })

    if (requestError || !data) {
      error.value = "Couldn't add that person. Please try again."
      return
    }

    people.value.push(data)
    newName.value = ''
  } catch {
    error.value = "Couldn't add that person. Please try again."
  } finally {
    submitting.value = false
  }
}

function initialOf(name: string) {
  return name.charAt(0).toUpperCase()
}
</script>

<template>
  <div class="flex flex-col gap-7">
    <form class="flex flex-col gap-7" @submit.prevent="handleSubmit">
      <div class="flex items-center justify-between md:block">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-slate-900">People</h1>
          <p class="mt-1 hidden text-sm text-slate-500 md:block">
            Everyone splitting expenses in this group.
          </p>
        </div>
        <button
          type="submit"
          aria-label="Add person"
          :disabled="!canSubmit || submitting"
          class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
        >
          <PlusIcon :size="18" />
        </button>
      </div>

      <div class="flex flex-col gap-2 md:flex-row">
        <input
          v-model="newName"
          type="text"
          maxlength="100"
          placeholder="Add a person's name"
          aria-label="Add a person's name"
          class="w-full flex-1 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
        />
        <button
          type="submit"
          :disabled="!canSubmit || submitting"
          class="hidden items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 md:flex"
        >
          <PlusIcon :size="16" />
          Add
        </button>
      </div>

      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
    </form>

    <div class="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div
        v-if="people.length === 0"
        class="px-4 py-3.5 text-sm text-slate-500 md:px-5 md:py-4"
      >
        No people yet — add one above.
      </div>
      <div
        v-for="(person, index) in people"
        :key="person.id"
        class="flex items-center gap-3 px-4 py-3.5 md:px-5 md:py-4"
        :class="index < people.length - 1 ? 'border-b border-slate-100' : ''"
      >
        <div
          class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700"
        >
          {{ initialOf(person.name) }}
        </div>
        <span class="text-[15px] font-medium text-slate-900">{{ person.name }}</span>
      </div>
    </div>
  </div>
</template>
