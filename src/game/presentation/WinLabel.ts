/** Подпись выигрыша под полем — показывается во время серии каскадов. */

import { Container, FillGradient, Text, TextStyle } from 'pixi.js';

import type { SceneLayout } from '@/config/layout.config';
import { easeOutBack, easeOutQuad } from '@/game/core/Easing';
import { DISPLAY_FONT } from '@/game/core/textStyles';
import { tweens } from '@/game/core/Tween';
import { formatMoney } from '@/utils/format';

/** Своя, чуть более светлая золотая заливка — строка выигрыша мельче счётчика. */
const goldFill = new FillGradient({
  type: 'linear',
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
  colorStops: [
    { offset: 0, color: '#fff7cf' },
    { offset: 0.45, color: '#ffd447' },
    { offset: 1, color: '#e08b16' },
  ],
});

export class WinLabel extends Container {
  private readonly text: Text;

  constructor() {
    super();
    this.eventMode = 'none';

    this.text = new Text({
      text: '',
      style: new TextStyle({
        fontFamily: DISPLAY_FONT,
        fontSize: 54,
        fontWeight: '900',
        fill: goldFill,
        stroke: { color: 0x1b1205, width: 9, join: 'round' },
        dropShadow: { color: 0x000000, alpha: 0.5, blur: 6, distance: 4, angle: Math.PI / 2 },
        align: 'center',
      }),
    });
    this.text.anchor.set(0.5);

    this.addChild(this.text);
    this.visible = false;
  }

  /** Строка стоит под рамкой барабанов, по центру поля. */
  applyLayout(layout: SceneLayout): void {
    this.position.set(layout.field.centerX, layout.winLabelY);
  }

  async show(amount: number, multiplier = 1): Promise<void> {
    this.text.text =
      multiplier > 1 ? `${formatMoney(amount)}  ×${multiplier}` : formatMoney(amount);

    if (this.visible) {
      // Уже на экране — просто «щёлкаем» масштабом.
      await tweens.animate({
        duration: 220,
        ease: easeOutQuad,
        onUpdate: (t) => this.scale.set(1 + Math.sin(t * Math.PI) * 0.18),
      });
      this.scale.set(1);
      return;
    }

    this.visible = true;
    this.alpha = 1;
    await tweens.animate({
      duration: 260,
      ease: easeOutBack(2),
      onUpdate: (t) => this.scale.set(0.4 + t * 0.6),
    });
    this.scale.set(1);
  }

  async hide(): Promise<void> {
    if (!this.visible) return;
    await tweens.to(this, { alpha: 0 }, { duration: 200 });
    this.visible = false;
    this.scale.set(1);
  }
}
