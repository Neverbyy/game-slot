/**
 * Экран крупного выигрыша.
 *
 * Поле затемняется, по центру считается сумма, а на порогах ×25 / ×50 / ×100 /
 * ×250 появляется соответствующий баннер (BIG → MEGA → SUPER MEGA → EPIC).
 * Баннеры нарисованы вместе с Зевсом, поэтому боковой Зевс просто уходит
 * под вуаль — весь оверлей лежит слоем выше него.
 */

import { Container, FillGradient, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

import { DESIGN, FIELD } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { BIG_WIN_TIERS, type BigWinTierId } from '@/config/symbols.config';
import { texture } from '@/game/core/AssetLoader';
import { easeOutBack, easeOutCubic } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { gameBus } from '@/game/events';
import { formatAmount } from '@/utils/format';
import type { ViewportInfo } from '@/game/core/Layout';

const BANNER_WIDTH = 780;
const BANNER_Y = FIELD.centerY - 110;
/** Пока баннера нет, счётчик стоит по центру поля; с баннером — уходит ниже. */
const AMOUNT_Y_SOLO = FIELD.centerY;
const AMOUNT_Y_WITH_BANNER = FIELD.centerY + 140;

const goldFill = new FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: '#fffbe0' },
    { offset: 0.4, color: '#ffd035' },
    { offset: 0.75, color: '#f59a12' },
    { offset: 1, color: '#c96a05' },
  ],
});

export class BigWinOverlay extends Container {
  private readonly veil = new Graphics();
  private readonly rays = new Graphics();
  private readonly banner = new Sprite();
  private readonly amount: Text;

  private active = false;

