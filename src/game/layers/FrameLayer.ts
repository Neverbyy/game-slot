/**
 * Рамка игрового поля с боковыми трезубцами.
 * Рамка процедурная: широкий кремовый бортик и тёмная подложка поля.
 * Трезубцы — картинка `lightning_pike.png`, стоят по бокам за рамкой.
 */

import { Container, FillGradient, Graphics, Sprite } from 'pixi.js';

import { FIELD, FRAME_PADDING, type SceneLayout } from '@/config/layout.config';
import { texture } from '@/game/core/AssetLoader';

/** Высота трезубца относительно высоты поля. */
const TRIDENT_HEIGHT = 0.92;

/** На сколько центр трезубца отстоит от внешнего края рамки. */
const TRIDENT_OFFSET = 88;

export class FrameLayer extends Container {
  private readonly tridents: Sprite[];

  constructor() {
    super();
    this.eventMode = 'none';

    const w = FIELD.width;
    const h = FIELD.height;
    const pad = FRAME_PADDING;

    const bezel = new Graphics().roundRect(-pad, -pad, w + pad * 2, h + pad * 2, 20).fill(
      new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: '#fdfaf0' },
          { offset: 0.5, color: '#efe6d2' },
          { offset: 1, color: '#cfc0a2' },
        ],
      }),
    );

    const innerShadow = new Graphics()
      .roundRect(-6, -6, w + 12, h + 12, 12)
      .fill({ color: 0x0a1226, alpha: 0.9 })
      .roundRect(-4, -4, w + 8, h + 8, 10)
      .stroke({ width: 3, color: 0x8fa8d8, alpha: 0.35 });

    const highlight = new Graphics()
      .roundRect(-pad + 5, -pad + 5, w + pad * 2 - 10, h + pad * 2 - 10, 16)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.6 });

    this.tridents = [
      trident(-pad - TRIDENT_OFFSET, h / 2, h * TRIDENT_HEIGHT),
      trident(w + pad + TRIDENT_OFFSET, h / 2, h * TRIDENT_HEIGHT),
    ];

    // Трезубцы идут первыми, чтобы рамка перекрывала их, как в оригинале.
    this.addChild(...this.tridents, bezel, highlight, innerShadow);
  }

  applyLayout(layout: SceneLayout): void {
    // Рамка рисуется от левого верхнего угла поля.
    this.x = layout.field.centerX - FIELD.width / 2;
    this.y = layout.field.centerY - FIELD.height / 2;
    for (const sprite of this.tridents) sprite.visible = layout.tridents;
  }
}

/** Трезубец с центром в (x, y). Картинка почти во всю свою высоту. */
function trident(x: number, y: number, height: number): Sprite {
  const sprite = new Sprite(texture('lightning_pike'));
  sprite.anchor.set(0.5);
  sprite.scale.set(height / (sprite.texture.height || 1));
  sprite.position.set(x, y);
  return sprite;
}
