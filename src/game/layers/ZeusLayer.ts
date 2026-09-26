/**
 * Зевс.
 *
 * Спрайт один, поэтому «оживление» целиком процедурное: парение, дыхание,
 * микро-наклон, пульсирующая аура и молнии из ладоней. Руки двигаются
 * деформацией меша — см. `ZeusRig`. Всё остальное завязано на `power` —
 * уровень «заряда», который поднимается на спине и ударе.
 */

import { BlurFilter, Container } from 'pixi.js';

import { DESIGN, ZEUS } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { texture } from '@/game/core/AssetLoader';
import {
  easeInOutCubic,
  easeInQuad,
  easeOutCubic,
  easeOutQuad,
  type EasingFn,
} from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { randomRange } from '@/utils/math';
import { ZeusRig } from './ZeusRig';
import type { LightningLayer, Point } from '@/game/fx/LightningFx';

/** Положение ладоней в нормализованных координатах текстуры. */
const HAND_LEFT = { x: 0.11, y: 0.385 };
const HAND_RIGHT = { x: 0.9, y: 0.275 };

export class ZeusLayer extends Container {
  private readonly holder = new Container();
  private readonly rig: ZeusRig;

  private elapsed = 0;
  private sparkTimer = 0;
  /** Уровень заряда 0..1: яркость ауры и частота искр. */
  private power = 0;
  /** Подъём над точкой парения — на призыве Зевс приподнимается. */
  private lift = 0;

  constructor(private readonly lightning: LightningLayer) {
    super();
    this.eventMode = 'none';

    this.rig = new ZeusRig(texture('zeus'), ZEUS.height);
    this.rig.glow.filters = [new BlurFilter({ strength: 18, quality: 2 })];

    this.holder.addChild(this.rig);
    this.addChild(this.holder);

    this.x = ZEUS.centerX;
    this.y = ZEUS.centerY;
  }

  update(dt: number): void {
    this.elapsed += dt;

    // Парение, дыхание, микро-наклон.
    const float = Math.sin(this.elapsed / 1700) * 12;
    const breathe = 1 + Math.sin(this.elapsed / 2300) * 0.014;
    const tilt = Math.sin(this.elapsed / 3100) * 0.012;

    this.holder.y = float + this.lift;
    this.holder.rotation = tilt;
    this.rig.scale.set(breathe);
    this.rig.update(this.elapsed);

    // Аура тем ярче, чем выше заряд; на заряде же ткань рвёт сильнее.
    const pulse = 0.5 + Math.sin(this.elapsed / 420) * 0.5;
    this.rig.setGlowAlpha(0.12 + this.power * (0.25 + pulse * 0.35));
    this.rig.setBrightness(1 + this.power * 0.18);
    this.rig.setWind(this.power);

    this.emitSparks(dt);
  }

  /** Плавно поднять/опустить уровень заряда. */
  setPower(value: number, duration = 300): Promise<void> {
    return tweenValue(
      () => this.power,
      (next) => (this.power = next),
      value,
      duration,
      easeOutQuad,
    );
  }

  /** Подъём над точкой парения (отрицательное значение — вверх). */
  private setLift(value: number, duration: number): Promise<void> {
    return tweenValue(
      () => this.lift,
      (next) => (this.lift = next),
      value,
      duration,
      easeOutCubic,
    );
  }

  /** Поднять (1) или опустить (0) руки. */
  raiseArms(value: number, duration: number, ease = easeOutCubic): Promise<void> {
    return tweenValue(
      () => this.rig.raiseValue,
      (next) => this.rig.setRaise(next),
      value,
      duration,
      ease,
    );
  }

  /** Замах перед ударом молнии — вполовину слабее, чем призыв грозы. */
  async charge(duration: number = TIMINGS.lightningChargeMs): Promise<void> {
    await Promise.all([
      this.setPower(1, duration * 0.8),
      this.raiseArms(0.3, duration),
      tweens.to(this.holder.scale, { x: 1.06, y: 1.06 }, { duration, ease: easeOutCubic }),
    ]);
  }

