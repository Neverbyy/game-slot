/**
 * Игровое поле 6×5: подложки ячеек, колонки барабанов и оркестрация
 * спина, каскадов, подсветки выигрышей, превращений в wild и удара кулака.
 */

import { Container, Graphics, Text } from 'pixi.js';

import { FIELD, GRID, cellCenter, fieldOrigin } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { WILD } from '@/config/symbols.config';
import { easeInQuad, flashCurve } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { shockwave } from '@/game/fx/ShockwaveFx';
import { formatCoin } from '@/utils/format';
import { createCellTile } from './CellTile';
import { ReelColumn, rowCenterY } from './ReelColumn';
import { COIN_VALUE_STYLE, type SymbolView } from './SymbolView';
import type { Cell, CollectedCoin, GameMode, Grid, Pos } from '@/api/types';

/** Насколько разъезжается волна взрыва по соседним ячейкам, мс. */
const WAVE_STEP_MS = 42;

export class ReelsView extends Container {
  private readonly tilesLight = new Container();
  private readonly tilesDark = new Container();
  private readonly columnsHolder = new Container();
  private readonly fx = new Container();
  private readonly columns: ReelColumn[] = [];
  /** Тёмные плитки по ключу «col:row» — гасим их поштучно. */
  private readonly darkTiles = new Map<string, Container>();

  private mode: GameMode = 'base';
  private inactive = new Set<string>();
  private factor = 1;

  constructor(private readonly randomCell: (mode: GameMode) => Cell) {
    super();
    this.eventMode = 'none';

    const origin = fieldOrigin();
    this.x = origin.x;
    this.y = origin.y;

    this.buildTiles();

    const step = GRID.cellWidth + GRID.gap;
    for (let col = 0; col < GRID.cols; col++) {
      const column = new ReelColumn(col, () => this.randomCell(this.mode));
      column.x = col * step;
      this.columnsHolder.addChild(column);
      this.columns.push(column);
    }

    this.addChild(this.tilesLight, this.tilesDark, this.columnsHolder, this.fx);
  }

  update(dt: number): void {
    for (const column of this.columns) {
      column.update(dt);
      for (let row = 0; row < GRID.rows; row++) column.rowView(row)?.update(dt);
    }
  }

  setTurbo(turbo: boolean): void {
    this.factor = turbo ? TIMINGS.turboFactor : 1;
    for (const column of this.columns) column.setTurboFactor(this.factor);
  }

  setMode(mode: GameMode): void {
    this.mode = mode;
  }

  /** Погашенные ячейки этого спина. */
  setInactive(positions: readonly Pos[], duration = 260): void {
    this.inactive = new Set(positions.map(([col, row]) => key(col, row)));

    for (const [cellId, tile] of this.darkTiles) {
      const target = this.inactive.has(cellId) ? 1 : 0;
      if (tile.alpha === target) continue;
      void tweens.to(tile, { alpha: target }, { duration });
    }
  }

  isInactive(col: number, row: number): boolean {
    return this.inactive.has(key(col, row));
  }

  /* --- Состояние поля --- */

  setGrid(grid: Grid): void {
    this.columns.forEach((column, col) => column.setColumn(grid[col] ?? []));
  }

  view(col: number, row: number): SymbolView | undefined {
    return this.columns[col]?.rowView(row);
  }

  /** Центр ячейки в координатах сцены — для молний и волны. */
  cellPoint(col: number, row: number): { x: number; y: number } {
    return cellCenter(col, row);
  }

  get centerPoint(): { x: number; y: number } {
    return { x: FIELD.centerX, y: FIELD.centerY };
  }

  /* --- Спин --- */

  startSpin(): void {
    this.clearHighlight();
    this.columns.forEach((column, i) =>
      column.spin(i * TIMINGS.reelStartStaggerMs * this.factor),
    );
  }

  /** Остановить барабаны на присланной сетке. */
  stopWith(grid: Grid): Promise<void> {
    const pending = this.columns.map(
      (column, i) =>
        new Promise<void>((resolve) => {
          column.onStopped = () => resolve();
          column.requestStop(grid[i] ?? [], i * TIMINGS.reelStopStaggerMs * this.factor);
        }),
    );

    return Promise.all(pending).then(() => undefined);
  }

