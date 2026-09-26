<script setup lang="ts">
import { computed, ref } from 'vue';

import { CONTROL_BAR } from '@/config/layout.config';
import { useGameViewport } from '@/composables/useGameViewport';
import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import { formatMoney } from '@/utils/format';

const game = useGameStore();
const session = useSessionStore();
const ui = useUiStore();
const { viewport, toScreen } = useGameViewport();

const AUTOPLAY_OPTIONS = [10, 25, 50, 100] as const;
const autoplayOpen = ref(false);

const balance = computed(() => formatMoney(session.balance));
const betText = computed(() => formatMoney(game.bet));
const winText = computed(() => formatMoney(game.displayWin));
const canChangeBet = computed(() => !game.isSpinning && !game.isFreeSpins && !game.isAutoplay);

/**
 * Панель стоит прямо под рамкой барабанов: её место задано в дизайн-
 * координатах сцены, а размер — в дизайн-пикселях, поэтому она
 * масштабируется ровно вместе с канвасом.
 */
const placement = computed(() => {
  const origin = toScreen(CONTROL_BAR.x, CONTROL_BAR.y);
  return {
    left: `${origin.x}px`,
    top: `${origin.y}px`,
    width: `${CONTROL_BAR.width}px`,
    height: `${CONTROL_BAR.height}px`,
    transform: `scale(${viewport.value.scale})`,
  };
});

function onSpin(): void {
  if (game.isAutoplay) {
    game.stopAutoplay();
    return;
  }
  void game.spin();
}

function onAutoplay(count: number): void {
  autoplayOpen.value = false;
  game.startAutoplay(count);
}
</script>

<template>
  <footer class="bar" :style="placement">
    <button class="bar__menu" type="button" title="Меню" @click="ui.openModal('menu')">
      <span />
      <span />
      <span />
    </button>

    <div class="bar__divider" />

    <div class="bar__stat">
      <span class="bar__label">Balance</span>
      <span class="bar__value">{{ balance }}</span>
    </div>

    <div class="bar__bet">
      <button
        class="bar__step"
        type="button"
        :disabled="!canChangeBet || game.betIndex === 0"
        title="Уменьшить ставку"
        @click="game.decreaseBet()"
      >
        −
      </button>

      <div class="bar__stat">
        <span class="bar__label">Bet</span>
        <span class="bar__value">{{ betText }}</span>
      </div>

      <button
        class="bar__step"
        type="button"
        :disabled="!canChangeBet || game.betIndex === game.betLevels.length - 1"
        title="Увеличить ставку"
        @click="game.increaseBet()"
      >
        +
      </button>
    </div>

    <div class="bar__spacer" />

    <div class="bar__board">
      <div class="bar__stat" :class="{ 'is-win': game.displayWin > 0 }">
        <span class="bar__label">Total win</span>
        <span class="bar__value">{{ winText }}</span>
      </div>

      <template v-if="game.isFreeSpins">
        <div class="bar__board-divider" />
        <div class="bar__stat is-free">
          <span class="bar__label">Free spins</span>
          <span class="bar__value">{{ game.freeSpins.left }}</span>
        </div>
      </template>
    </div>

    <button
      class="bar__icon"
      type="button"
      :class="{ 'is-active': ui.turbo }"
      title="Турбо-режим"
      @click="game.setTurbo(!ui.turbo)"
    >
      ⚡
    </button>

    <div class="bar__autoplay">
      <button
        class="bar__icon"
        type="button"
        :class="{ 'is-active': game.isAutoplay }"
        :disabled="game.isSpinning || game.isFreeSpins"
        title="Автоигра"
        @click="autoplayOpen = !autoplayOpen"
      >
        ↻
      </button>

      <ul v-if="autoplayOpen" class="bar__autoplay-menu">
        <li v-for="count in AUTOPLAY_OPTIONS" :key="count">
          <button type="button" @click="onAutoplay(count)">{{ count }}</button>
        </li>
      </ul>
    </div>

    <button
      class="spin"
      type="button"
      :class="{ 'is-stop': game.isAutoplay }"
      :disabled="(!game.canSpin && !game.isAutoplay) || game.isFreeSpins"
      @click="onSpin"
    >
      <span v-if="game.isAutoplay">
        STOP
        <small>{{ game.autoplayLeft }}</small>
      </span>
      <span v-else-if="game.isFreeSpins">FREE</span>
      <span v-else-if="game.isSpinning">···</span>
      <span v-else>SPIN</span>
    </button>
  </footer>
