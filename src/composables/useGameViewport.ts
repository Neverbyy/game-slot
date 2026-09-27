/**
 * Масштаб, раскладка и положение игрового мира на экране — для DOM-элементов,
 * которые должны стоять в определённом месте сцены (панель под барабанами).
 */

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { gameApp } from '@/game/GameApp';
import { gameBus } from '@/game/events';
import type { ViewportInfo } from '@/game/core/Layout';

export function useGameViewport() {
  const viewport = ref<ViewportInfo>({ ...gameApp.viewportInfo });
  let off: (() => void) | null = null;

  onMounted(() => {
    off = gameBus.on('game:resize', (value) => {
      viewport.value = { ...value };
    });
  });

  onBeforeUnmount(() => off?.());

  /** Где панель: под барабанами вместе со сценой или прибита к низу экрана. */
  const panel = computed(() => viewport.value.panel);

  /** Точка из дизайн-координат мира в пиксели экрана. */
  function toScreen(x: number, y: number): { x: number; y: number } {
    const { originX, originY, scale } = viewport.value;
    return { x: originX + x * scale, y: originY + y * scale };
  }

  return { viewport, panel, toScreen };
}
