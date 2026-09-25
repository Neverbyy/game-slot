/**
 * Масштабирование мира под размер канваса.
 *
 * Мир нарисован в дизайн-координатах 1920×1080 и вписывается целиком
 * (contain), но слоям сообщается фактически видимая область — она шире
 * или выше дизайнерской, и фон растягивается по ней, чтобы не было полей.
 */

import { DESIGN } from '@/config/layout.config';

export interface ViewportInfo {
  /** Размер канваса в CSS-пикселях. */
  screenWidth: number;
  screenHeight: number;
  /** Масштаб мира. */
  scale: number;
  /** Видимая область в дизайн-координатах (≥ 1920×1080 по одной из осей). */
  worldWidth: number;
  worldHeight: number;
}

export function computeViewport(screenWidth: number, screenHeight: number): ViewportInfo {
  const width = Math.max(screenWidth, 1);
  const height = Math.max(screenHeight, 1);
  const scale = Math.min(width / DESIGN.width, height / DESIGN.height);

  return {
    screenWidth: width,
    screenHeight: height,
    scale,
    worldWidth: width / scale,
    worldHeight: height / scale,
  };
}
