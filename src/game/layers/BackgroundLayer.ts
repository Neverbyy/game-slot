/** Фон: Олимп в облаках, медленный параллакс, затемнение в режиме фриспинов. */

import { Container, Graphics, Sprite } from 'pixi.js';

import { BACKGROUND_SHIFT_Y, DESIGN } from '@/config/layout.config';
import { texture } from '@/game/core/AssetLoader';
import { tweens } from '@/game/core/Tween';
import { visibleRect, type ViewportInfo } from '@/game/core/Layout';
import type { GameMode } from '@/api/types';

export class BackgroundLayer extends Container {
  private readonly image = Sprite.from(texture('background'));
  private readonly veil = new Graphics();
  private elapsed = 0;
  private baseScale = 1;

  constructor() {
    super();
    this.eventMode = 'none';

    this.image.anchor.set(0.5);
    this.veil.alpha = 0;
    this.addChild(this.image, this.veil);
  }

  update(dt: number): void {
    this.elapsed += dt;
    // Едва заметный дрейф — «дышащие» облака.
    const drift = Math.sin(this.elapsed / 7000) * 14;
    this.image.x = DESIGN.width / 2 + drift;
    this.image.y = DESIGN.height / 2 + BACKGROUND_SHIFT_Y + Math.cos(this.elapsed / 9000) * 8;
    this.image.scale.set(this.baseScale * (1 + Math.sin(this.elapsed / 11000) * 0.004));
  }

  resize(viewport: ViewportInfo): void {
    const { worldWidth, worldHeight } = viewport;

    // Фон заполняет видимую область целиком (cover), с небольшим запасом
    // под параллакс. Картинка поднята (храм не прячется под панелью), поэтому
    // по высоте она должна перекрывать экран с учётом сдвига, иначе снизу
    // откроется полоса.
    const source = this.image.texture;
    const coverHeight = worldHeight + Math.abs(BACKGROUND_SHIFT_Y) * 2;
    this.baseScale = Math.max(worldWidth / source.width, coverHeight / source.height) * 1.04;
    this.image.scale.set(this.baseScale);

    const { x, y, width, height } = visibleRect(viewport);
    this.veil.clear().rect(x, y, width, height).fill({ color: 0x050a1c });
  }

  /** Фриспины идут на затемнённом «грозовом» фоне. */
  setMode(mode: GameMode, duration = 600): Promise<void> {
    return tweens.to(this.veil, { alpha: mode === 'free' ? 0.55 : 0 }, { duration });
  }
}
