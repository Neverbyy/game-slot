/**
 * Игровое поле 6×5: подложки ячеек, колонки барабанов и оркестрация
 * спина, каскадов, подсветки выигрышей, превращений в wild и удара кулака.
 */

import { BlurFilter, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';

import { CELL_STEP, FIELD, GRID, cellLocal, type SceneLayout } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { WILD } from '@/config/symbols.config';
import { texture } from '@/game/core/AssetLoader';
import { easeInQuad, easeOutBack, easeOutCubic, flashCurve } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { shockwave } from '@/game/fx/ShockwaveFx';
import { formatCoin } from '@/utils/format';
import { createCellTile } from './CellTile';
import { ReelColumn } from './ReelColumn';
import { COIN_VALUE_STYLE, GOLD_VALUE_STYLE, symbolFit, type SymbolView } from './SymbolView';
import type { Cell, CollectedCoin, GameMode, Grid, Pos } from '@/api/types';

/** Насколько разъезжается волна взрыва по соседним ячейкам, мс. */
const WAVE_STEP_MS = 42;

/**
 * Во сколько раз вылезший кулак больше своего места на иконке: при 1.3
 * костяшки ложатся на верх золотого кольца, а бока кольца остаются видны.
 */
const FIST_POP_SCALE = 1.3;
/** Точка роста кулака — запястье, доля высоты ниже центра иконки. */
const FIST_PIVOT_Y = 0.15;

/** Запекание плиток поля в текстуру (см. uildTiles). */
const TILE_CACHE = { resolution: 2, antialias: true } as const;

export class ReelsView extends Container {
  private readonly tilesLight = new Container();
  private readonly tilesDark = new Container();
  private readonly columnsHolder = new Container();
  private readonly fx = new Container();
  private readonly columns: ReelColumn[] = [];
  /** Тёмные плитки по ключу «col:row» — гасим их поштучно. */
  private readonly darkTiles = new Map<string, Container>();

  private mode: GameMode = 'base';
  private factor = 1;

  /**
   * Размытие тени и свечения вылезшего кулака. Общие на все удары: при
   * уничтожении подсветки Pixi фильтры не освобождает, и новые на каждый
   * удар копились бы.
   */
  private readonly fistShadowBlur = new BlurFilter({ strength: 8, quality: 2 });
  private readonly fistGlowBlur = new BlurFilter({ strength: 10, quality: 3 });

  /** Живая подсветка выпавшего кулака. */
  private slamFx: {
    pos: Pos;
    holder: Container;
    /** Иконка целиком — остаётся в размер ячейки, кольцо никуда не уезжает. */
    base: Sprite;
    /** Вырезанный кулак с тенью и свечением: он и вылезает поверх рамки. */
    fist: Container;
    glow: Sprite;
    shadow: Sprite;
    ring: Graphics;
    /** Масштаб, при котором вырезка совпадает с кулаком на иконке. */
    fistScale: number;
    elapsed: number;
    /** Пульсация начинается после того, как кулак вылез из круга. */
    popped: boolean;
  } | null = null;

  /** Кулак без диска и кольца (см. FistCutout). */
  private fistCutout: Texture | null = null;

  constructor(private readonly randomCell: (mode: GameMode) => Cell) {
    super();
    this.eventMode = 'none';

    this.buildTiles();

    for (let col = 0; col < GRID.cols; col++) {
      const column = new ReelColumn(col, () => this.randomCell(this.mode));
      column.x = col * CELL_STEP.x;
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

    this.updateSlamHighlight(dt);
  }

  /** Пульсация кулака и рамки вокруг его ячейки. */
  private updateSlamHighlight(dt: number): void {
    const fx = this.slamFx;
    if (!fx?.popped) return;

    fx.elapsed += dt;

    const breathe = 0.5 + Math.sin(fx.elapsed / 140) * 0.5;
    const ringPulse = 0.5 + Math.sin(fx.elapsed / 120) * 0.5;

    this.setFistScale(fx, FIST_POP_SCALE + breathe * 0.04);
    fx.glow.alpha = 0.35 + breathe * 0.3;
    fx.ring.alpha = 0.45 + ringPulse * 0.55;
    fx.ring.scale.set(1 + ringPulse * 0.05);
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
    const inactive = new Set(positions.map(([col, row]) => key(col, row)));

    for (const [cellId, tile] of this.darkTiles) {
      const target = inactive.has(cellId) ? 1 : 0;
      if (tile.alpha === target) continue;
      void tweens.to(tile, { alpha: target }, { duration });
    }
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
    const local = cellLocal(col, row);
    return { x: this.x + local.x, y: this.y + local.y };
  }

  /** Поле ставится левым верхним углом так, чтобы его центр был в центре раскладки. */
  applyLayout(layout: SceneLayout): void {
    this.x = layout.field.centerX - FIELD.width / 2;
    this.y = layout.field.centerY - FIELD.height / 2;
  }

  /* --- Спин --- */

  startSpin(): void {
    this.clearHighlight();
    this.columns.forEach((column, i) => column.spin(i * TIMINGS.reelStartStaggerMs * this.factor));
  }

  /** Остановить барабаны на присланной сетке. */
  stopWith(grid: Grid, onColumnStopped?: (col: number) => void): Promise<void> {
    const pending = this.columns.map(
      (column, i) =>
        new Promise<void>((resolve) => {
          column.onStopped = () => {
            onColumnStopped?.(i);
            resolve();
          };
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
    const byColumn = groupByColumn(
      removed,
      (pos) => pos,
      ([, row]) => row,
    );

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
    const byColumn = groupByColumn(
      positions,
      (pos) => pos,
      ([, row]) => row,
    );

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

    const center = cellLocal(originCol, originRow);
    void shockwave(this.fx, center.x, center.y, { duration: 620 * this.factor });

    const items = groupByColumn(
      coins,
      (coin) => coin.pos,
      (coin) => ({
        row: coin.pos[1],
        cell: { symbol: coin.symbol, value: coin.value } as Cell,
        delay: delayOf(coin.pos),
      }),
    );

    await Promise.all(
      [...items.entries()].map(
        ([col, rows]) => this.columns[col]?.smashCells(rows) ?? Promise.resolve(),
      ),
    );
  }

  /**
   * Показать, что выпал кулак: ячейка вспыхивает и обводится рамкой, сама
   * иконка вылезает из ячейки поверх соседей и пульсирует до самого удара.
   */
  async highlightSlam(pos: Pos, factor = 1): Promise<void> {
    this.clearSlamHighlight();

    const [col, row] = pos;
    const center = cellLocal(col, row);
    const view = this.view(col, row);
    if (view) view.visible = false;

    const holder = new Container();
    holder.position.set(center.x, center.y);

    const ring = cellRing(0x8fe3ff);

    const tex = texture('extra_slam');
    const fit = symbolFit(tex);

    // Иконка целиком остаётся в ячейке — золотой круг никуда не уезжает.
    const base = new Sprite(tex);
    base.anchor.set(0.5);
    base.scale.set(fit);

    // Поверх — вырезанный кулак того же размера, что и на иконке. Растёт он
    // от запястья, поэтому бока кольца остаются открытыми, а костяшки
    // выходят за верх рамки. Тень и свечение отрывают его от диска.
    const cutout = this.fistCutout ?? tex;
    const fistScale = fit * ((tex.width || 1) / (cutout.width || 1));
    const pivotY = cutout.height * FIST_PIVOT_Y;

    const shadow = new Sprite(cutout);
    shadow.anchor.set(0.5);
    shadow.position.set(0, cutout.height * 0.03);
    shadow.tint = 0x000814;
    shadow.alpha = 0;
    shadow.filters = [this.fistShadowBlur];

    const glow = new Sprite(cutout);
    glow.anchor.set(0.5);
    glow.alpha = 0;
    glow.blendMode = 'add';
    glow.filters = [this.fistGlowBlur];

    const icon = new Sprite(cutout);
    icon.anchor.set(0.5);

    const fist = new Container();
    fist.pivot.set(0, pivotY);
    fist.y = pivotY * fistScale;
    fist.scale.set(fistScale);
    fist.addChild(shadow, glow, icon);

    holder.addChild(ring, base, fist);
    this.fx.addChild(holder);

    const fx = {
      pos,
      holder,
      base,
      fist,
      glow,
      shadow,
      ring,
      fistScale,
      elapsed: 0,
      popped: false,
    };
    this.slamFx = fx;

    void this.flashCell(col, row);

    // Кулак выпрыгивает из круга с перелётом и ложится на верх кольца.
    await tweens.animate({
      duration: 420 * factor,
      ease: easeOutBack(2.4),
      onUpdate: (t) => {
        this.setFistScale(fx, 1 + t * (FIST_POP_SCALE - 1));
        const k = Math.min(1, Math.max(0, t));
        shadow.alpha = 0.5 * k;
        glow.alpha = 0.5 * k;
      },
    });

    fx.popped = true;
  }

  /** Масштаб вылезшего кулака: 1 — ровно как на иконке. */
  private setFistScale(fx: NonNullable<ReelsView['slamFx']>, scale: number): void {
    fx.fist.scale.set(fx.fistScale * scale);
  }

  /** Схлопнуть подсветку кулака — момент броска молнии. */
  async releaseSlam(factor = 1): Promise<void> {
    const fx = this.slamFx;
    if (!fx) return;
    this.slamFx = null;

    const [col, row] = fx.pos;
    const view = this.view(col, row);
    if (view) view.visible = true;

    await tweens.animate({
      duration: 260 * factor,
      ease: easeInQuad,
      onUpdate: (t) => {
        this.setFistScale(fx, FIST_POP_SCALE + t * 0.6);
        fx.holder.alpha = 1 - t;
      },
    });

    fx.holder.destroy({ children: true });
  }

  /** Вырезка кулака готовится один раз при старте игры. */
  setFistCutout(texture: Texture): void {
    this.fistCutout = texture;
  }

  /** Снять подсветку без анимации. */
  clearSlamHighlight(): void {
    const fx = this.slamFx;
    if (!fx) return;
    this.slamFx = null;

    const [col, row] = fx.pos;
    const view = this.view(col, row);
    if (view) view.visible = true;

    fx.holder.destroy({ children: true });
  }

  /**
   * Сбор номиналов: цифры отрываются от монет и слетаются в монету-коллектор,
   * которая по ходу набирает сумму. Ближние к ней монеты отдают цифру первыми.
   */
  async collectValues(coins: readonly CollectedCoin[], collector: Pos): Promise<void> {
    const [targetCol, targetRow] = collector;
    const target = cellLocal(targetCol, targetRow);
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

        const from = cellLocal(col, row);
        const label = new Text({
          text: formatCoin(coin.value),
          style: coin.symbol === 'coin_gold' ? GOLD_VALUE_STYLE : COIN_VALUE_STYLE,
        });
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

  /** Убрать номинал с монеты (сумму с коллектора перед экраном выигрыша). */
  fadeOutValue(pos: Pos, duration: number): Promise<void> {
    return this.view(pos[0], pos[1])?.fadeOutValue(duration) ?? Promise.resolve();
  }

  /**
   * Приземление скаттера: ячейка вспыхивает, от неё расходится золотая
   * рамка, иконка пружинно подпрыгивает со свечением.
   */
  landScatter(col: number, row: number): void {
    void this.flashCell(col, row);
    void this.view(col, row)?.celebrate();

    const center = cellLocal(col, row);
    const ring = cellRing(0xffd35a);
    ring.position.set(center.x, center.y);
    this.fx.addChild(ring);

    void tweens
      .animate({
        duration: 650 * this.factor,
        ease: easeOutCubic,
        onUpdate: (t) => {
          ring.scale.set(0.92 + t * 0.26);
          ring.alpha = 1 - t;
        },
      })
      .then(() => ring.destroy());
  }

  /** Вспышка в ячейке — момент попадания молнии. */
  flashCell(col: number, row: number): Promise<void> {
    const center = cellLocal(col, row);
    const flash = new Graphics()
      .roundRect(
        center.x - GRID.cellWidth / 2,
        center.y - GRID.cellHeight / 2,
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

  private buildTiles(): void {
    for (let col = 0; col < GRID.cols; col++) {
      for (let row = 0; row < GRID.rows; row++) {
        const seed = col * 31 + row * 7 + 1;

        const light = createCellTile('light', seed);
        light.x = col * CELL_STEP.x;
        light.y = row * CELL_STEP.y;
        this.tilesLight.addChild(light);

        const dark = createCellTile('dark', seed);
        dark.x = light.x;
        dark.y = light.y;
        dark.alpha = 0;
        this.tilesDark.addChild(dark);
        this.darkTiles.set(key(col, row), dark);
        // Тёмные плитки гаснут поштучно — прозрачность кеш не сбрасывает.
        dark.cacheAsTexture(TILE_CACHE);
      }
    }

    // Плитки статичны, а у каждой — маска под облака. Запекаем их в текстуру,
    // чтобы не гонять 60 масок каждый кадр. Разрешение с запасом — иначе
    // бортики мылятся, когда мир растянут на большой экран.
    this.tilesLight.cacheAsTexture(TILE_CACHE);
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.fistShadowBlur.destroy();
    this.fistGlowBlur.destroy();
    super.destroy(options);
  }
}

const key = (col: number, row: number): string => `${col}:${row}`;

function distanceTo(pos: Pos, target: Pos): number {
  return Math.hypot(pos[0] - target[0], pos[1] - target[1]);
}

/** Разложить элементы по колонкам, попутно превратив их в то, что нужно колонке. */
function groupByColumn<S, T>(
  items: readonly S[],
  posOf: (item: S) => Pos,
  map: (item: S) => T,
): Map<number, T[]> {
  const byColumn = new Map<number, T[]>();
  for (const item of items) {
    const col = posOf(item)[0];
    const list = byColumn.get(col) ?? [];
    list.push(map(item));
    byColumn.set(col, list);
  }
  return byColumn;
}

/** Светящаяся рамка по контуру ячейки, с центром в (0, 0). */
function cellRing(color: number): Graphics {
  const ring = new Graphics()
    .roundRect(-GRID.cellWidth / 2, -GRID.cellHeight / 2, GRID.cellWidth, GRID.cellHeight, 12)
    .stroke({ width: 6, color, alpha: 1 });
  ring.blendMode = 'add';
  return ring;
}
