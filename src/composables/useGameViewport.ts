/**
 * Масштаб и положение игрового мира на экране — для DOM-элементов, которые
 * должны стоять в определённом месте сцены (панель под барабанами).
 */

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { DESIGN } from '@/config/layout.config';
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

  /** Точка из дизайн-координат (1920×1080) в пиксели экрана. */
  function toScreen(x: number, y: number): { x: number; y: number } {
    const { screenWidth, screenHeight, scale } = viewport.value;
    return {
      x: (screenWidth - DESIGN.width * scale) / 2 + x * scale,
      y: (screenHeight - DESIGN.height * scale) / 2 + y * scale,
    };
  }

  return { viewport, toScreen };
}
