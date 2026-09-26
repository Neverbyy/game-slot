/**
 * Геометрия сцены в дизайн-координатах 1920×1080.
 * Мир масштабируется целиком, поэтому здесь всё в «дизайнерских пикселях».
 */

export const DESIGN = {
  width: 1920,
  height: 1080,
} as const;

export const GRID = {
  cols: 6,
  rows: 5,
  /** Размер ячейки. */
  cellWidth: 152,
  cellHeight: 152,
  /** Зазор между ячейками. */
  gap: 4,
} as const;

/** Размеры игрового поля без рамки. */
export const FIELD = {
  width: GRID.cols * GRID.cellWidth + (GRID.cols - 1) * GRID.gap,
  height: GRID.rows * GRID.cellHeight + (GRID.rows - 1) * GRID.gap,
  /** Центр поля на сцене. Приподнят, чтобы под рамкой уместились выигрыш и панель. */
  centerX: DESIGN.width / 2,
  centerY: 488,
} as const;

/** Толщина декоративной рамки вокруг поля. */
export const FRAME_PADDING = 26;

/** Нижняя кромка рамки барабанов. */
const FRAME_BOTTOM = FIELD.centerY + FIELD.height / 2 + FRAME_PADDING;

/** Промежуток между рамкой и панелью — в нём живёт строка выигрыша каскадов. */
const CONTROL_BAR_GAP = 60;

/**
 * Панель управления — полупрозрачный блок под рамкой барабанов, шириной
 * с рамку. Задана в дизайн-координатах: DOM-панель позиционируется по ним
 * и масштабируется вместе с канвасом.
 */
export const CONTROL_BAR = {
  x: FIELD.centerX - FIELD.width / 2 - FRAME_PADDING,
  y: FRAME_BOTTOM + CONTROL_BAR_GAP,
  width: FIELD.width + FRAME_PADDING * 2,
  height: 90,
} as const;

/** Строка выигрыша каскадов — посередине между рамкой и панелью. */
export const WIN_LABEL_Y = FRAME_BOTTOM + CONTROL_BAR_GAP / 2;

/** Насколько поднят фон, чтобы низ картинки не прятался под панелью. */
export const BACKGROUND_SHIFT_Y = -120;

export const LOGO = {
  centerX: DESIGN.width / 2,
  centerY: 64,
  width: 330,
} as const;

export const ZEUS = {
  centerX: 1645,
  centerY: 506,
  height: 830,
} as const;

/** Левый верхний угол поля. */
export function fieldOrigin(): { x: number; y: number } {
  return {
    x: FIELD.centerX - FIELD.width / 2,
    y: FIELD.centerY - FIELD.height / 2,
  };
}

/** Шаг сетки: ячейка плюс зазор. */
export const CELL_STEP = {
  x: GRID.cellWidth + GRID.gap,
  y: GRID.cellHeight + GRID.gap,
} as const;

/** Центр ячейки (col, row) относительно левого верхнего угла поля. */
export function cellLocal(col: number, row: number): { x: number; y: number } {
  return {
    x: col * CELL_STEP.x + GRID.cellWidth / 2,
    y: row * CELL_STEP.y + GRID.cellHeight / 2,
  };
}

/** Центр ячейки (col, row) в координатах сцены. */
export function cellCenter(col: number, row: number): { x: number; y: number } {
  const origin = fieldOrigin();
  const local = cellLocal(col, row);
  return { x: origin.x + local.x, y: origin.y + local.y };
}
