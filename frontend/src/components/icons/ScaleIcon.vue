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
    <path d="M12 3v3M12 17v4M7 20h10" />
    <path d="M4 8h6M14 8h6" />
    <path d="M4 8l-2.4 5a2.8 2.8 0 0 0 5.6 0Z" />
    <path d="M20 8l-2.4 5a2.8 2.8 0 0 0 5.6 0Z" />
  </svg>
</template>
