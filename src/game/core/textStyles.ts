/** Общие элементы оформления цифр и надписей на сцене. */

import { FillGradient } from 'pixi.js';

/** Шрифт всех крупных надписей: суммы, номиналы, карточки. */
export const DISPLAY_FONT = 'Arial Black, Arial, sans-serif';

/**
 * Золотая заливка: счётчик крупного выигрыша, карточки фриспинов и номиналы
 * золотых монет — чтобы всё семейство цифр выглядело одинаково.
 */
export const GOLD_FILL = new FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: '#fffbe0' },
    { offset: 0.4, color: '#ffd035' },
    { offset: 0.75, color: '#f59a12' },
    { offset: 1, color: '#c96a05' },
  ],
});
