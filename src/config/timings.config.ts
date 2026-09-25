/** Все длительности анимаций (мс) в одном месте. */

export const TIMINGS = {
  /** Барабаны. */
  reelAccelerationMs: 240,
  reelMinSpinMs: 620,
  reelStartStaggerMs: 70,
  reelStopStaggerMs: 130,
  reelStopMs: 420,
  reelBounceMs: 170,
  /** Скорость вращения, ячеек в секунду. */
  reelSpeed: 22,
  /** Амплитуда отскока в долях высоты ячейки. */
  reelBounceAmplitude: 0.16,

  /** Каскады. */
  winHighlightMs: 900,
  symbolExplodeMs: 280,
  tumbleFallMs: 320,
  tumbleGapMs: 90,

  /** Молния. */
  lightningChargeMs: 420,
  lightningStrikeMs: 220,
  lightningHoldMs: 160,
  lightningBetweenMs: 120,

  /** Удар кулака. */
  slamChargeMs: 620,
  slamShakeMs: 520,
  slamHoldMs: 420,

  /** Сбор номиналов в монету-коллектор. */
  collectFlightMs: 520,
  collectStaggerMs: 55,
  collectHoldMs: 500,

  /** Big Win. */
  bigWinIntroMs: 700,
  /** Базовое время счёта; на каждый пройденный тир добавляется свой отрезок. */
  bigWinCountBaseMs: 3000,
  bigWinCountPerTierMs: 2600,
  bigWinHoldMs: 1200,
  bigWinOutroMs: 500,

  /** Прочее. */
  freeSpinsIntroMs: 1600,
  winPresentationMs: 900,
  autoplayDelayMs: 600,

  /** Во сколько раз быстрее в турбо-режиме. */
  turboFactor: 0.4,
} as const;
