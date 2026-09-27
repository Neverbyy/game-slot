/**
 * Раскладка и масштаб мира под размер канваса.
 *
 * На ПК сцена 1920×1080 вписывается целиком (contain), а панель управления
 * стоит под барабанами и масштабируется вместе с ней. Когда экран так мал,
 * что кнопки панели стали бы мельче пальца, панель прибивается к низу экрана
 * в обычном размере, а сцена (без места под панель) вписывается над ней.
 * Стоячий экран получает портретную раскладку.
 *
 * Слоям сообщается фактически видимая область — она шире или выше вписанной
 * сцены, и фон растягивается по ней, чтобы не было полей.
 */

import {
  DESIGN,
  DOCKED_CONTENT,
  LANDSCAPE,
  PORTRAIT,
  type Rect,
  type SceneLayout,
} from '@/config/layout.config';

export type { Rect } from '@/config/layout.config';

/**
 * `docked` — панель под барабанами, масштабируется со сценой (ПК);
 * `fixed` — панель прибита к низу экрана в обычных CSS-пикселях.
 */
export type PanelMode = 'docked' | 'fixed';

/**
 * Масштаб, ниже которого панель под барабанами уже неудобна: кнопка SPIN
 * (74 дизайн-пикселя) становится мельче 44 px — минимума для пальца.
 */
const DOCKED_MIN_SCALE = 0.6;

export interface ViewportInfo {
  /** Размер канваса в CSS-пикселях. */
  screenWidth: number;
  screenHeight: number;
  /** Масштаб мира. */
  scale: number;
  /** Где на экране (CSS-пиксели) оказывается точка (0, 0) мира. */
  originX: number;
  originY: number;
  /** Видимая область всего канваса в дизайн-координатах. */
  visible: Rect;
  layout: SceneLayout;
  panel: PanelMode;
}

/**
 * @param reservedBottom высота прибитой к низу панели, CSS-пиксели:
 *                       сцена вписывается над ней.
 */
export function computeViewport(
  screenWidth: number,
  screenHeight: number,
  reservedBottom = 0,
): ViewportInfo {
  const width = Math.max(screenWidth, 1);
  const height = Math.max(screenHeight, 1);

  if (width >= height) {
    const dockedScale = Math.min(width / DESIGN.width, height / DESIGN.height);
    if (dockedScale >= DOCKED_MIN_SCALE) {
      return fit(DOCKED_CONTENT, width, height, height, LANDSCAPE, 'docked');
    }
  }

  const layout = width >= height ? LANDSCAPE : PORTRAIT;
  const areaHeight = Math.max(height - reservedBottom, height * 0.4);
  return fit(layout.content, width, height, areaHeight, layout, 'fixed');
}

/** Вписать `content` в верхнюю часть канваса высотой `areaHeight`. */
function fit(
  content: Rect,
  width: number,
  height: number,
  areaHeight: number,
  layout: SceneLayout,
  panel: PanelMode,
): ViewportInfo {
  const scale = Math.min(width / content.width, areaHeight / content.height);
  const originX = (width - content.width * scale) / 2 - content.x * scale;
  const originY = (areaHeight - content.height * scale) / 2 - content.y * scale;

  return {
    screenWidth: width,
    screenHeight: height,
    scale,
    originX,
    originY,
    visible: {
      x: -originX / scale,
      y: -originY / scale,
      width: width / scale,
      height: height / scale,
    },
    layout,
    panel,
  };
}
