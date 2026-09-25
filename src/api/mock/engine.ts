/**
 * Математика спина — временная замена бэкенду.
 *
 * Считает весь сценарий целиком: начальную сетку, серию каскадов, удары
 * молнии, удар кулака и скаттеры. Клиент этот сценарий только проигрывает.
 * Когда появится сервер, файл останется эталоном для тестов.
 */

import {
  COIN_SYMBOLS,
  FEATURES,
  FREE_SPINS_RETRIGGER,
  INACTIVE_CELLS,
  MIN_CLUSTER,
  PAYING_SYMBOLS,
  RARE_SYMBOLS,
  SCATTER,
  SLAM,
  SLAM_COINS,
  WILD,
  freeSpinsFor,
  payoutMultiplier,
  symbolWeights,
} from '@/config/symbols.config';
import { GRID } from '@/config/layout.config';
import { Rng, rng as defaultRng } from './rng';
import type {
  Cell,
  CollectedCoin,
  GameMode,
  Grid,
  Pos,
  SpinStep,
  SymbolId,
  WinCluster,
} from '@/api/types';

/** Предел на длину серии — страховка от бесконечного цикла. */
const MAX_CASCADES = 20;

/** Набор ключей «col:row». */
export type CellKeys = ReadonlySet<string>;

export const cellKey = (col: number, row: number): string => `${col}:${row}`;

export interface SpinContext {
  bet: number;
  mode: GameMode;
  /** Накопленный множитель фриспинов на начало спина. */
  multiplier: number;
  rng?: Rng;
}

export interface SpinOutcome {
  steps: SpinStep[];
  totalWin: number;
  /** Множитель на конец спина (растёт от молний во фриспинах). */
  multiplier: number;
  freeSpinsAwarded: number;
  /** Сколько принёс удар кулака — нужно презентации и симуляции. */
  slamWin: number;
}

export function playSpin(context: SpinContext): SpinOutcome {
  const rng = context.rng ?? defaultRng;
  const { bet, mode } = context;

  const steps: SpinStep[] = [];
  let grid = randomGrid(mode, bet, rng);
  let totalWin = 0;
  let multiplier = context.multiplier;
  let lightningLeft = mode === 'free' ? 2 : 1;

  steps.push({ type: 'reveal', grid: cloneGrid(grid) });

  for (let iteration = 0; iteration < MAX_CASCADES; iteration++) {
    const clusters = evaluate(grid, bet, multiplier);

    if (clusters.length) {
      const win = clusters.reduce((sum, cluster) => sum + cluster.win, 0);
      totalWin += win;
      steps.push({ type: 'win', clusters, win, multiplier });

      const removed = collectPositions(clusters);
      grid = tumble(grid, removed, mode, bet, rng);
      steps.push({ type: 'tumble', removed, grid: cloneGrid(grid) });
      continue;
    }

    // Выигрышей нет — Зевс может добавить wild-ов и запустить серию заново.
    if (lightningLeft > 0 && rng.chance(FEATURES.lightningChance[mode])) {
      lightningLeft--;
      const targets = pickLightningTargets(grid, rng);

      if (targets.length) {
        for (const [col, row] of targets) {
          (grid[col] as Cell[])[row] = { symbol: WILD };
        }

        // Во фриспинах каждый удар добавляет +1 к общему множителю серии.
        const multiplierAdded = mode === 'free' ? 1 : 0;
        multiplier += multiplierAdded;

        steps.push({
          type: 'lightning',
          targets,
          grid: cloneGrid(grid),
          multiplierAdded,
        });
        continue;
      }
    }

    break;
  }

  // Скаттеры считаются до удара кулака, иначе он съел бы триггер фриспинов.
  const scatters = findPositions(grid, SCATTER);
  let freeSpinsAwarded = 0;
  if (scatters.length >= FEATURES.scattersToTrigger) {
    freeSpinsAwarded = mode === 'free' ? FREE_SPINS_RETRIGGER : freeSpinsFor(scatters.length);
    steps.push({ type: 'scatters', positions: scatters, freeSpinsAwarded });
  }

  // Удар кулака — финал спина: поле превращается в монеты, кроме нескольких
  // случайных ячеек, до которых удар не дотянулся.
  let slamWin = 0;
  const origin = findPositions(grid, SLAM)[0];
  if (origin) {
    const inactive = pickInactive(rng, origin);
    const blocked = new Set(inactive.map(([col, row]) => cellKey(col, row)));

    const { coins, grid: coinGrid } = smashToCoins(grid, bet, blocked);
    slamWin = coins.reduce((sum, coin) => sum + coin.value, 0);
    totalWin += slamWin;
    grid = coinGrid;

    steps.push({
      type: 'slam',
      origin,
      inactive,
      collector: pickCollector(coins, rng),
      grid: cloneGrid(grid),
      coins,
      win: slamWin,
    });
  }

  return { steps, totalWin, multiplier, freeSpinsAwarded, slamWin };
}

/* --- Сетка --- */

/** Ячейки, которые переживут удар кулака. Эпицентр в их число не попадает. */
export function pickInactive(rng: Rng = defaultRng, origin?: Pos): Pos[] {
  const count = rng.weighted(INACTIVE_CELLS.map((entry) => [entry.count, entry.weight] as const));
  if (count <= 0) return [];

  const all: Pos[] = [];
  for (let col = 0; col < GRID.cols; col++) {
    for (let row = 0; row < GRID.rows; row++) {
      if (origin && origin[0] === col && origin[1] === row) continue;
      all.push([col, row] as Pos);
    }
  }

  return rng.shuffle(all).slice(0, count);
}

