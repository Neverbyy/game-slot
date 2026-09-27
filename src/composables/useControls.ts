/**
 * Логика панели управления — общая для панели под барабанами (ПК)
 * и сенсорной панели внизу экрана (телефоны, планшеты).
 */

import { computed, ref } from 'vue';

import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';
import { formatMoney } from '@/utils/format';

export const AUTOPLAY_OPTIONS = [10, 25, 50, 100] as const;

export function useControls() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();

  const autoplayOpen = ref(false);

  const balance = computed(() => formatMoney(session.balance));
  const betText = computed(() => formatMoney(game.bet));
  const winText = computed(() => formatMoney(game.displayWin));
  const canChangeBet = computed(() => !game.isSpinning && !game.isFreeSpins && !game.isAutoplay);

  /** SPIN во время автоигры — это STOP. */
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

  return {
    game,
    ui,
    autoplayOpen,
    balance,
    betText,
    winText,
    canChangeBet,
    onSpin,
    onAutoplay,
  };
}
