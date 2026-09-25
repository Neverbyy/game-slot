<script setup lang="ts">
import { computed } from 'vue';

import { useUiStore } from '@/stores/ui.store';

const ui = useUiStore();
const percent = computed(() => Math.round(ui.loadProgress * 100));
</script>

<template>
  <Transition name="fade">
    <div v-if="ui.isBooting" class="loading">
      <div class="loading__title">ZE ZEUS</div>
      <div class="loading__bar">
        <div class="loading__fill" :style="{ width: `${percent}%` }" />
      </div>
      <div class="loading__percent">{{ percent }}%</div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.loading {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: radial-gradient(circle at 50% 42%, #131b33, #05070f 72%);

  &__title {
    font-size: 46px;
    font-weight: 900;
    letter-spacing: 0.3em;
    color: var(--gold);
    text-shadow: 0 0 28px rgba(245, 197, 24, 0.45);
  }

  &__bar {
    width: min(440px, 70vw);
    height: 10px;
    border-radius: 5px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  &__fill {
    height: 100%;
    background: linear-gradient(90deg, var(--gold-soft), var(--gold));
    transition: width 0.2s ease;
  }

  &__percent {
    font-size: 13px;
    color: var(--text-muted);
    font-variant-numeric: tabular-nums;
  }
}

.fade-leave-active {
  transition: opacity 0.45s ease;
}

.fade-leave-to {
  opacity: 0;
}
</style>
