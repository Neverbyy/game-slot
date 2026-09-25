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
  /** Центр поля на сцене. */
  centerX: DESIGN.width / 2,
  centerY: 566,
} as const;

/** Толщина декоративной рамки вокруг поля. */
export const FRAME_PADDING = 26;

export const LOGO = {
  centerX: DESIGN.width / 2,
  centerY: 98,
  width: 470,
} as const;

export const ZEUS = {
  centerX: 1645,
  centerY: 560,
  height: 830,
} as const;

/** Левый верхний угол поля. */
export function fieldOrigin(): { x: number; y: number } {
  return {
    x: FIELD.centerX - FIELD.width / 2,
    y: FIELD.centerY - FIELD.height / 2,
  };
}

/** Центр ячейки (col, row) в координатах сцены. */
export function cellCenter(col: number, row: number): { x: number; y: number } {
  const origin = fieldOrigin();
  return {
    x: origin.x + col * (GRID.cellWidth + GRID.gap) + GRID.cellWidth / 2,
    y: origin.y + row * (GRID.cellHeight + GRID.gap) + GRID.cellHeight / 2,
  };
}
