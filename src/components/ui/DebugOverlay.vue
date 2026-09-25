<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { BIG_WIN_TIERS } from '@/config/symbols.config';
import { activeProfile } from '@/config/tuning.config';
import { gameApp } from '@/game/GameApp';
import { useGameStore } from '@/stores/game.store';

const game = useGameStore();
const fps = ref(0);
const profile = activeProfile();

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    fps.value = Math.round(gameApp.pixi?.ticker.FPS ?? 0);
  }, 500);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

/** Показывает экран выигрыша на сумме чуть выше порога тира. */
function preview(threshold: number): void {
  void gameApp.previewBigWin(threshold * 1.15);
}
</script>

<template>
  <div class="debug">
    <div class="debug__row">
      <span>{{ fps }} fps</span>
      <span>{{ game.status }}</span>
      <span>{{ game.mode }}</span>
      <span>tuning: {{ profile }}</span>
      <span v-if="game.isFreeSpins">fs {{ game.freeSpins.left }}</span>
      <span v-if="game.multiplier > 1">×{{ game.multiplier }}</span>
    </div>

    <div class="debug__row debug__row--buttons">
      <button
        v-for="tier in BIG_WIN_TIERS"
        :key="tier.id"
        type="button"
        :disabled="game.isSpinning"
        @click="preview(tier.threshold)"
      >
        {{ tier.id }}
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.debug {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 40;
  display: grid;
  gap: 4px;
  font-size: 11px;
  font-family: monospace;

  &__row {
    display: flex;
    gap: 10px;
    padding: 4px 9px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #7fe3a1;
    pointer-events: none;
    width: fit-content;
  }

  &__row--buttons {
    pointer-events: auto;
    gap: 6px;

    button {
      padding: 3px 8px;
      border: 1px solid rgba(127, 227, 161, 0.4);
      border-radius: 4px;
      background: transparent;
      color: #7fe3a1;
      font: inherit;
      text-transform: uppercase;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: rgba(127, 227, 161, 0.18);
      }

      &:disabled {
        opacity: 0.4;
        cursor: default;
      }
    }
  }
}
</style>
