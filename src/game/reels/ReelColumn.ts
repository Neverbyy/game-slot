/**
 * Колонка барабана.
 *
 * Во время вращения символы живут в кольцевом пуле: позиция прокрутки —
 * непрерывное число в единицах ячейки, слоты переиспользуются по кругу и
 * получают случайные символы, когда «уезжают» за верхнюю границу.
 *
 * Целевые символы вписываются в ленту перед торможением (`pending`), поэтому
 * колонка плавно доезжает ровно до сетки, присланной сервером.
 *
 * После остановки колонка переходит в «осевшее» состояние: `rowViews[row]` —
 * это символ в ряду, и каскады двигают именно их.
 */

import { BlurFilter, Container, Graphics } from 'pixi.js';

import { CELL_STEP, GRID, cellLocal } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { bounceCurve, easeInQuad, easeOutCubic, easeOutQuad } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { mod } from '@/utils/math';
import { SymbolView } from './SymbolView';
import type { Cell } from '@/api/types';

const STEP = CELL_STEP.y;
const SLOT_COUNT = GRID.rows + 2;
const COLUMN_HEIGHT = GRID.rows * STEP - GRID.gap;

type ColumnState = 'idle' | 'accelerating' | 'spinning' | 'stopping' | 'bouncing';

/** Центр ряда в локальных координатах колонки. */
export function rowCenterY(row: number): number {
  return cellLocal(0, row).y;
}

export class ReelColumn extends Container {
  private readonly content = new Container();
  private slots: SymbolView[] = [];
  private rowViews: SymbolView[] = [];

  /** Какой виртуальный индекс ленты сейчас показывает слот. */
  private readonly virtualOf = new Map<SymbolView, number>();
  /** Виртуальный индекс → символ, который обязан там оказаться. */
  private readonly pending = new Map<number, Cell>();

  private scroll = 0;
  private speed = 0;
  private state: ColumnState = 'idle';
  private stateTime = 0;
  private spinTime = 0;

  private stopTarget: Cell[] | null = null;
  private stopDelay = 0;
  private stopFrom = 0;
  private stopTo = 0;

  private factor = 1;
  private blur: BlurFilter | null = null;

  onStopped?: (index: number) => void;

  constructor(
    readonly index: number,
    private readonly randomCell: () => Cell,
  ) {
    super();
    this.eventMode = 'none';

    for (let i = 0; i < SLOT_COUNT; i++) {
      const view = new SymbolView();
      view.x = GRID.cellWidth / 2;
      view.y = rowCenterY(i);
      this.content.addChild(view);
      this.slots.push(view);
    }

    this.rowViews = this.slots.slice(0, GRID.rows);

    const mask = new Graphics()
      .rect(-GRID.gap, -GRID.gap, GRID.cellWidth + GRID.gap * 2, COLUMN_HEIGHT + GRID.gap * 2)
      .fill(0xffffff);

    this.content.mask = mask;
    this.addChild(this.content, mask);
  }

  get isSpinning(): boolean {
    return this.state !== 'idle';
  }

  setTurboFactor(factor: number): void {
    this.factor = factor;
  }

  rowView(row: number): SymbolView | undefined {
    return this.rowViews[row];
  }

  /** Мгновенно выставить колонку (старт игры, восстановление состояния). */
  setColumn(cells: readonly Cell[]): void {
    this.rowViews.forEach((view, row) => {
      view.setCell(cells[row] ?? null);
      view.reset();
      view.y = rowCenterY(row);
    });
  }

  /* --- Вращение --- */

  spin(delayMs: number): void {
    if (this.state !== 'idle') return;

    this.prepareForSpin();
    this.state = 'accelerating';
    this.stateTime = -delayMs;
    this.spinTime = 0;
    this.stopTarget = null;
    this.setBlur(true);
  }

  /** Запросить остановку на целевом окне символов. */
  requestStop(target: readonly Cell[], delayMs: number): void {
    this.stopTarget = [...target];
    this.stopDelay = delayMs;
  }

  update(dt: number): void {
    if (this.state === 'idle') return;

    this.stateTime += dt;

    switch (this.state) {
      case 'accelerating': {
        if (this.stateTime < 0) return;
        const t = Math.min(this.stateTime / (TIMINGS.reelAccelerationMs * this.factor), 1);
        this.speed = TIMINGS.reelSpeed * easeInQuad(t) * (this.factor < 1 ? 1.5 : 1);
        this.advance(dt);
        if (t >= 1) this.enter('spinning');
        break;
      }

      case 'spinning': {
        this.spinTime += dt;
        this.advance(dt);
        this.tryBeginStop();
        break;
      }

      case 'stopping': {
        const duration = TIMINGS.reelStopMs * this.factor;
        const t = Math.min(this.stateTime / duration, 1);
        this.scroll = this.stopFrom + (this.stopTo - this.stopFrom) * easeOutCubic(t);
        this.layoutSpin();
        if (t >= 1) {
          this.scroll = this.stopTo;
          this.speed = 0;
          this.layoutSpin();
          this.setBlur(false);
          this.settle();
          this.enter('bouncing');
        }
        break;
      }

      case 'bouncing': {
        const duration = TIMINGS.reelBounceMs * this.factor;
        const t = Math.min(this.stateTime / duration, 1);
        this.content.y = bounceCurve(t) * GRID.cellHeight * TIMINGS.reelBounceAmplitude;
        if (t >= 1) {
          this.content.y = 0;
          this.state = 'idle';
          this.onStopped?.(this.index);
        }
        break;
      }
    }
  }

  /* --- Каскад --- */

