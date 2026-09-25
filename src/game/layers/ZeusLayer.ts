/**
 * Зевс.
 *
 * Спрайт один, поэтому «оживление» целиком процедурное: парение, дыхание,
 * микро-наклон, пульсирующая аура и молнии из ладони. Все параметры завязаны
 * на `power` — уровень «заряда», который поднимается на спине и ударе.
 */

import { BlurFilter, ColorMatrixFilter, Container, Sprite } from 'pixi.js';

import { ZEUS } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
import { texture } from '@/game/core/AssetLoader';
import { easeOutCubic, easeOutQuad } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { randomRange } from '@/utils/math';
import type { LightningLayer, Point } from '@/game/fx/LightningFx';

/** Положение ладоней в нормализованных координатах текстуры. */
const HAND_LEFT = { x: 0.11, y: 0.385 };
const HAND_RIGHT = { x: 0.9, y: 0.275 };

export class ZeusLayer extends Container {
  private readonly holder = new Container();
  private readonly sprite = Sprite.from(texture('zeus'));
  private readonly glow = Sprite.from(texture('zeus'));
  private readonly colorMatrix = new ColorMatrixFilter();

  private elapsed = 0;
  private sparkTimer = 0;
  /** Уровень заряда 0..1: яркость ауры и частота искр. */
  private power = 0;
  private baseScale = 1;

  constructor(private readonly lightning: LightningLayer) {
    super();
    this.eventMode = 'none';

    this.baseScale = ZEUS.height / (this.sprite.texture.height || 1);

    for (const sprite of [this.glow, this.sprite]) {
      sprite.anchor.set(0.5);
      sprite.scale.set(this.baseScale);
    }

    this.glow.blendMode = 'add';
    this.glow.alpha = 0.18;
    this.glow.filters = [new BlurFilter({ strength: 18, quality: 2 })];

    this.sprite.filters = [this.colorMatrix];

    this.holder.addChild(this.glow, this.sprite);
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

    this.holder.y = float;
    this.holder.rotation = tilt;
    this.sprite.scale.set(this.baseScale * breathe);
    this.glow.scale.set(this.baseScale * breathe * 1.02);

    // Аура тем ярче, чем выше заряд.
    const pulse = 0.5 + Math.sin(this.elapsed / 420) * 0.5;
    this.glow.alpha = 0.12 + this.power * (0.25 + pulse * 0.35);
    this.colorMatrix.brightness(1 + this.power * 0.18, false);

    this.emitSparks(dt);
  }

  /** Плавно поднять/опустить уровень заряда. */
  setPower(value: number, duration = 300): Promise<void> {
    let start: number | null = null;

    return tweens.animate(
      {
        duration,
        ease: easeOutQuad,
        onUpdate: (t) => {
          start ??= this.power;
          this.power = start + (value - start) * t;
        },
      },
      this,
    );
  }

  /** Замах перед ударом. */
  async charge(duration: number = TIMINGS.lightningChargeMs): Promise<void> {
    await Promise.all([
      this.setPower(1, duration * 0.8),
      tweens.to(this.holder.scale, { x: 1.06, y: 1.06 }, { duration, ease: easeOutCubic }),
    ]);
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
      tweens.to(this.holder.scale, { x: 1, y: 1 }, { duration: 320, ease: easeOutCubic }),
    ]);
  }

  /** Точка ладони в координатах сцены. */
  handPoint(normalized: { x: number; y: number } = HAND_LEFT): Point {
    const width = this.sprite.width;
    const height = this.sprite.height;

    return {
      x: this.x + (this.holder.x + (normalized.x - 0.5) * width) * this.scale.x,
      y: this.y + (this.holder.y + (normalized.y - 0.5) * height) * this.scale.y,
    };
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
