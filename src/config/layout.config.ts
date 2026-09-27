/**
 * Геометрия сцены в дизайн-пикселях.
 *
 * Мир один и тот же на любом экране (ячейка 152, поле 6×5), меняется только
 * расстановка: альбомная раскладка — ПК, планшеты и телефоны лёжа, портретная —
 * телефоны и планшеты стоя. Раскладку и масштаб выбирает `computeViewport`.
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
} as const;

/** Толщина декоративной рамки вокруг поля. */
export const FRAME_PADDING = 26;

/** Высота Зевса — одна на все раскладки, где он есть. */
export const ZEUS_HEIGHT = 830;

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

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type LayoutName = 'landscape' | 'portrait';

export interface SceneLayout {
  name: LayoutName;
  /** Центр поля на сцене. */
  field: { centerX: number; centerY: number };
  logo: { centerX: number; centerY: number; width: number };
  /** Строка выигрыша каскадов под рамкой. */
  winLabelY: number;
  /** Где стоит Зевс; `null` — в этой раскладке его нет. */
  zeus: { centerX: number; centerY: number } | null;
  /** Трезубцы по бокам рамки. */
  tridents: boolean;
  /** Насколько поднят фон, чтобы низ картинки не прятался под панелью. */
  backgroundShiftY: number;
  /**
   * Что обязано поместиться на экран, когда панель прибита к низу экрана
   * и места под неё в сцене не нужно.
   */
  content: Rect;
}

/** Промежуток между рамкой и панелью — в нём живёт строка выигрыша каскадов. */
const CONTROL_BAR_GAP = 60;

/* --- Альбом --- */

const LANDSCAPE_FIELD_Y = 488;
/** Нижняя кромка рамки барабанов в альбоме. */
const LANDSCAPE_FRAME_BOTTOM = LANDSCAPE_FIELD_Y + FIELD.height / 2 + FRAME_PADDING;

export const LANDSCAPE: SceneLayout = {
  name: 'landscape',
  // Поле приподнято, чтобы под рамкой уместились выигрыш и панель.
  field: { centerX: DESIGN.width / 2, centerY: LANDSCAPE_FIELD_Y },
  logo: { centerX: DESIGN.width / 2, centerY: 64, width: 330 },
  winLabelY: LANDSCAPE_FRAME_BOTTOM + CONTROL_BAR_GAP / 2,
  zeus: { centerX: 1645, centerY: 506 },
  tridents: true,
  backgroundShiftY: -120,
  // Без полосы панели: от верха логотипа до строки выигрыша и ног Зевса.
  content: { x: 0, y: 0, width: DESIGN.width, height: 970 },
};

/**
 * Панель управления на ПК — полупрозрачный блок под рамкой барабанов,
 * шириной с рамку. Задана в дизайн-координатах: DOM-панель позиционируется
 * по ним и масштабируется вместе с канвасом.
 */
export const CONTROL_BAR = {
  x: LANDSCAPE.field.centerX - FIELD.width / 2 - FRAME_PADDING,
  y: LANDSCAPE_FRAME_BOTTOM + CONTROL_BAR_GAP,
  width: FIELD.width + FRAME_PADDING * 2,
  height: 90,
} as const;

/** Вся сцена альбома вместе с местом под панель — так она выглядит на ПК. */
export const DOCKED_CONTENT: Rect = { x: 0, y: 0, width: DESIGN.width, height: DESIGN.height };

/* --- Портрет --- */

const PORTRAIT_LOGO_WIDTH = 380;
const PORTRAIT_LOGO_Y = 80;
/** Верх рамки — сразу под логотипом (высота логотипа ≈ 0.354 ширины). */
const PORTRAIT_FRAME_TOP = PORTRAIT_LOGO_Y + PORTRAIT_LOGO_WIDTH * 0.177 + 24;
const PORTRAIT_FIELD_Y = PORTRAIT_FRAME_TOP + FRAME_PADDING + FIELD.height / 2;
const PORTRAIT_FRAME_BOTTOM = PORTRAIT_FIELD_Y + FIELD.height / 2 + FRAME_PADDING;
const PORTRAIT_WIN_LABEL_Y = PORTRAIT_FRAME_BOTTOM + 44;
/** Ширина портретной сцены: рамка и небольшие поля по бокам. */
const PORTRAIT_WIDTH = FIELD.width + FRAME_PADDING * 2 + 16;

export const PORTRAIT: SceneLayout = {
  name: 'portrait',
  field: { centerX: DESIGN.width / 2, centerY: PORTRAIT_FIELD_Y },
  logo: { centerX: DESIGN.width / 2, centerY: PORTRAIT_LOGO_Y, width: PORTRAIT_LOGO_WIDTH },
  winLabelY: PORTRAIT_WIN_LABEL_Y,
  // Рядом с полем Зевсу места нет — в портрете молнии бьют прямо с неба.
  zeus: null,
  tridents: false,
  backgroundShiftY: 0,
  content: {
    x: DESIGN.width / 2 - PORTRAIT_WIDTH / 2,
    y: 0,
    width: PORTRAIT_WIDTH,
    height: PORTRAIT_WIN_LABEL_Y + 44,
  },
};
