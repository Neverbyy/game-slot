/**
 * Символы, выплаты и веса выпадения.
 *
 * Выплаты — множители ОБЩЕЙ ставки за 8–9, 10–11 и 12+ символов
 * в любом месте сетки (scatter pays).
 */

import { tuning } from './tuning.config';
import type { GameMode, PaytableEntry, SymbolId } from '@/api/types';

/** Минимальный размер выигрышной группы. */
export const MIN_CLUSTER = 8;

/** Символ-вайлд: подставляется вместо любого платящего. */
export const WILD: SymbolId = 'wild_zeus';

/** Скаттер: 3+ на поле дают фриспины. */
export const SCATTER: SymbolId = 'scatter';

/** Кулак Зевса: превращает всё активное поле в монеты. */
export const SLAM: SymbolId = 'extra_slam';

/** Монеты появляются только как результат удара кулака. */
export const COIN_SYMBOLS: readonly SymbolId[] = ['coin_gold', 'coin_silver'];

/** За эти символы удар кулака даёт золотую монету, за остальные — серебряную. */
export const RARE_SYMBOLS: readonly SymbolId[] = ['helmet_hoplite', 'armor_laurel'];

/** Номиналы монет — множители общей ставки. */
export const SLAM_COINS = { silver: 5, gold: 25 } as const;

/** Платящие символы в порядке убывания ценности. */
export const PAYTABLE: readonly PaytableEntry[] = [
  { symbol: 'medallion_star', pays: [5.5, 13, 27] },
  { symbol: 'armor_laurel', pays: [2.2, 4.5, 11] },
  { symbol: 'helmet_hoplite', pays: [1.3, 2.7, 7] },
  { symbol: 'gem_star', pays: [0.9, 1.8, 3.6] },
  { symbol: 'gem_heart', pays: [0.29, 0.55, 1.25] },
  { symbol: 'gem_diamond', pays: [0.23, 0.43, 1] },
  { symbol: 'gem_clover', pays: [0.18, 0.33, 0.76] },
  { symbol: 'gem_spade', pays: [0.14, 0.24, 0.57] },
];

export const PAYING_SYMBOLS: readonly SymbolId[] = PAYTABLE.map((entry) => entry.symbol);

const PAYS = new Map(PAYTABLE.map((entry) => [entry.symbol, entry.pays]));

/** Множитель ставки за `count` символов; 0 — если не платит. */
export function payoutMultiplier(symbol: SymbolId, count: number): number {
  const pays = PAYS.get(symbol);
  if (!pays || count < MIN_CLUSTER) return 0;
  const tier = count >= 12 ? 2 : count >= 10 ? 1 : 0;
  return pays[tier] ?? 0;
}

/**
 * Веса обычных символов. Скаттер и кулак живут в профиле настроек
 * (`tuning.config.ts`), потому что именно их частоту крутят под тесты.
 */
const BASE_WEIGHTS: Record<GameMode, Partial<Record<SymbolId, number>>> = {
  base: {
    gem_spade: 20,
    gem_clover: 19,
    gem_diamond: 18,
    gem_heart: 17,
    gem_star: 12,
    helmet_hoplite: 10,
    armor_laurel: 8,
    medallion_star: 5,
  },
  free: {
    gem_spade: 19,
    gem_clover: 18,
    gem_diamond: 17,
    gem_heart: 16,
    gem_star: 12,
    helmet_hoplite: 10,
    armor_laurel: 8,
    medallion_star: 5,
  },
};

/** Полный набор весов режима с учётом активного профиля. */
export function symbolWeights(mode: GameMode): [SymbolId, number][] {
  const profile = tuning();
  return [
    ...(Object.entries(BASE_WEIGHTS[mode]) as [SymbolId, number][]),
    [SCATTER, profile.scatter[mode]],
    [SLAM, profile.slam[mode]],
  ];
}

/**
 * Сколько ячеек гаснет на спин. Погашенная ячейка видна, но не участвует
 * ни в кластерах, ни в ударе кулака.
 */
export const INACTIVE_CELLS: readonly { count: number; weight: number }[] = [
  { count: 0, weight: 35 },
  { count: 1, weight: 20 },
  { count: 2, weight: 18 },
  { count: 3, weight: 14 },
  { count: 4, weight: 9 },
  { count: 5, weight: 4 },
];

/** Фичи. */
export const FEATURES = {
  /** Вероятность удара молнии после серии каскадов. */
  lightningChance: { base: 0.16, free: 0.42 },
  /** Сколько ячеек накрывает удар (веса). */
  lightningTargets: [
    { count: 1, weight: 46 },
    { count: 2, weight: 30 },
    { count: 3, weight: 16 },
    { count: 4, weight: 8 },
  ],
  /** Скаттеров для запуска фриспинов. */
  scattersToTrigger: 3,
} as const;

/** Сколько фриспинов даёт стартовый триггер. Для 6+ скаттеров — последняя строка. */
export const FREE_SPINS_AWARD: readonly { scatters: number; spins: number }[] = [
  { scatters: 3, spins: 10 },
  { scatters: 4, spins: 15 },
  { scatters: 5, spins: 25 },
  { scatters: 6, spins: 30 },
];

/** Ретриггер внутри бонуса: любые 3+ скаттера добавляют столько спинов. */
export const FREE_SPINS_RETRIGGER = 5;

/** Потолок серии — страховка от бесконечного бонуса на демо-настройках. */
export const FREE_SPINS_MAX = 60;

export function freeSpinsFor(scatters: number): number {
  if (scatters < FEATURES.scattersToTrigger) return 0;

  let spins = 0;
  for (const entry of FREE_SPINS_AWARD) {
    if (scatters >= entry.scatters) spins = entry.spins;
  }
  return spins;
}

/**
 * Пороги для экрана крупного выигрыша — множители общей ставки.
 * `texture` — алиас баннера из манифеста ассетов.
 */
export const BIG_WIN_TIERS = [
  { id: 'big', threshold: 40, texture: 'banner_big' },
  { id: 'mega', threshold: 80, texture: 'banner_mega' },
  { id: 'super', threshold: 150, texture: 'banner_super' },
  { id: 'epic', threshold: 250, texture: 'banner_epic' },
] as const;

export type BigWinTierId = (typeof BIG_WIN_TIERS)[number]['id'];

/** Уровни ставок в минорных единицах (центы). */
export const BET_LEVELS: readonly number[] = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10_000];

export const DEFAULT_BET_INDEX = 3;
