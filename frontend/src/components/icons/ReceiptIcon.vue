<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M6 3h12v17l-2.5-1.5L13 20l-2.5-1.5L8 20l-2-1.5V3Z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </svg>
</template>
