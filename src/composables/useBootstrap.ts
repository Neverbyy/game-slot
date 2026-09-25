/**
 * Стартовая последовательность: сессия с сервера + инициализация рендера.
 * Оверлей загрузки снимается, когда готово и то, и другое.
 */

import { onBeforeUnmount, onMounted } from 'vue';

import { gameApp } from '@/game/GameApp';
import { gameBus } from '@/game/events';
import { useGameStore } from '@/stores/game.store';
import { useSessionStore } from '@/stores/session.store';
import { useUiStore } from '@/stores/ui.store';

export function useBootstrap() {
  const session = useSessionStore();
  const game = useGameStore();
  const ui = useUiStore();

  const off: (() => void)[] = [];

  onMounted(async () => {
    off.push(
      gameBus.on('assets:progress', (value) => ui.setProgress(value)),
      gameBus.on('error', (e) => ui.showToast(e.message)),
    );

    const ready = new Promise<void>((resolve) => {
      if (gameApp.isReady) resolve();
      else off.push(gameBus.on('game:ready', () => resolve()));
    });

    try {
      await Promise.all([session.init(), ready]);

      gameApp.setBet(game.bet);
      gameApp.setTurbo(ui.turbo);
      ui.setBooting(false);
    } catch (e) {
      ui.showToast(e instanceof Error ? e.message : 'Ошибка запуска');
    }
  });

  onBeforeUnmount(() => {
    for (const unsubscribe of off) unsubscribe();
  });

  return { session, game, ui };
}
