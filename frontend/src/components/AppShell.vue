<script setup lang="ts">
import { useRoute } from 'vue-router'
import Logomark from './Logomark.vue'
import PersonIcon from './icons/PersonIcon.vue'
import ReceiptIcon from './icons/ReceiptIcon.vue'
import ScaleIcon from './icons/ScaleIcon.vue'

const navItems = [
  { to: '/people', label: 'People', icon: PersonIcon },
  { to: '/expenses', label: 'Expenses', icon: ReceiptIcon },
  { to: '/balances', label: 'Balances', icon: ScaleIcon },
]

const route = useRoute()
const isActive = (to: string) => route.path === to

const sidebarLabelClass = (to: string) =>
  isActive(to) ? 'text-indigo-700 font-semibold' : 'text-slate-600 font-medium'
const sidebarIconClass = (to: string) => (isActive(to) ? 'text-indigo-700' : 'text-slate-500')
const sidebarItemClass = (to: string) => (isActive(to) ? 'bg-indigo-50' : '')

const tabLabelClass = (to: string) =>
  isActive(to) ? 'text-indigo-700 font-semibold' : 'text-slate-500 font-medium'
const tabIconClass = (to: string) => (isActive(to) ? 'text-indigo-700' : 'text-slate-500')
</script>

<template>
  <div class="flex min-h-screen w-full bg-slate-50">
    <aside
      data-testid="sidebar"
      class="hidden md:flex w-[220px] flex-shrink-0 flex-col gap-7 border-r border-slate-200 bg-white p-4 py-7"
    >
      <Logomark />
      <nav class="flex flex-col gap-0.5">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-2.5 rounded-lg px-3 py-2"
          :class="sidebarItemClass(item.to)"
        >
          <component :is="item.icon" :class="sidebarIconClass(item.to)" />
          <span class="text-sm" :class="sidebarLabelClass(item.to)">{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <main class="flex-1 px-8 py-12 md:px-14 pb-24 md:pb-12">
      <RouterView />
    </main>

    <nav
      data-testid="tabbar"
      class="fixed inset-x-0 bottom-0 flex md:hidden h-[70px] items-start justify-around border-t border-slate-200 bg-white pt-2"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex min-w-16 flex-col items-center gap-[3px]"
      >
        <component :is="item.icon" :size="22" :class="tabIconClass(item.to)" />
        <span class="text-[11px]" :class="tabLabelClass(item.to)">{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
