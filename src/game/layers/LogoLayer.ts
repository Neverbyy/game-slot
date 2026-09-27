/** Логотип: лёгкое покачивание и пульсация свечения. */

import { BlurFilter, Container, Sprite } from 'pixi.js';

import type { SceneLayout } from '@/config/layout.config';
import { texture } from '@/game/core/AssetLoader';

export class LogoLayer extends Container {
  private readonly image = Sprite.from(texture('logo'));
  private readonly glow = Sprite.from(texture('logo'));
  private elapsed = 0;

  constructor() {
    super();
    this.eventMode = 'none';

    this.image.anchor.set(0.5);
    this.glow.anchor.set(0.5);

    this.glow.blendMode = 'add';
    this.glow.alpha = 0.35;
    this.glow.filters = [new BlurFilter({ strength: 14, quality: 2 })];

    this.addChild(this.glow, this.image);
  }

  applyLayout({ logo }: SceneLayout): void {
    this.position.set(logo.centerX, logo.centerY);
    // Масштабируем сами спрайты, а не слой: покачивание задано в дизайн-пикселях.
    const scale = logo.width / (this.image.texture.width || 1);
    this.image.scale.set(scale);
    this.glow.scale.set(scale);
  }

  update(dt: number): void {
    this.elapsed += dt;
    const bob = Math.sin(this.elapsed / 1600) * 4;
    this.image.y = bob;
    this.glow.y = bob;
    this.glow.alpha = 0.28 + Math.sin(this.elapsed / 900) * 0.12;
  }
}
