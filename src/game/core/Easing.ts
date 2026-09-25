/** Функции сглаживания. Все принимают и возвращают 0..1 (кроме back/elastic). */

export type EasingFn = (t: number) => number;

export const linear: EasingFn = (t) => t;

export const easeInQuad: EasingFn = (t) => t * t;
export const easeOutQuad: EasingFn = (t) => 1 - (1 - t) * (1 - t);
export const easeInOutQuad: EasingFn = (t) =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export const easeInCubic: EasingFn = (t) => t * t * t;
export const easeOutCubic: EasingFn = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic: EasingFn = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutQuint: EasingFn = (t) => 1 - Math.pow(1 - t, 5);

/** Перелёт с возвратом — для «пружинного» появления. */
export const easeOutBack = (overshoot = 1.7): EasingFn => {
  const c = overshoot + 1;
  return (t) => 1 + c * Math.pow(t - 1, 3) + overshoot * Math.pow(t - 1, 2);
};

export const easeOutElastic: EasingFn = (t) => {
  if (t === 0 || t === 1) return t;
  const p = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * p) + 1;
};

/** Падение с ускорением — для тумблов. */
export const easeInBack: EasingFn = (t) => 2.2 * t * t * t - 1.2 * t * t;

/** 0 → пик → 0 с затуханием: отскок барабана. */
export const bounceCurve: EasingFn = (t) => Math.sin(t * Math.PI) * (1 - t);

/** Короткая вспышка: быстрый подъём, медленное затухание. */
export const flashCurve: EasingFn = (t) => (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