  /* --- Презентация --- */

  highlight(positions: readonly Pos[]): void {
    const winners = new Set(positions.map(([col, row]) => key(col, row)));

    for (let col = 0; col < GRID.cols; col++) {
      for (let row = 0; row < GRID.rows; row++) {
        const view = this.view(col, row);
        if (!view) continue;
        const isWinner = winners.has(key(col, row));
        view.setWinning(isWinner);
        view.setDimmed(!isWinner);
      }
    }
  }

  clearHighlight(): void {
    for (let col = 0; col < GRID.cols; col++) {
      for (let row = 0; row < GRID.rows; row++) {
        const view = this.view(col, row);
        view?.setWinning(false);
        view?.setDimmed(false);
      }
    }
  }

  /** Каскад: взрыв выигравших и досыпка новых сверху. */
  async tumble(removed: readonly Pos[], grid: Grid): Promise<void> {
    const byColumn = groupRows(removed);

    await Promise.all(
      this.columns.map((column, col) => {
        const rows = byColumn.get(col);
        if (!rows?.length) return Promise.resolve();
        return column.tumble(
          [...rows].sort((a, b) => a - b),
          grid[col] ?? [],
        );
      }),
    );
  }

  /**
   * Убрать монеты с поля после того, как удар кулака отыгран: всё высыпается
   * и на его место падают обычные символы. Раскладка чисто косметическая —
   * итог следующего спина всё равно придёт с сервера.
   */
  async resetAfterSlam(): Promise<void> {
    const removed: Pos[] = [];
    const grid: Grid = [];

    for (let col = 0; col < GRID.cols; col++) {
      const column: Cell[] = [];
      for (let row = 0; row < GRID.rows; row++) {
        removed.push([col, row] as Pos);
        column.push(this.randomCell(this.mode));
      }
      grid.push(column);
    }

    this.setInactive([], 200);
    await this.tumble(removed, grid);
  }

  /** Превращение ячеек в wild после удара молнии. */
  async convertToWild(positions: readonly Pos[]): Promise<void> {
    const byColumn = groupRows(positions);

    await Promise.all(
      [...byColumn.entries()].map(
        ([col, rows]) =>
          this.columns[col]?.replaceCells(rows.map((row) => ({ row, cell: { symbol: WILD } }))) ??
          Promise.resolve(),
      ),
    );
  }

  /**
   * Удар кулака: волна от эпицентра разносит символы, на их месте
   * выпрыгивают монеты.
   */
  async slam(origin: Pos, coins: readonly CollectedCoin[]): Promise<void> {
    this.clearHighlight();

    const [originCol, originRow] = origin;
    const delayOf = ([col, row]: Pos): number =>
      Math.round(Math.hypot(col - originCol, row - originRow) * WAVE_STEP_MS * this.factor);

    const center = this.localCellPoint(originCol, originRow);
    void shockwave(this.fx, center.x, center.y, { duration: 620 * this.factor });

    const items = groupItems(coins, (coin) => ({
      row: coin.pos[1],
      cell: { symbol: coin.symbol, value: coin.value } as Cell,
      delay: delayOf(coin.pos),
    }));

    await Promise.all(
      [...items.entries()].map(
        ([col, rows]) => this.columns[col]?.smashCells(rows) ?? Promise.resolve(),
      ),
    );
  }

