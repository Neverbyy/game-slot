/**
 * Экран крупного выигрыша.
 *
 * Поле затемняется, по центру считается сумма, а на порогах ×40 / ×80 / ×150 /
 * ×250 появляется соответствующий баннер (BIG → MEGA → SUPER MEGA → EPIC).
 * Баннеры нарисованы вместе с Зевсом, поэтому боковой Зевс просто уходит
 * под вуаль — весь оверлей лежит слоем выше него.
 */

import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';

import { DESIGN, LANDSCAPE } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { BIG_WIN_TIERS, type BigWinTierId } from '@/config/symbols.config';
import { texture } from '@/game/core/AssetLoader';
import { easeOutBack, easeOutCubic, flashCurve } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { gameBus } from '@/game/events';
import { LightningLayer } from '@/game/fx/LightningFx';
import { skyBolt, type SkyBoltKind } from '@/game/fx/SkyBolt';
import { sound } from '@/game/core/SoundManager';
import type { SoundId } from '@/config/sounds.config';
import { formatAmount } from '@/utils/format';
import { randomRange } from '@/utils/math';
import { DISPLAY_FONT, GOLD_FILL } from '@/game/core/textStyles';
import type { Rect, ViewportInfo } from '@/game/core/Layout';

const BANNER_WIDTH = 780;
/** Баннер чуть выше центра поля. */
const BANNER_OFFSET_Y = -110;
/** Пока баннера нет, счётчик стоит по центру поля; с баннером — уходит ниже. */
const AMOUNT_OFFSET_WITH_BANNER = 140;

/** Где по ширине видимой области бьют молнии (доли ширины). */
const LEFT_ZONE = [0.04, 0.3] as const;
const RIGHT_ZONE = [0.7, 0.96] as const;
const CENTER_ZONE = [0.32, 0.68] as const;

interface ThunderPlan {
  /** Сколько молний каждого вида с каждой стороны. */
  bolts: readonly (readonly [SkyBoltKind, number])[];
  /** Дополнительные одиночные разряды по центру, за баннером. */
  center: number;
  /** Разброс моментов удара, мс — на старших тирах получается шквал. */
  spreadMs: number;
  /** Вспышки экрана подряд: [яркость 0..1, длительность мс]. */
  flashes: readonly (readonly [number, number])[];
}

/** Смех Зевса для каждого тира. */
const TIER_LAUGH: Record<BigWinTierId, SoundId> = {
  big: 'laugh_big',
  mega: 'laugh_mega',
  super: 'laugh_super',
  epic: 'laugh_epic',
};

/** Нарастание по тирам: BIG → MEGA → SUPER → EPIC. */
const THUNDER_PLAN: readonly ThunderPlan[] = [
  // BIG — по одному одиночному разряду с каждой стороны.
  {
    bolts: [['single', 1]],
    center: 0,
    spreadMs: 80,
    flashes: [
      [0.22, 200],
      [0.1, 160],
    ],
  },
  // MEGA — по два одиночных с каждой стороны.
  {
    bolts: [['single', 2]],
    center: 0,
    spreadMs: 200,
    flashes: [
      [0.35, 200],
      [0.15, 160],
    ],
  },
  // SUPER — полный веерный удар плюс одиночные.
  {
    bolts: [
      ['full', 1],
      ['single', 2],
    ],
    center: 0,
    spreadMs: 260,
    flashes: [
      [0.55, 220],
      [0.25, 160],
    ],
  },
  // EPIC — всё, что есть: веера, двойные, одиночные, в том числе за баннером,
  // и серия вспышек почти добела — игрок должен ослепнуть от куша.
  {
    bolts: [
      ['full', 2],
      ['double', 1],
      ['single', 3],
    ],
    center: 3,
    spreadMs: 520,
    flashes: [
      [0.95, 520],
      [0.45, 140],
      [0.8, 260],
      [0.35, 140],
      [0.6, 320],
    ],
  },
];

export class BigWinOverlay extends Container {
  private readonly veil = new Graphics();
  private readonly rays = new Graphics();
  private readonly banner = new Sprite();
  private readonly amount: Text;
  /** Свои молнии: бьют по краям экрана на каждой смене баннера. */
  private readonly lightning = new LightningLayer();
  /** Белая вспышка поверх всего — «удар грома». */
  private readonly flash = new Graphics();

  private active = false;
  /** Видимая область — нужна, чтобы молнии били от самого верха экрана. */
  private area: Rect = { x: 0, y: 0, width: DESIGN.width, height: DESIGN.height };
  /** Центр поля в текущей раскладке — от него строится весь экран. */
  private center = { x: LANDSCAPE.field.centerX, y: LANDSCAPE.field.centerY };

