/** Ударная волна: расходящееся кольцо от точки удара. */

import { Container, Graphics } from 'pixi.js';

import { easeOutCubic } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';

export interface ShockwaveOptions {
  duration?: number;
  radius?: number;
  color?: number;
  thickness?: number;
}

export function shockwave(
  parent: Container,
  x: number,
  y: number,
  options: ShockwaveOptions = {},
): Promise<void> {
  const { duration = 520, radius = 620, color = 0x8fe3ff, thickness = 26 } = options;

  const ring = new Graphics();
  ring.blendMode = 'add';
  ring.position.set(x, y);
  parent.addChild(ring);

  return tweens
    .animate({
      duration,
      ease: easeOutCubic,
      onUpdate: (t) => {
        const r = radius * t;
        ring
          .clear()
          .circle(0, 0, r)
          .stroke({ width: thickness * (1 - t) + 3, color, alpha: (1 - t) * 0.85 })
          .circle(0, 0, r * 0.82)
          .stroke({ width: 4, color: 0xffffff, alpha: (1 - t) * 0.5 });
      },
    })
    .then(() => ring.destroy());
}
