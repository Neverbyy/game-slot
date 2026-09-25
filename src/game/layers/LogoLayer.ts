/** Логотип: лёгкое покачивание и пульсация свечения. */

import { BlurFilter, Container, Sprite } from 'pixi.js';

import { LOGO } from '@/config/layout.config';
import { texture } from '@/game/core/AssetLoader';

export class LogoLayer extends Container {
  private readonly image = Sprite.from(texture('logo'));
  private readonly glow = Sprite.from(texture('logo'));
  private elapsed = 0;

  constructor() {
    super();
    this.eventMode = 'none';

    for (const sprite of [this.glow, this.image]) {
      sprite.anchor.set(0.5);
      const scale = LOGO.width / (sprite.texture.width || 1);
      sprite.scale.set(scale);
    }

    this.glow.blendMode = 'add';
    this.glow.alpha = 0.35;
    this.glow.filters = [new BlurFilter({ strength: 14, quality: 2 })];

    this.x = LOGO.centerX;
    this.y = LOGO.centerY;

    this.addChild(this.glow, this.image);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const bob = Math.sin(this.elapsed / 1600) * 4;
    this.image.y = bob;
    this.glow.y = bob;
    this.glow.alpha = 0.28 + Math.sin(this.elapsed / 900) * 0.12;
  }
}
