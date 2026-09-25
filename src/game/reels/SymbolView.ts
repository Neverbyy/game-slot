/** Один символ в ячейке: спрайт, свечение победы и номинал для монет. */

import { BlurFilter, Container, FillGradient, Sprite, Text, TextStyle } from 'pixi.js';

import { GRID } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { texture } from '@/game/core/AssetLoader';
import { easeInBack, easeOutBack, easeOutQuad } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { formatCoin } from '@/utils/format';
import type { Cell } from '@/api/types';

/** Доля ячейки, которую занимает символ. */
const FIT = 0.86;

/** Номинал обычной монеты — серебристые цифры по центру. */
export const COIN_VALUE_STYLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif',
  fontSize: 52,
  fontWeight: '900',
  fill: 0xf4f8ff,
  stroke: { color: 0x2b3a52, width: 8, join: 'round' },
  dropShadow: { color: 0x000000, alpha: 0.45, blur: 4, distance: 3, angle: Math.PI / 2 },
  align: 'center',
});

/**
 * Сумма на монете-коллекторе: крупные золотые цифры. Они шире монеты и
 * перекрывают запечённую в текстуре «25», поэтому отдельный ассет не нужен.
 */
export const COLLECTOR_VALUE_STYLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif',
  fontSize: 62,
  fontWeight: '900',
  fill: new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: '#fffbe0' },
      { offset: 0.4, color: '#ffd035' },
      { offset: 0.75, color: '#f59a12' },
      { offset: 1, color: '#c96a05' },
    ],
  }),
  stroke: { color: 0x2a1602, width: 10, join: 'round' },
  dropShadow: { color: 0x000000, alpha: 0.55, blur: 6, distance: 4, angle: Math.PI / 2 },
  align: 'center',
});

export type ValueVariant = 'coin' | 'collector';

export class SymbolView extends Container {
  private readonly sprite = new Sprite();
  private readonly glow = new Sprite();
  private readonly value = new Text({ text: '', style: COIN_VALUE_STYLE });

  private cell: Cell | null = null;
  private winning = false;
  private elapsed = 0;

  constructor() {
    super();
    this.eventMode = 'none';

    this.sprite.anchor.set(0.5);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.alpha = 0;
    this.glow.filters = [new BlurFilter({ strength: 10, quality: 2 })];

    this.value.anchor.set(0.5);
    this.value.visible = false;

    this.addChild(this.glow, this.sprite, this.value);
  }

  get symbolId(): string | null {
    return this.cell?.symbol ?? null;
  }

  get currentCell(): Cell | null {
    return this.cell;
  }

  setCell(cell: Cell | null): void {
    this.cell = cell;

    if (!cell) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const tex = texture(cell.symbol);
    this.sprite.texture = tex;
    this.glow.texture = tex;

    const fit = Math.min(
      (GRID.cellWidth * FIT) / (tex.width || 1),
      (GRID.cellHeight * FIT) / (tex.height || 1),
    );
    this.sprite.scale.set(fit);
    this.glow.scale.set(fit * 1.08);

    // Номинал пишем только на серебряной монете: на золотой «25» уже в текстуре.
    this.setValue(cell.symbol === 'coin_silver' ? (cell.value ?? null) : null);
  }

  /** Показать сумму на монете; `null` — убрать. */
  setValue(value: number | null, variant: ValueVariant = 'coin'): void {
    if (value === null) {
      this.value.visible = false;
      return;
    }

    this.value.style = variant === 'collector' ? COLLECTOR_VALUE_STYLE : COIN_VALUE_STYLE;
    this.value.text = formatCoin(value);
    this.value.visible = true;
    this.value.scale.set(1);
  }

  hideValue(): void {
    this.value.visible = false;
  }

  /** Толчок суммы на коллекторе, когда прилетела очередная цифра. */
  async punchValue(): Promise<void> {
    await tweens.animate(
      {
        duration: 200,
        ease: easeOutQuad,
        onUpdate: (t) => this.value.scale.set(1 + Math.sin(t * Math.PI) * 0.22),
      },
      this.value,
    );
    this.value.scale.set(1);
  }

  /** Пульсация свечения у выигравших символов. */
  update(dt: number): void {
    if (!this.winning) return;
    this.elapsed += dt;
    const pulse = 0.5 + Math.sin(this.elapsed / 180) * 0.5;
    this.glow.alpha = 0.45 + pulse * 0.55;
    const scale = 1 + pulse * 0.06;
    this.scale.set(scale);
  }

  setWinning(active: boolean): void {
    if (this.winning === active) return;
    this.winning = active;
    this.elapsed = 0;

    if (!active) {
      this.glow.alpha = 0;
      this.scale.set(1);
    }
  }

  setDimmed(dimmed: boolean): void {
    this.alpha = dimmed ? 0.32 : 1;
  }

  /**
   * Взрыв символа. Вид остаётся прозрачным — вызывающий код сам решает,
   * что показать дальше: `reset()` с новым символом или `pop()` монеты.
   * Иначе между взрывом и подменой проскакивал бы кадр со старым символом.
   */
  async explode(delay = 0): Promise<void> {
    this.setWinning(false);
    await tweens.animate(
      {
        duration: TIMINGS.symbolExplodeMs,
        delay,
        ease: easeInBack,
        onUpdate: (t) => {
          this.scale.set(1 + t * 0.55);
          this.alpha = 1 - t;
        },
      },
      this,
    );
  }

  /** Пружинное появление — превращение в wild. */
  async pop(): Promise<void> {
    this.alpha = 1;
    await tweens.animate(
      {
        duration: 320,
        ease: easeOutBack(2.2),
        onUpdate: (t) => this.scale.set(0.3 + t * 0.7),
      },
      this,
    );
    this.scale.set(1);
  }

  /** Приземление после падения: лёгкое сплющивание. */
  async squash(): Promise<void> {
    await tweens.animate(
      {
        duration: 140,
        ease: easeOutQuad,
        onUpdate: (t) => {
          const k = Math.sin(t * Math.PI) * 0.12;
          this.scale.set(1 + k, 1 - k);
        },
      },
      this,
    );
    this.scale.set(1);
  }

  reset(): void {
    this.alpha = 1;
    this.scale.set(1);
    this.glow.alpha = 0;
    this.winning = false;
  }
}