  /**
   * Сбор номиналов: цифры отрываются от монет и слетаются в монету-коллектор,
   * которая по ходу набирает сумму. Ближние к ней монеты отдают цифру первыми.
   */
  async collectValues(coins: readonly CollectedCoin[], collector: Pos): Promise<void> {
    const [targetCol, targetRow] = collector;
    const target = this.localCellPoint(targetCol, targetRow);
    const collectorView = this.view(targetCol, targetRow);

    const isCollector = ([col, row]: Pos) => col === targetCol && row === targetRow;
    const own = coins.find((coin) => isCollector(coin.pos));

    let collected = own?.value ?? 0;
    collectorView?.setValue(collected, 'collector');

    const others = coins
      .filter((coin) => !isCollector(coin.pos))
      .sort((a, b) => distanceTo(a.pos, collector) - distanceTo(b.pos, collector));

    await Promise.all(
      others.map(async (coin, index) => {
        const delay = index * TIMINGS.collectStaggerMs * this.factor;
        if (delay > 0) await tweens.delay(delay);

        const [col, row] = coin.pos;
        this.view(col, row)?.hideValue();

        const from = this.localCellPoint(col, row);
        const label = new Text({ text: formatCoin(coin.value), style: COIN_VALUE_STYLE });
        label.anchor.set(0.5);
        label.position.set(from.x, from.y);
        this.fx.addChild(label);

        const lift = 30 + Math.random() * 60;

        await tweens.animate({
          duration: TIMINGS.collectFlightMs * this.factor,
          ease: easeInQuad,
          onUpdate: (t) => {
            label.x = from.x + (target.x - from.x) * t;
            label.y = from.y + (target.y - from.y) * t - Math.sin(t * Math.PI) * lift;
            label.scale.set(1 - t * 0.45);
            label.alpha = t > 0.86 ? 1 - (t - 0.86) / 0.14 : 1;
          },
        });

        label.destroy();

        collected += coin.value;
        collectorView?.setValue(collected, 'collector');
        void collectorView?.punchValue();
      }),
    );

    await tweens.delay(TIMINGS.collectHoldMs * this.factor);
  }

  /** Вспышка в ячейке — момент попадания молнии. */
  flashCell(col: number, row: number): Promise<void> {
    const step = GRID.cellWidth + GRID.gap;
    const flash = new Graphics()
      .roundRect(
        col * step,
        rowCenterY(row) - GRID.cellHeight / 2,
        GRID.cellWidth,
        GRID.cellHeight,
        10,
      )
      .fill({ color: 0xffffff });

    flash.blendMode = 'add';
    this.fx.addChild(flash);

    return tweens
      .animate({
        duration: 320,
        ease: flashCurve,
        onUpdate: (t) => {
          flash.alpha = t;
        },
      })
      .then(() => flash.destroy());
  }

  /** Центр ячейки в локальных координатах поля. */
  private localCellPoint(col: number, row: number): { x: number; y: number } {
    return {
      x: col * (GRID.cellWidth + GRID.gap) + GRID.cellWidth / 2,
      y: rowCenterY(row),
    };
  }

  private buildTiles(): void {
    const step = GRID.cellWidth + GRID.gap;

    for (let col = 0; col < GRID.cols; col++) {
      for (let row = 0; row < GRID.rows; row++) {
        const seed = col * 31 + row * 7 + 1;

        const light = createCellTile('light', seed);
        light.x = col * step;
        light.y = row * (GRID.cellHeight + GRID.gap);
        this.tilesLight.addChild(light);

        const dark = createCellTile('dark', seed);
        dark.x = light.x;
        dark.y = light.y;
        dark.alpha = 0;
        this.tilesDark.addChild(dark);
        this.darkTiles.set(key(col, row), dark);
      }
    }
  }
}

const key = (col: number, row: number): string => `${col}:${row}`;

function distanceTo(pos: Pos, target: Pos): number {
  return Math.hypot(pos[0] - target[0], pos[1] - target[1]);
}

function groupRows(positions: readonly Pos[]): Map<number, number[]> {
  const byColumn = new Map<number, number[]>();
  for (const [col, row] of positions) {
    const rows = byColumn.get(col) ?? [];
    rows.push(row);
    byColumn.set(col, rows);
  }
  return byColumn;
}

/** Разложить монеты по колонкам, попутно превратив их в элементы анимации. */
function groupItems<T>(
  coins: readonly CollectedCoin[],
  map: (coin: CollectedCoin) => T,
): Map<number, T[]> {
  const byColumn = new Map<number, T[]>();
  for (const coin of coins) {
    const col = coin.pos[0];
    const items = byColumn.get(col) ?? [];
    items.push(map(coin));
    byColumn.set(col, items);
  }
  return byColumn;
}