  constructor() {
    super();
    this.eventMode = 'none';
    this.visible = false;

    this.rays.position.set(DESIGN.width / 2, FIELD.centerY);
    this.drawRays();

    this.banner.anchor.set(0.5);
    this.banner.position.set(DESIGN.width / 2, BANNER_Y);
    this.banner.visible = false;

    this.amount = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: 110,
        fontWeight: '900',
        fill: goldFill,
        stroke: { color: 0x2a1602, width: 14, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 12, distance: 6, angle: Math.PI / 2 },
      }),
    });
    this.amount.anchor.set(0.5);

    this.addChild(this.veil, this.rays, this.banner, this.amount);
  }

  get isActive(): boolean {
    return this.active;
  }

  resize(viewport: ViewportInfo): void {
    const { worldWidth, worldHeight } = viewport;
    this.veil
      .clear()
      .rect(
        DESIGN.width / 2 - worldWidth / 2,
        DESIGN.height / 2 - worldHeight / 2,
        worldWidth,
        worldHeight,
      )
      .fill({ color: 0x03060f });
  }

  update(dt: number): void {
    if (!this.active) return;
    this.rays.rotation += dt / 9000;
  }

  /** Тир по отношению выигрыша к ставке. */
  static tierFor(amount: number, bet: number): BigWinTierId | null {
    if (bet <= 0) return null;
    const ratio = amount / bet;
    let tier: BigWinTierId | null = null;
    for (const entry of BIG_WIN_TIERS) {
      if (ratio >= entry.threshold) tier = entry.id;
    }
    return tier;
  }

  /**
   * @param force показывать счётчик даже если выигрыш не дотянул до первого
   *              тира — так ведёт себя удар кулака.
   */
  async show(amount: number, bet: number, factor = 1, force = false): Promise<void> {
    const finalTier = BigWinOverlay.tierFor(amount, bet);
    if (!finalTier && !force) return;

    this.active = true;
    this.visible = true;
    this.veil.alpha = 0;
    this.rays.alpha = 0;
    this.banner.visible = false;
    this.amount.alpha = 1;
    this.amount.text = formatAmount(0);
    this.amount.position.set(DESIGN.width / 2, AMOUNT_Y_SOLO);

    gameBus.emit('bigwin:start', { tier: finalTier ?? 'big', amount });

    await Promise.all([
      tweens.to(this.veil, { alpha: 0.84 }, { duration: TIMINGS.bigWinIntroMs * factor }),
      tweens.to(this.rays, { alpha: 0.45 }, { duration: TIMINGS.bigWinIntroMs * factor }),
    ]);

    await this.rollUp(amount, bet, factor);
    await tweens.delay(TIMINGS.bigWinHoldMs * factor);

    const outro = TIMINGS.bigWinOutroMs * factor;
    await Promise.all([
      tweens.to(this.veil, { alpha: 0 }, { duration: outro }),
      tweens.to(this.rays, { alpha: 0 }, { duration: outro }),
      tweens.to(this.banner, { alpha: 0 }, { duration: outro }),
      tweens.to(this.amount, { alpha: 0 }, { duration: outro }),
    ]);

    this.active = false;
    this.visible = false;
    this.banner.alpha = 1;
    gameBus.emit('bigwin:end', undefined);
  }

  /**
   * Раскрутка счётчика.
   *
   * Один непрерывный проход с равномерной скоростью: easeOut скидывал большую
   * часть суммы за первые доли секунды, и цифры читались как мельтешение.
   * Баннер поднимается прямо на ходу, счёт при этом не останавливается —
   * чем больше тиров пройдено, тем дольше идёт счёт.
   */
  private async rollUp(amount: number, bet: number, factor: number): Promise<void> {
    const crossed = BIG_WIN_TIERS.filter((tier) => amount >= tier.threshold * bet).length;
    const duration =
      (TIMINGS.bigWinCountBaseMs + TIMINGS.bigWinCountPerTierMs * Math.max(crossed, 1)) * factor;

    let shown: BigWinTierId | null = null;

    await tweens.animate(
      {
        duration,
        onUpdate: (t) => {
          const current = Math.round(amount * t);
          this.amount.text = formatAmount(current);

          const tier = BigWinOverlay.tierFor(current, bet);
          if (tier && tier !== shown) {
            shown = tier;
            // Намеренно без await: счётчик продолжает крутиться под баннером.
            void this.raiseBanner(tier, factor);
          }

          this.amount.scale.set(1 + Math.sin(t * 14) * 0.012);
        },
      },
      this.amount,
    );

    this.amount.text = formatAmount(amount);
    this.amount.scale.set(1);
  }

  /** Смена баннера: пружинное появление и толчок счётчика вниз. */
  private async raiseBanner(tier: BigWinTierId, factor: number): Promise<void> {
    const entry = BIG_WIN_TIERS.find((item) => item.id === tier);
    if (!entry) return;

    const tex = texture(entry.texture);
    this.banner.texture = tex;
    this.banner.scale.set(BANNER_WIDTH / (tex.width || 1));
    this.banner.visible = true;

    const base = BANNER_WIDTH / (tex.width || 1);

    void tweens.to(
      this.amount.position,
      { y: AMOUNT_Y_WITH_BANNER },
      { duration: 260 * factor, ease: easeOutCubic },
    );

    await tweens.animate(
      {
        duration: 420 * factor,
        ease: easeOutBack(2.2),
        onUpdate: (t) => {
          this.banner.scale.set(base * (0.55 + t * 0.45));
          this.banner.alpha = Math.min(t * 2, 1);
        },
      },
      this.banner,
    );

    this.banner.scale.set(base);
  }

  private drawRays(): void {
    const count = 16;
    const radius = 1400;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spread = Math.PI / count / 1.6;

      this.rays
        .moveTo(0, 0)
        .lineTo(Math.cos(angle - spread) * radius, Math.sin(angle - spread) * radius)
        .lineTo(Math.cos(angle + spread) * radius, Math.sin(angle + spread) * radius)
        .closePath()
        .fill({ color: 0xffd447, alpha: 0.18 });
    }

    this.rays.blendMode = 'add';
  }
}
