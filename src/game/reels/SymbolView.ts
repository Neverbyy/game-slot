/** Один символ в ячейке: спрайт, свечение победы и номинал для монет. */

import { BlurFilter, Container, Sprite, Text, TextStyle, type Texture } from 'pixi.js';

import { GRID } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { texture } from '@/game/core/AssetLoader';
import { easeInBack, easeOutBack, easeOutQuad } from '@/game/core/Easing';
import { DISPLAY_FONT, GOLD_FILL } from '@/game/core/textStyles';
import { tweens } from '@/game/core/Tween';
import { formatCoin } from '@/utils/format';
import type { Cell } from '@/api/types';

/** Доля ячейки, которую занимает символ. */
const FIT = 0.86;

/** Масштаб, при котором текстура вписывается в ячейку. */
export function symbolFit(tex: Texture): number {
  return Math.min(
    (GRID.cellWidth * FIT) / (tex.width || 1),
    (GRID.cellHeight * FIT) / (tex.height || 1),
  );
}

/**
 * Размытие свечения — одно на все символы: параметры у всех одинаковые,
 * а фильтр на каждый из 42 видов обходился бы в лишние проходы рендера.
 */
const GLOW_BLUR = new BlurFilter({ strength: 10, quality: 2 });

/** Номинал серебряной монеты. */
export const COIN_VALUE_STYLE = new TextStyle({
  fontFamily: DISPLAY_FONT,
  fontSize: 52,
  fontWeight: '900',
  fill: 0xf4f8ff,
  stroke: { color: 0x2b3a52, width: 8, join: 'round' },
  dropShadow: { color: 0x000000, alpha: 0.45, blur: 4, distance: 3, angle: Math.PI / 2 },
  align: 'center',
});

/** Номинал золотой монеты — тот же размер, но золотом. */
export const GOLD_VALUE_STYLE = new TextStyle({
  fontFamily: DISPLAY_FONT,
  fontSize: 52,
  fontWeight: '900',
  fill: GOLD_FILL,
  stroke: { color: 0x2a1602, width: 9, join: 'round' },
  dropShadow: { color: 0x000000, alpha: 0.5, blur: 5, distance: 3, angle: Math.PI / 2 },
  align: 'center',
});

export type ValueVariant = 'silver' | 'gold' | 'collector';

/** Коллектор пишется тем же кеглем, что и остальные монеты. */
const VALUE_STYLES: Record<ValueVariant, TextStyle> = {
  silver: COIN_VALUE_STYLE,
  gold: GOLD_VALUE_STYLE,
  collector: GOLD_VALUE_STYLE,
};

/** Каким стилем подписывать номинал этой монеты. */
export function coinValueVariant(symbol: string): ValueVariant {
  return symbol === 'coin_gold' ? 'gold' : 'silver';
}

export class SymbolView extends Container {
  private readonly sprite = new Sprite();
  private readonly glow = new Sprite();
  private readonly value = new Text({ text: '', style: COIN_VALUE_STYLE });

  private winning = false;
  private elapsed = 0;

  constructor() {
    super();
    this.eventMode = 'none';

    this.sprite.anchor.set(0.5);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = 'add';
    this.glow.filters = [GLOW_BLUR];
    this.setGlow(0);

    this.value.anchor.set(0.5);
    this.value.visible = false;

    this.addChild(this.glow, this.sprite, this.value);
  }

  setCell(cell: Cell | null): void {
    if (!cell) {
      this.visible = false;
      return;
    }

    this.visible = true;
    const tex = texture(cell.symbol);
    this.sprite.texture = tex;
    this.glow.texture = tex;

    const fit = symbolFit(tex);
    this.sprite.scale.set(fit);
    this.glow.scale.set(fit * 1.08);

    // Номинал подписываем на любой монете: в текстурах чисел нет.
    const isCoin = cell.symbol === 'coin_silver' || cell.symbol === 'coin_gold';
    this.setValue(isCoin ? (cell.value ?? null) : null, coinValueVariant(cell.symbol));
  }

  /** Показать сумму на монете; `null` — убрать. */
  setValue(value: number | null, variant: ValueVariant = 'silver'): void {
    if (value === null) {
      this.value.visible = false;
      return;
    }

    this.value.style = VALUE_STYLES[variant];
    this.value.alpha = 1;
    this.value.text = formatCoin(value);
    this.value.visible = true;
    this.value.scale.set(1);
  }

  hideValue(): void {
    this.value.visible = false;
  }

  /** Плавно убрать номинал — сумма на коллекторе, когда её забрал экран выигрыша. */
  async fadeOutValue(duration: number): Promise<void> {
    if (!this.value.visible) return;
    await tweens.to(this.value, { alpha: 0 }, { duration });
    this.value.visible = false;
    this.value.alpha = 1;
  }

  /** Толчок суммы на коллекторе, когда прилетела очередная цифра. */
  async punchValue(): Promise<void> {
    await tweens.animate({
      duration: 200,
      ease: easeOutQuad,
      onUpdate: (t) => this.value.scale.set(1 + Math.sin(t * Math.PI) * 0.22),
    });
    this.value.scale.set(1);
  }

  /** Пульсация свечения у выигравших символов. */
  update(dt: number): void {
    if (!this.winning) return;
    this.elapsed += dt;
    const pulse = 0.5 + Math.sin(this.elapsed / 180) * 0.5;
    this.setGlow(0.45 + pulse * 0.55);
    const scale = 1 + pulse * 0.06;
    this.scale.set(scale);
  }

  setWinning(active: boolean): void {
    if (this.winning === active) return;
    this.winning = active;
    this.elapsed = 0;

    if (!active) {
      this.setGlow(0);
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
    await tweens.animate({
      duration: TIMINGS.symbolExplodeMs,
      delay,
      ease: easeInBack,
      onUpdate: (t) => {
        this.scale.set(1 + t * 0.55);
        this.alpha = 1 - t;
      },
    });
  }

  /**
   * «Приземление» особого символа (скаттера): иконка пружинно подпрыгивает
   * и вспыхивает свечением, которое затем плавно гаснет.
   */
  async celebrate(): Promise<void> {
    if (this.winning) return;

    await tweens.animate({
      duration: 700,
      onUpdate: (t) => {
        // Быстрый подскок в первой трети, затем пружинный возврат.
        const bump = t < 0.3 ? easeOutQuad(t / 0.3) : 1 - easeOutBack(2)((t - 0.3) / 0.7);
        this.scale.set(1 + bump * 0.22);
        this.setGlow(t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
      },
    });

    this.scale.set(1);
    this.setGlow(0);
  }

  /** Пружинное появление — превращение в wild. */
  async pop(): Promise<void> {
    this.alpha = 1;
    await tweens.animate({
      duration: 320,
      ease: easeOutBack(2.2),
      onUpdate: (t) => this.scale.set(0.3 + t * 0.7),
    });
    this.scale.set(1);
  }

  /** Приземление после падения: лёгкое сплющивание. */
  async squash(): Promise<void> {
    await tweens.animate({
      duration: 140,
      ease: easeOutQuad,
      onUpdate: (t) => {
        const k = Math.sin(t * Math.PI) * 0.12;
        this.scale.set(1 + k, 1 - k);
      },
    });
    this.scale.set(1);
  }

  /** Невидимое свечение не гоняем через размытие. */
  private setGlow(alpha: number): void {
    this.glow.alpha = alpha;
    this.glow.visible = alpha > 0;
  }

  reset(): void {
    this.alpha = 1;
    this.scale.set(1);
    this.setGlow(0);
    this.winning = false;
  }
}