export function randomGrid(mode: GameMode, bet: number, rng: Rng = defaultRng): Grid {
  const grid: Grid = [];
  for (let col = 0; col < GRID.cols; col++) {
    const column: Cell[] = [];
    for (let row = 0; row < GRID.rows; row++) column.push(randomCell(mode, bet, rng));
    grid.push(column);
  }
  return grid;
}

/** Случайный символ по весам режима и активного профиля настроек. */
export function randomCell(mode: GameMode, _bet: number, rng: Rng = defaultRng): Cell {
  const symbol = rng.weighted(symbolWeights(mode).map(([id, weight]) => [id, weight] as const));
  return { symbol };
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((column) => column.map((cell) => ({ ...cell })));
}

/* --- Оценка --- */

/** Выигрышные группы: 8+ одинаковых символов в любом месте поля. */
export function evaluate(grid: Grid, bet: number, multiplier: number): WinCluster[] {
  const positions = new Map<SymbolId, Pos[]>();

  for (let col = 0; col < grid.length; col++) {
    const column = grid[col] as Cell[];
    for (let row = 0; row < column.length; row++) {
      const symbol = (column[row] as Cell).symbol;
      const list = positions.get(symbol) ?? [];
      list.push([col, row] as Pos);
      positions.set(symbol, list);
    }
  }

  const wilds = positions.get(WILD) ?? [];
  const clusters: WinCluster[] = [];

  for (const symbol of PAYING_SYMBOLS) {
    const own = positions.get(symbol) ?? [];
    const count = own.length + wilds.length;
    if (count < MIN_CLUSTER || own.length === 0) continue;

    const pay = payoutMultiplier(symbol, count);
    if (!pay) continue;

    clusters.push({
      symbol,
      positions: [...own, ...wilds],
      win: Math.round(pay * bet * multiplier),
    });
  }

  return clusters;
}

function collectPositions(clusters: readonly WinCluster[]): Pos[] {
  const unique = new Map<string, Pos>();
  for (const cluster of clusters) {
    for (const pos of cluster.positions) unique.set(cellKey(pos[0], pos[1]), pos);
  }
  return [...unique.values()];
}

/** Убрать выигравшие, сдвинуть оставшиеся вниз, досыпать новые сверху. */
function tumble(grid: Grid, removed: readonly Pos[], mode: GameMode, bet: number, rng: Rng): Grid {
  const removedByColumn = new Map<number, Set<number>>();
  for (const [col, row] of removed) {
    const set = removedByColumn.get(col) ?? new Set<number>();
    set.add(row);
    removedByColumn.set(col, set);
  }

  return grid.map((column, col) => {
    const dropped = removedByColumn.get(col);
    if (!dropped?.size) return column.map((cell) => ({ ...cell }));

    const survivors = column.filter((_, row) => !dropped.has(row)).map((cell) => ({ ...cell }));
    const fresh: Cell[] = [];
    for (let i = 0; i < dropped.size; i++) fresh.push(randomCell(mode, bet, rng));

    return [...fresh, ...survivors];
  });
}

/* --- Фичи --- */

/** Молния бьёт по обычным платящим символам. */
function pickLightningTargets(grid: Grid, rng: Rng): Pos[] {
  const candidates: Pos[] = [];

  for (let col = 0; col < grid.length; col++) {
    const column = grid[col] as Cell[];
    for (let row = 0; row < column.length; row++) {
      const symbol = (column[row] as Cell).symbol;
      if (symbol === WILD || symbol === SCATTER || symbol === SLAM) continue;
      if (COIN_SYMBOLS.includes(symbol)) continue;
      candidates.push([col, row] as Pos);
    }
  }

  if (!candidates.length) return [];

  const count = rng.weighted(
    FEATURES.lightningTargets.map((entry) => [entry.count, entry.weight] as const),
  );

  return rng.shuffle(candidates).slice(0, Math.min(count, candidates.length));
}

/**
 * Удар кулака: каждая ячейка, кроме погашенных, становится монетой.
 * Редкие символы дают золото, все остальные — серебро.
 */
function smashToCoins(
  grid: Grid,
  bet: number,
  blocked: CellKeys,
): { coins: CollectedCoin[]; grid: Grid } {
  const coins: CollectedCoin[] = [];
  const next = cloneGrid(grid);

  for (let col = 0; col < next.length; col++) {
    const column = next[col] as Cell[];
    for (let row = 0; row < column.length; row++) {
      if (blocked.has(cellKey(col, row))) continue;

      const isRare = RARE_SYMBOLS.includes((column[row] as Cell).symbol);
      const symbol: SymbolId = isRare ? 'coin_gold' : 'coin_silver';
      const value = (isRare ? SLAM_COINS.gold : SLAM_COINS.silver) * bet;

      column[row] = { symbol, value };
      coins.push({ pos: [col, row] as Pos, symbol, value });
    }
  }

  return { coins, grid: next };
}

/**
 * Монета, в которую слетятся все номиналы: случайная золотая, а если золотых
 * не выпало (редко — золото дают только шлем и доспех) — случайная любая.
 */
function pickCollector(coins: readonly CollectedCoin[], rng: Rng): Pos {
  const gold = coins.filter((coin) => coin.symbol === 'coin_gold');
  const pool = gold.length ? gold : coins;
  return rng.pick(pool).pos;
}

function findPositions(grid: Grid, symbol: SymbolId): Pos[] {
  const result: Pos[] = [];
  for (let col = 0; col < grid.length; col++) {
    const column = grid[col] as Cell[];
    for (let row = 0; row < column.length; row++) {
      if ((column[row] as Cell).symbol === symbol) result.push([col, row] as Pos);
    }
  }
  return result;
}
