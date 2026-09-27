<script setup lang="ts">
/**
 * Панель управления для телефонов и планшетов: прибита к низу экрана и не
 * уменьшается вместе со сценой: SPIN крупная, остальные кнопки — 36 px.
 *
 * Узкий экран (портрет) — два ряда: сверху баланс, ставка и выигрыш, снизу
 * кнопки с крупной SPIN по центру. Широкий (телефон или планшет лёжа) — один
 * ряд. Свою высоту панель сообщает игре, и сцена вписывается над ней.
 */

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { AUTOPLAY_OPTIONS, useControls } from '@/composables/useControls';
import { gameApp } from '@/game/GameApp';

const { game, ui, autoplayOpen, balance, betText, winText, canChangeBet, onSpin, onAutoplay } =
  useControls();

const root = ref<HTMLElement | null>(null);
let observer: ResizeObserver | null = null;

onMounted(() => {
  if (!root.value) return;
  observer = new ResizeObserver(([entry]) => {
    const box = entry?.borderBoxSize?.[0];
    gameApp.setReservedBottom(box ? box.blockSize : (root.value?.offsetHeight ?? 0));
  });
  observer.observe(root.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  // Панели больше нет — сцена снова занимает весь экран.
  gameApp.setReservedBottom(0);
});
</script>

<template>
  <footer ref="root" class="panel" data-testid="touch-panel">
    <div class="panel__info">
      <div class="panel__stat">
        <span class="panel__label">Balance</span>
        <span class="panel__value">{{ balance }}</span>
      </div>
      <div class="panel__stat">
        <span class="panel__label">Bet</span>
        <span class="panel__value">{{ betText }}</span>
      </div>
      <div class="panel__stat" :class="{ 'is-win': game.displayWin > 0 }">
        <span class="panel__label">Total win</span>
        <span class="panel__value">{{ winText }}</span>
      </div>
      <div v-if="game.isFreeSpins" class="panel__stat is-free">
        <span class="panel__label">Free spins</span>
        <span class="panel__value">{{ game.freeSpins.left }}</span>
      </div>
    </div>

    <div class="panel__side">
      <button class="panel__icon" type="button" title="Меню" @click="ui.openModal('menu')">
        ☰
      </button>
      <button
        class="panel__icon"
        type="button"
        :class="{ 'is-active': ui.turbo }"
        title="Турбо-режим"
        @click="game.setTurbo(!ui.turbo)"
      >
        ⚡
      </button>
    </div>

    <div class="panel__center">
      <button
        class="panel__icon panel__icon--round"
        type="button"
        :disabled="!canChangeBet || game.betIndex === 0"
        title="Уменьшить ставку"
        @click="game.decreaseBet()"
      >
        −
      </button>

      <button
        class="spin"
        type="button"
        data-testid="spin"
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

      <button
        class="panel__icon panel__icon--round"
        type="button"
        :disabled="!canChangeBet || game.betIndex === game.betLevels.length - 1"
        title="Увеличить ставку"
        @click="game.increaseBet()"
      >
        +
      </button>
    </div>

    <div class="panel__side panel__side--end">
      <div class="panel__autoplay">
        <button
          class="panel__icon"
          type="button"
          :class="{ 'is-active': game.isAutoplay }"
          :disabled="game.isSpinning || game.isFreeSpins"
          title="Автоигра"
          @click="autoplayOpen = !autoplayOpen"
        >
          ↻
        </button>

        <ul v-if="autoplayOpen" class="panel__autoplay-menu">
          <li v-for="count in AUTOPLAY_OPTIONS" :key="count">
            <button type="button" @click="onAutoplay(count)">{{ count }}</button>
          </li>
        </ul>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
/* Узкий экран (портрет): две строки — сведения сверху, кнопки снизу. */
.panel {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: grid;
  // Боковые колонки не уже своих кнопок: на узком экране SPIN чуть смещается,
  // но ничего не вылезает за край.
  grid-template-columns: minmax(max-content, 1fr) auto minmax(max-content, 1fr);
  grid-template-areas:
    'info info info'
    'left center right';
  align-items: center;
  row-gap: 6px;
  padding: 8px max(12px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom))
    max(12px, env(safe-area-inset-left));
  background: rgba(24, 17, 10, 0.72);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(6px);
  user-select: none;

  &__info {
    grid-area: info;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    min-width: 0;
  }

  &__stat {
    display: flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;

    &:nth-child(2) {
      align-items: center;
    }

    &:last-child {
      align-items: flex-end;
    }

    &.is-win .panel__value {
      color: var(--gold);
    }

    &.is-free .panel__value {
      color: #9fd4ff;
    }
  }

  &__label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.72);
  }

  &__value {
    font-size: 16px;
    font-weight: 800;
    color: #fff;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  &__side {
    grid-area: left;
    display: flex;
    gap: 8px;

    &--end {
      grid-area: right;
      justify-content: flex-end;
    }
  }

  &__center {
    grid-area: center;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  &__icon {
    width: 36px;
    height: 36px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.07);
    color: #fff;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;

    &--round {
      border-radius: 50%;
      font-size: 22px;
    }

    &:disabled {
      opacity: 0.35;
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
      min-height: 44px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #fff;
      font-size: 16px;
      cursor: pointer;
    }
  }

  /* Совсем узкие телефоны (320–374 px): поджимаем отступы, размер кнопок тот же. */
  @media (max-width: 374px) {
    padding-left: max(8px, env(safe-area-inset-left));
    padding-right: max(8px, env(safe-area-inset-right));

    &__side {
      gap: 6px;
    }

    &__center {
      gap: 6px;
    }

    &__value {
      font-size: 15px;
    }
  }

  /* Широкий экран (лёжа): всё в один ряд — сцене остаётся больше высоты. */
  @media (min-width: 600px) {
    grid-template-columns: auto 1fr auto auto;
    grid-template-areas: 'left info center right';
    column-gap: 18px;
    padding-top: 6px;
    padding-bottom: max(6px, env(safe-area-inset-bottom));

    &__info {
      justify-content: flex-start;
      gap: 24px;
    }

    &__stat {
      &:nth-child(2),
      &:last-child {
        align-items: flex-start;
      }
    }

    &__value {
      font-size: 18px;
    }
  }
}

.spin {
  flex-shrink: 0;
  width: 66px;
  height: 66px;
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
  transition: transform 0.08s ease;

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

  @media (max-width: 374px) {
    width: 60px;
    height: 60px;
  }

  @media (min-width: 600px) {
    width: 58px;
    height: 58px;
  }
}
</style>