  constructor() {
    super();
    this.eventMode = 'none';
    this.visible = false;

    this.drawRays();

    this.banner.anchor.set(0.5);
    this.banner.visible = false;

    this.amount = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: DISPLAY_FONT,
        fontSize: 110,
        fontWeight: '900',
        fill: GOLD_FILL,
        stroke: { color: 0x2a1602, width: 14, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.6, blur: 12, distance: 6, angle: Math.PI / 2 },
      }),
    });
    this.amount.anchor.set(0.5);

    this.flash.blendMode = 'add';
    this.flash.alpha = 0;

    this.addChild(this.veil, this.rays, this.lightning, this.banner, this.amount, this.flash);
  }

  get isActive(): boolean {
    return this.active;
  }

  resize(viewport: ViewportInfo): void {
    this.area = viewport.visible;
    const { x, y, width, height } = this.area;

    const { field } = viewport.layout;
    this.center = { x: field.centerX, y: field.centerY };
    this.rays.position.set(field.centerX, field.centerY);
    this.banner.position.set(field.centerX, field.centerY + BANNER_OFFSET_Y);
    this.amount.position.set(
      field.centerX,
      field.centerY + (this.banner.visible ? AMOUNT_OFFSET_WITH_BANNER : 0),
    );

    this.veil.clear().rect(x, y, width, height).fill({ color: 0x03060f });
    this.flash.clear().rect(x, y, width, height).fill({ color: 0xe6f6ff });
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
    this.amount.position.set(this.center.x, this.center.y);

    gameBus.emit('bigwin:start', { tier: finalTier ?? 'big', amount });

    await Promise.all([
      tweens.to(this.veil, { alpha: 0.84 }, { duration: TIMINGS.bigWinIntroMs * factor }),
      tweens.to(this.rays, { alpha: 0.45 }, { duration: TIMINGS.bigWinIntroMs * factor }),
    ]);

    await this.rollUp(amount, bet, factor);
    await tweens.delay(TIMINGS.bigWinHoldMs * factor);

    const outro = TIMINGS.bigWinOutroMs * factor;
    // Экран уходит — смех не должен тянуться за ним в следующий спин.
    sound.stopChannel('voice', (outro + 200) / 1000);
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

    // Звон монет крутится по кругу, пока растёт сумма.
    sound.play('coin_counter', { channel: 'counter' });

    await tweens.animate({
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
    });

    // Сумма досчитана — звон гаснет.
    sound.stopChannel('counter', 0.2);

    this.amount.text = formatAmount(amount);
    this.amount.scale.set(1);
  }

  /** Смена баннера: пружинное появление и толчок счётчика вниз. */
  private async raiseBanner(tier: BigWinTierId, factor: number): Promise<void> {
    const tierIndex = BIG_WIN_TIERS.findIndex((item) => item.id === tier);
    const entry = BIG_WIN_TIERS[tierIndex];
    if (!entry) return;

    const tex = texture(entry.texture);
    const base = BANNER_WIDTH / (tex.width || 1);
    this.banner.texture = tex;
    this.banner.scale.set(base);
    this.banner.visible = true;

    // Каждый новый тир входит с ударом грома; чем выше тир — тем больше молний.
    void this.thunder(tierIndex, factor);
    this.playTierSound(tier);

    void tweens.to(
      this.amount.position,
      { y: this.center.y + AMOUNT_OFFSET_WITH_BANNER },
      { duration: 260 * factor, ease: easeOutCubic },
    );

    await tweens.animate({
      duration: 420 * factor,
      ease: easeOutBack(2.2),
      onUpdate: (t) => {
        this.banner.scale.set(base * (0.55 + t * 0.45));
        this.banner.alpha = Math.min(t * 2, 1);
      },
    });

    this.banner.scale.set(base);
  }

  /**
   * Удар грома на смене баннера. С каждым тиром молний больше и вспышка
   * ярче: BIG — пара одиночных разрядов, MEGA — четыре, SUPER — полные
   * веерные удары, EPIC — всё сразу по всему экрану и ослепляющая вспышка.
   */
  private async thunder(tierIndex: number, factor: number): Promise<void> {
    const plan = THUNDER_PLAN[Math.min(Math.max(tierIndex, 0), THUNDER_PLAN.length - 1)];
    if (!plan) return;

    const { x: left, y: top, width } = this.area;
    const height = this.area.height * 0.97;

    // Слева разряды отражены, чтобы уходили к краю экрана, справа — как есть.
    const strike = (kind: SkyBoltKind, zone: readonly [number, number], mirror: boolean) => {
      const x = left + width * randomRange(zone[0], zone[1]);
      void skyBolt(this.lightning, x, top, height, {
        kind,
        mirror,
        factor,
        delay: randomRange(0, plan.spreadMs),
      });
    };

    for (const [kind, perSide] of plan.bolts) {
      for (let i = 0; i < perSide; i++) {
        strike(kind, LEFT_ZONE, true);
        strike(kind, RIGHT_ZONE, false);
      }
    }

    // На EPIC бьёт и за баннером — молнии уже по всему экрану.
    for (let i = 0; i < plan.center; i++) {
      strike('single', CENTER_ZONE, Math.random() < 0.5);
    }

    for (const [intensity, duration] of plan.flashes) {
      await this.flashOnce(intensity, duration * factor);
    }
  }

  /**
   * Смех Зевса своего тира и раскат грома под него. Смех идёт по отдельному
   * каналу: новый тир плавно глушит смех предыдущего, чтобы они не
   * накладывались. На EPIC гром звучит дважды — обоими раскатами.
   */
  private playTierSound(tier: BigWinTierId): void {
    // Пока Зевс смеётся, фоновая музыка приглушена.
    sound.play(TIER_LAUGH[tier], { channel: 'voice', duck: true });

    const thunder: SoundId = Math.random() < 0.5 ? 'thunder_1' : 'thunder_2';
    sound.play(thunder);
    if (tier === 'epic') {
      sound.play(thunder === 'thunder_1' ? 'thunder_2' : 'thunder_1', { delay: 0.45 });
    }
  }

  private flashOnce(intensity: number, duration: number): Promise<void> {
    return tweens
      .animate({
        duration,
        ease: flashCurve,
        onUpdate: (t) => {
          this.flash.alpha = t * intensity;
        },
      })
      .then(() => {
        this.flash.alpha = 0;
      });
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