  /**
   * Взорвать выигравшие символы, опустить оставшиеся и досыпать новые сверху.
   * `newColumn` — колонка уже после падения, как её посчитал сервер.
   */
  async tumble(removedRows: readonly number[], newColumn: readonly Cell[]): Promise<void> {
    if (!removedRows.length) return;

    const removed = new Set(removedRows);

    await Promise.all(
      removedRows.map((row, i) => this.rowViews[row]?.explode(i * 30 * this.factor) ?? null),
    );

    const recycled = removedRows.map((row) => this.rowViews[row] as SymbolView);
    const survivors = this.rowViews.filter((_, row) => !removed.has(row));
    const ordered = [...recycled, ...survivors];

    // Переиспользованные виды становятся новыми символами и стартуют над маской.
    recycled.forEach((view, i) => {
      view.setCell(newColumn[i] ?? null);
      view.reset();
      view.y = rowCenterY(i - recycled.length);
    });

    const duration = TIMINGS.tumbleFallMs * this.factor;

    await Promise.all(
      ordered.map(async (view, row) => {
        const targetY = rowCenterY(row);
        if (Math.abs(view.y - targetY) < 0.5) return;

        await tweens.to(view, { y: targetY }, { duration, ease: easeOutQuad, delay: row * 18 });
        await view.squash();
      }),
    );

    this.rowViews = ordered;
    this.rowViews.forEach((view, row) => {
      view.setCell(newColumn[row] ?? null);
      view.y = rowCenterY(row);
    });
  }

  /**
   * Подменить символы в указанных рядах с пружинным появлением.
   * Так ставятся и wild-ы после молнии, и монеты после удара кулака.
   */
  async replaceCells(items: readonly { row: number; cell: Cell; delay?: number }[]): Promise<void> {
    await Promise.all(
      items.map(async ({ row, cell, delay = 0 }) => {
        const view = this.rowViews[row];
        if (!view) return;
        if (delay > 0) await tweens.delay(delay);
        view.setCell(cell);
        await view.pop();
      }),
    );
  }

  /**
   * Удар кулака: символ взрывается и тут же на его месте выпрыгивает монета.
   * Задержка у каждой ячейки своя — так получается волна от эпицентра.
   */
  async smashCells(items: readonly { row: number; cell: Cell; delay?: number }[]): Promise<void> {
    await Promise.all(
      items.map(async ({ row, cell, delay = 0 }) => {
        const view = this.rowViews[row];
        if (!view) return;
        await view.explode(delay);
        view.setCell(cell);
        await view.pop();
      }),
    );
  }

  /* --- Внутреннее --- */

  private tryBeginStop(): void {
    if (!this.stopTarget) return;
    if (this.spinTime < TIMINGS.reelMinSpinMs * this.factor + this.stopDelay) return;

    const target = this.stopTarget;
    this.stopTarget = null;

    // Запас хода, чтобы торможение было плавным и целевые символы
    // не пересеклись с уже видимыми.
    const landing = Math.ceil(this.scroll) + GRID.rows + 2;
    target.forEach((cell, row) => this.pending.set(landing - row, cell));

    this.stopFrom = this.scroll;
    this.stopTo = landing;
    this.enter('stopping');
  }

  private enter(state: ColumnState): void {
    this.state = state;
    this.stateTime = 0;
  }

  private advance(dt: number): void {
    this.scroll += (this.speed * dt) / 1000;
    this.layoutSpin();
    this.updateBlur();
  }

  /** Раскладка кольцевого пула под текущую позицию. */
  private layoutSpin(): void {
    const base = Math.floor(this.scroll);
    const frac = this.scroll - base;

    for (let k = -1; k <= GRID.rows; k++) {
      const virtual = base - k;
      const slot = this.slots[mod(virtual, SLOT_COUNT)];
      if (!slot) continue;

      if (this.virtualOf.get(slot) !== virtual) {
        this.virtualOf.set(slot, virtual);
        slot.setCell(this.pending.get(virtual) ?? this.randomCell());
        slot.reset();
      }

      slot.y = (k + frac) * STEP + GRID.cellHeight / 2;
    }
  }

  /** Перестроить пул так, чтобы он соответствовал осевшим рядам. */
  private prepareForSpin(): void {
    this.scroll = 0;
    this.virtualOf.clear();
    this.pending.clear();

    const next = new Array<SymbolView | undefined>(SLOT_COUNT);
    this.rowViews.forEach((view, row) => {
      next[mod(-row, SLOT_COUNT)] = view;
      this.virtualOf.set(view, -row);
    });

    const extras = this.slots.filter((view) => !this.rowViews.includes(view));
    let cursor = 0;
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (!next[i]) next[i] = extras[cursor++];
    }

    this.slots = next as SymbolView[];
    for (const view of this.slots) view.reset();
  }

  /** Зафиксировать осевшее состояние после остановки. */
  private settle(): void {
    const landing = Math.round(this.scroll);
    const settled: SymbolView[] = [];

    for (let row = 0; row < GRID.rows; row++) {
      const view = this.slots[mod(landing - row, SLOT_COUNT)];
      if (!view) continue;
      view.y = rowCenterY(row);
      settled.push(view);
    }

    this.rowViews = settled;
    this.pending.clear();
  }

  private setBlur(enabled: boolean): void {
    if (enabled) {
      this.blur ??= new BlurFilter({ strength: 0, quality: 2 });
      this.blur.strengthX = 0;
      this.blur.strengthY = 0;
      this.content.filters = [this.blur];
    } else {
      this.content.filters = [];
    }
  }

  private updateBlur(): void {
    if (!this.blur) return;
    this.blur.strengthY = Math.min((this.speed / TIMINGS.reelSpeed) * 11, 11);
  }
}