  /**
   * Призыв грозы перед ударом кулака: замах вниз, затем руки неспешно идут
   * вверх, и в поднятые ладони с неба бьют разряды.
   */
  async summon(factor = 1): Promise<void> {
    const duration = TIMINGS.slamChargeMs * factor;
    void this.setPower(1, duration * 0.6);

    // Короткое движение вниз — чтобы взмах читался как размах, а не рывок.
    await this.raiseArms(-0.12, duration * 0.22, easeOutQuad);

    await Promise.all([
      this.raiseArms(1, duration * 0.78, easeInOutCubic),
      this.setLift(-30, duration),
      tweens.to(this.holder.scale, { x: 1.1, y: 1.1 }, { duration, ease: easeOutCubic }),
    ]);

    await this.callDownThunder();
    await tweens.delay(TIMINGS.slamPeakHoldMs * factor);
  }

  /** Резкий взмах вниз — момент броска. */
  async throwDown(): Promise<void> {
    await this.raiseArms(0.1, 180, easeInQuad);
    void tweens.to(this.holder.scale, { x: 1, y: 1 }, { duration: 260, ease: easeOutCubic });
  }

  /** Удары по точкам сцены. Между ударами — короткая пауза. */
  async strikeAt(points: readonly Point[], turbo = false): Promise<void> {
    const factor = turbo ? TIMINGS.turboFactor : 1;

    for (const point of points) {
      const hand = this.handPoint(HAND_LEFT);
      void this.lightning.strike(hand, point, {
        life: TIMINGS.lightningStrikeMs * 1.6,
        width: 7,
        branches: 3,
        roughness: 0.26,
      });
      await tweens.delay(TIMINGS.lightningBetweenMs * factor);
    }
  }

  /** Возврат в спокойное состояние. */
  async relax(): Promise<void> {
    await Promise.all([
      this.setPower(0, 420),
      this.raiseArms(0, 520),
      this.setLift(0, 420),
      tweens.to(this.holder.scale, { x: 1, y: 1 }, { duration: 320, ease: easeOutCubic }),
    ]);
  }

  /** Точка ладони в координатах сцены — с учётом того, как рука изогнута. */
  handPoint(normalized: { x: number; y: number } = HAND_LEFT): Point {
    const local = this.rig.deformPoint(normalized.x, normalized.y);
    const scale = this.rig.scale.x;

    return {
      x: this.x + (this.holder.x + local.x * scale) * this.scale.x,
      y: this.y + (this.holder.y + local.y * scale) * this.scale.y,
    };
  }

  /** Разряды с неба в обе ладони. */
  private async callDownThunder(): Promise<void> {
    const hands = [this.handPoint(HAND_LEFT), this.handPoint(HAND_RIGHT)];

    for (const hand of hands) {
      void this.lightning.strike(
        { x: hand.x + randomRange(-90, 90), y: -DESIGN.height * 0.25 },
        hand,
        { life: 420, width: 9, branches: 4, roughness: 0.2 },
      );
    }

    await tweens.delay(140);

    for (const hand of hands) {
      void this.lightning.spark(hand, 150, { width: 5, life: 320, branches: 3 });
    }
  }

  /** Случайные искры в ладонях: чем выше заряд, тем чаще. */
  private emitSparks(dt: number): void {
    this.sparkTimer -= dt;
    if (this.sparkTimer > 0) return;

    this.sparkTimer = randomRange(90, 260) * (1.6 - this.power);

    const hand = Math.random() < 0.5 ? HAND_LEFT : HAND_RIGHT;
    void this.lightning.spark(this.handPoint(hand), 40 + this.power * 90, {
      width: 2 + this.power * 2.5,
      life: 180 + this.power * 120,
    });
  }
}

/**
 * Твин числа от его значения в первом кадре анимации до 	o. Стартовое
 * значение читается не при вызове, а в первом кадре — к этому моменту
 * предыдущая анимация того же значения уже могла его сдвинуть.
 */
function tweenValue(
  get: () => number,
  set: (value: number) => void,
  to: number,
  duration: number,
  ease: EasingFn,
): Promise<void> {
  let start: number | null = null;

  return tweens.animate({
    duration,
    ease,
    onUpdate: (t) => {
      start ??= get();
      set(start + (to - start) * t);
    },
  });
}
