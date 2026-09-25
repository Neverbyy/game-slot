/**
 * Контракт с бэкендом.
 *
 * Сервер возвращает весь сценарий спина целиком (список шагов), клиент его
 * только проигрывает. Пока сервера нет, тот же контракт реализует мок.
 *
 * Деньги — целые числа в минорных единицах валюты (центы).
 */

export type SymbolId =
  | 'gem_spade'
  | 'gem_clover'
  | 'gem_diamond'
  | 'gem_heart'
  | 'gem_star'
  | 'helmet_hoplite'
  | 'armor_laurel'
  | 'medallion_star'
  | 'wild_zeus'
  | 'scatter'
  | 'extra_slam'
  | 'coin_gold'
  | 'coin_silver';

/** Ячейка сетки. `value` заполнен только у монет — номинал в минорных единицах. */
export interface Cell {
  symbol: SymbolId;
  value?: number;
}

/** grid[col][row], 6 колонок × 5 рядов. */
export type Grid = Cell[][];

export type Pos = readonly [col: number, row: number];

export type GameMode = 'base' | 'free';

export interface WinCluster {
  symbol: SymbolId;
  positions: Pos[];
  /** Выигрыш кластера с учётом множителя. */
  win: number;
}

export type SpinStep =
  /** Барабаны останавливаются на этой сетке. */
  | { type: 'reveal'; grid: Grid }
  /** Найдены выигрышные группы (8+ одинаковых). */
  | { type: 'win'; clusters: WinCluster[]; win: number; multiplier: number }
  /** Выигравшие символы взрываются, сетка пересобирается. */
  | { type: 'tumble'; removed: Pos[]; grid: Grid }
  /** Зевс бьёт молнией: ячейки становятся wild. */
  | { type: 'lightning'; targets: Pos[]; grid: Grid; multiplierAdded: number }
  /**
   * Удар кулака: активные ячейки превращаются в монеты.
   * `inactive` — ячейки, до которых удар не дотянулся: клиент гасит их
   * на время удара, монет там не появляется.
   * `collector` — монета, в которую слетаются номиналы остальных.
   */
  | {
      type: 'slam';
      origin: Pos;
      inactive: Pos[];
      collector: Pos;
      grid: Grid;
      coins: CollectedCoin[];
      win: number;
    }
  /** Скаттеры собрали фриспины. */
  | { type: 'scatters'; positions: Pos[]; freeSpinsAwarded: number };

export interface CollectedCoin {
  pos: Pos;
  /** Какую монету рисовать: coin_silver или coin_gold. */
  symbol: SymbolId;
  value: number;
}

export interface FreeSpinsState {
  left: number;
  total: number;
  /** Накопительный множитель текущего спина. */
  multiplier: number;
}

export interface SpinRequest {
  /** Общая ставка за спин, минорные единицы. */
  bet: number;
  /** Ключ идемпотентности: повтор не списывает ставку дважды. */
  clientSpinId: string;
}

export interface SpinResponse {
  spinId: string;
  bet: number;
  mode: GameMode;
  steps: SpinStep[];
  totalWin: number;
  balanceAfter: number;
  freeSpins?: FreeSpinsState;
}

export interface UserDto {
  id: string;
  name: string;
  currency: string;
}

export interface PaytableEntry {
  symbol: SymbolId;
  /** Множители общей ставки за 8–9, 10–11 и 12+ символов. */
  pays: readonly number[];
}

export interface GameConfigDto {
  cols: number;
  rows: number;
  betLevels: readonly number[];
  defaultBetIndex: number;
  paytable: readonly PaytableEntry[];
  minClusterSize: number;
  rtp?: number;
}

export interface InitResponse {
  sessionId: string;
  user: UserDto;
  balance: number;
  config: GameConfigDto;
}

export interface BalanceResponse {
  balance: number;
  currency: string;
}

export interface SlotApi {
  init(): Promise<InitResponse>;
  spin(req: SpinRequest): Promise<SpinResponse>;
  getBalance(): Promise<BalanceResponse>;
}