</template>

<style scoped lang="scss">
.bar {
  position: absolute;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 14px 0 10px;
  transform-origin: 0 0;
  background: rgba(24, 17, 10, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);

  &__menu {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    width: 58px;
    height: 58px;
    padding: 0 10px;
    border: 0;
    background: transparent;
    cursor: pointer;

    span {
      display: block;
      height: 6px;
      border-radius: 3px;
      background: #f4f1ea;
    }

    &:hover span {
      background: #fff;
    }
  }

  &__divider {
    align-self: stretch;
    width: 1px;
    margin: 14px 0;
    background: rgba(255, 255, 255, 0.16);
  }

  &__stat {
    display: flex;
    flex-direction: column;
    line-height: 1.15;

    &.is-win .bar__value {
      color: var(--gold);
    }

    &.is-free .bar__value {
      color: #9fd4ff;
    }
  }

  &__label {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.82);
  }

  &__value {
    font-size: 26px;
    font-weight: 800;
    color: #fff;
    font-variant-numeric: tabular-nums;
  }

  &__bet {
    display: flex;
    align-items: center;
    gap: 8px;

    .bar__stat {
      min-width: 96px;
      align-items: center;
    }
  }

  &__step {
    width: 34px;
    height: 34px;
    border: 1px solid rgba(255, 255, 255, 0.22);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.16);
    }

    &:disabled {
      opacity: 0.35;
      cursor: default;
    }
  }

  &__spacer {
    flex: 1;
  }

  &__board {
    display: flex;
    align-items: center;
    gap: 16px;
    align-self: stretch;
    margin: 12px 0;
    padding: 0 18px;
    background: rgba(8, 8, 10, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  &__board-divider {
    align-self: stretch;
    width: 1px;
    margin: 8px 0;
    background: rgba(255, 255, 255, 0.16);
  }

  &__icon {
    width: 48px;
    height: 48px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
    font-size: 18px;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.14);
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }

    &.is-active {
      border-color: var(--gold);
      color: var(--gold);
      background: rgba(245, 197, 24, 0.14);
    }
  }

  &__autoplay {
    position: relative;
  }

  &__autoplay-menu {
    position: absolute;
    right: 0;
    bottom: calc(100% + 10px);
    display: grid;
    gap: 4px;
    padding: 6px;
    margin: 0;
    list-style: none;
    background: var(--panel-solid);
    border: 1px solid var(--border);
    border-radius: 10px;

    button {
      width: 78px;
      padding: 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #fff;
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

.spin {
  flex-shrink: 0;
  width: 74px;
  height: 74px;
  border: 0;
  border-radius: 50%;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #1c1600;
  background: radial-gradient(circle at 32% 26%, var(--gold-soft), var(--gold) 58%, #c08b05);
  box-shadow:
    0 6px 20px rgba(245, 197, 24, 0.32),
    inset 0 -4px 10px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  transition:
    transform 0.08s ease,
    filter 0.15s ease;

  &:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    filter: grayscale(0.65) brightness(0.65);
    cursor: default;
  }

  &.is-stop {
    background: radial-gradient(circle at 32% 26%, #ff9d9d, var(--danger) 58%, #8e1a16);
    color: #fff;
  }

  small {
    display: block;
    font-size: 11px;
    opacity: 0.85;
  }
}
</style>
