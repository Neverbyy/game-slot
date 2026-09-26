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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Видимая область в дизайн-координатах — под вуали и вспышки на весь экран. */
export function visibleRect({ worldWidth, worldHeight }: ViewportInfo): Rect {
  return {
    x: DESIGN.width / 2 - worldWidth / 2,
    y: DESIGN.height / 2 - worldHeight / 2,
    width: worldWidth,
    height: worldHeight,
  };
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
