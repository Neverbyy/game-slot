<script setup lang="ts">
import { computed, ref } from 'vue';

import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import { formatMoney } from '@/utils/format';

const game = useGameStore();
const session = useSessionStore();
const ui = useUiStore();

const AUTOPLAY_OPTIONS = [10, 25, 50, 100] as const;
const autoplayOpen = ref(false);

const balance = computed(() => formatMoney(session.balance));
const betText = computed(() => formatMoney(game.bet));
const winText = computed(() => formatMoney(game.displayWin));
const canChangeBet = computed(() => !game.isSpinning && !game.isFreeSpins && !game.isAutoplay);

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
  <footer class="bar">
    <button class="icon-button" type="button" title="Меню" @click="ui.openModal('menu')">
      ☰
    </button>

    <div class="stat">
      <span class="stat__label">Balance</span>
      <span class="stat__value">{{ balance }}</span>
    </div>

    <div class="bar__bet">
      <button
        class="icon-button"
        type="button"
        :disabled="!canChangeBet || game.betIndex === 0"
        title="Уменьшить ставку"
        @click="game.decreaseBet()"
      >
        −
      </button>

      <div class="stat stat--center">
        <span class="stat__label">Bet</span>
        <span class="stat__value">{{ betText }}</span>
      </div>

      <button
        class="icon-button"
        type="button"
        :disabled="!canChangeBet || game.betIndex === game.betLevels.length - 1"
        title="Увеличить ставку"
        @click="game.increaseBet()"
      >
        +
      </button>
    </div>

    <div class="bar__spacer" />

    <div class="stat stat--win" :class="{ 'is-active': game.displayWin > 0 }">
      <span class="stat__label">Total win</span>
      <span class="stat__value">{{ winText }}</span>
    </div>

    <div v-if="game.isFreeSpins" class="stat stat--free">
      <span class="stat__label">Free spins</span>
      <span class="stat__value">{{ game.freeSpins.left }} / {{ game.freeSpins.total }}</span>
    </div>

    <div v-if="game.multiplier > 1" class="stat stat--mult">
      <span class="stat__label">Multiplier</span>
      <span class="stat__value">×{{ game.multiplier }}</span>
    </div>

    <button
      class="icon-button"
      type="button"
      :class="{ 'is-active': ui.turbo }"
      title="Турбо-режим"
      @click="game.setTurbo(!ui.turbo)"
    >
      ⚡
    </button>

    <div class="bar__autoplay">
      <button
        class="icon-button"
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
  display: flex;
  align-items: center;
  gap: 14px;
  height: var(--bar-height);
  padding: 0 18px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  backdrop-filter: blur(8px);

  &__bet {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__spacer {
    flex: 1;
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
      cursor: pointer;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  }
}

.stat--center {
  align-items: center;
  min-width: 118px;
}

.stat--win.is-active .stat__value {
  color: var(--gold);
}

.stat--free,
.stat--mult {
  padding: 4px 12px;
  border-radius: 10px;
  border: 1px solid rgba(127, 196, 255, 0.45);
  background: rgba(60, 130, 220, 0.16);

  .stat__value {
    color: #7fc4ff;
  }
}

.spin {
  width: 76px;
  height: 76px;
  border: 0;
  border-radius: 50%;
  font-size: 16px;
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
