/**
 * Игровой цикл.
 *
 * Порядок спина:
 *   1) блокируем кнопку, списываем ставку, запускаем вращение;
 *   2) параллельно уходит запрос на сервер;
 *   3) ответ отдаём в GameApp — он проигрывает весь сценарий;
 *   4) после презентации фиксируем баланс и решаем, крутить ли дальше
 *      (фриспины или автоигра).
 */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api, ApiError } from '@/api';
import { BET_LEVELS, DEFAULT_BET_INDEX } from '@/config/symbols.config';
import { TIMINGS } from '@/config/timings.config';
import { gameApp } from '@/game/GameApp';
import { gameBus } from '@/game/events';
import { useSessionStore } from './session.store';
import { useUiStore } from './ui.store';
import type { FreeSpinsState, GameMode } from '@/api/types';

export type GameStatus = 'idle' | 'spinning';

const EMPTY_FREE_SPINS: FreeSpinsState = { left: 0, total: 0, multiplier: 1 };

export const useGameStore = defineStore('game', () => {
  const session = useSessionStore();
  const ui = useUiStore();

  const status = ref<GameStatus>('idle');
  const betIndex = ref(DEFAULT_BET_INDEX);
  const autoplayLeft = ref(0);

  /** Выигрыш, показываемый в панели TOTAL WIN. */
  const displayWin = ref(0);
  /** Накопленный выигрыш серии фриспинов и сколько спинов уже сыграно. */
  const freeSpinsWin = ref(0);
  const freeSpinsPlayed = ref(0);
  const freeSpins = ref<FreeSpinsState>({ ...EMPTY_FREE_SPINS });
  const error = ref<string | null>(null);

  const betLevels = computed(() => session.config?.betLevels ?? BET_LEVELS);
  const bet = computed(() => betLevels.value[betIndex.value] ?? BET_LEVELS[0] ?? 0);
  const mode = computed<GameMode>(() => (freeSpins.value.left > 0 ? 'free' : 'base'));
  const multiplier = computed(() => freeSpins.value.multiplier);

  const isSpinning = computed(() => status.value === 'spinning');
  const isAutoplay = computed(() => autoplayLeft.value > 0);
  const isFreeSpins = computed(() => freeSpins.value.left > 0);
  const canSpin = computed(
    () =>
      status.value === 'idle' &&
      session.isReady &&
      !isFreeSpins.value &&
      session.balance >= bet.value,
  );

  // Счётчик выигрыша во время каскадов обновляется из презентации.
  gameBus.on('win:progress', (value) => {
    displayWin.value = freeSpinsWin.value + value;
  });

  function setBetIndex(index: number): void {
    if (isSpinning.value || isFreeSpins.value) return;
    betIndex.value = Math.min(Math.max(index, 0), betLevels.value.length - 1);
    gameApp.setBet(bet.value);
  }

  const increaseBet = () => setBetIndex(betIndex.value + 1);
  const decreaseBet = () => setBetIndex(betIndex.value - 1);
  const setMaxBet = () => setBetIndex(betLevels.value.length - 1);

  function setTurbo(value: boolean): void {
    ui.setTurbo(value);
    gameApp.setTurbo(value);
  }

  function startAutoplay(count: number): void {
    autoplayLeft.value = count;
    if (!isSpinning.value) void spin();
  }

  function stopAutoplay(): void {
    autoplayLeft.value = 0;
  }

  async function spin(): Promise<void> {
    if (status.value !== 'idle' || !session.isReady) return;

    const free = isFreeSpins.value;
    if (!free && session.balance < bet.value) {
      ui.showToast('Недостаточно средств');
      stopAutoplay();
      return;
    }

    status.value = 'spinning';
    error.value = null;

    const currentBet = bet.value;
    if (!free) {
      session.adjustBalance(-currentBet);
      freeSpinsWin.value = 0;
      freeSpinsPlayed.value = 0;
      displayWin.value = 0;
    }

    gameApp.setBet(currentBet);
    gameApp.startSpin();

    try {
      const result = await api.spin({
        bet: currentBet,
        clientSpinId: crypto.randomUUID(),
      });

      await gameApp.playResult(result, ui.turbo);

      session.setBalance(result.balanceAfter);
      await applyFreeSpins(result.freeSpins, result.totalWin, free);
      await gameApp.setMode(mode.value);
    } catch (e) {
      handleError(e, currentBet, free);
    } finally {
      status.value = 'idle';
      scheduleNext();
    }
  }

  /** Состояние фриспинов после спина + накопление выигрыша серии. */
  async function applyFreeSpins(
    state: FreeSpinsState | undefined,
    totalWin: number,
    wasFree: boolean,
  ): Promise<void> {
    if (wasFree) {
      freeSpinsWin.value += totalWin;
      freeSpinsPlayed.value += 1;
    } else {
      displayWin.value = totalWin;
    }

    const next = state ?? { ...EMPTY_FREE_SPINS };
    const finished = wasFree && next.left === 0;

    freeSpins.value = next;

    if (finished) {
      displayWin.value = freeSpinsWin.value;
      gameBus.emit('freespins:end', { totalWin: freeSpinsWin.value });
      await gameApp.showFreeSpinsOutro(freeSpinsWin.value, freeSpinsPlayed.value, ui.turbo);
      freeSpinsPlayed.value = 0;
    } else if (next.left > 0) {
      displayWin.value = freeSpinsWin.value;
      gameBus.emit('freespins:update', next);
    }
  }

  function handleError(e: unknown, betAmount: number, wasFree: boolean): void {
    if (!wasFree) session.adjustBalance(betAmount);
    stopAutoplay();

    const message =
      e instanceof ApiError
        ? e.message
        : e instanceof Error && e.message === 'INSUFFICIENT_FUNDS'
          ? 'Недостаточно средств'
          : 'Ошибка спина, попробуйте ещё раз';

    error.value = message;
    ui.showToast(message);
    console.error('[spin]', e);
  }

  /** Фриспины крутятся сами; автоигра — пока не кончится счётчик. */
  function scheduleNext(): void {
    const factor = ui.turbo ? TIMINGS.turboFactor : 1;

    if (isFreeSpins.value) {
      window.setTimeout(() => void spin(), TIMINGS.autoplayDelayMs * factor);
      return;
    }

    if (autoplayLeft.value > 0) {
      autoplayLeft.value -= 1;
      if (autoplayLeft.value <= 0) return;
      window.setTimeout(() => {
        if (canSpin.value) void spin();
      }, TIMINGS.autoplayDelayMs * factor);
    }
  }

  return {
    status,
    betIndex,
    bet,
    betLevels,
    autoplayLeft,
    displayWin,
    freeSpins,
    error,
    mode,
    multiplier,
    isSpinning,
    isAutoplay,
    isFreeSpins,
    canSpin,
    setBetIndex,
    increaseBet,
    decreaseBet,
    setMaxBet,
    setTurbo,
    startAutoplay,
    stopAutoplay,
    spin,
  };
});
