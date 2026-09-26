<script setup lang="ts">
import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();
</script>

<template>
  <Transition name="toast">
    <div v-if="ui.toast" class="toast" role="status">{{ ui.toast }}</div>
  </Transition>
</template>

<style scoped lang="scss">
.toast {
  position: absolute;
  left: 50%;
  top: 14%;
  z-index: 60;
  transform: translateX(-50%);
  padding: 10px 20px;
  border-radius: 10px;
  background: rgba(18, 22, 38, 0.95);
  border: 1px solid var(--border);
  font-size: 14px;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 10px);
}
</style>
