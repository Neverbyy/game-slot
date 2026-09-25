/**
 * Рамка игрового поля с боковыми трезубцами — процедурная замена текстуры.
 * Геометрия повторяет пропорции оригинала: широкий кремовый бортик,
 * тёмная подложка поля и серебристые трезубцы по бокам.
 */

import { Container, FillGradient, Graphics } from 'pixi.js';

import { FIELD, FRAME_PADDING } from '@/config/layout.config';

export class FrameLayer extends Container {
  constructor() {
    super();
    this.eventMode = 'none';

    const w = FIELD.width;
    const h = FIELD.height;
    const pad = FRAME_PADDING;

    const bezel = new Graphics()
      .roundRect(-pad, -pad, w + pad * 2, h + pad * 2, 20)
      .fill(
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

    this.addChild(bezel, highlight, innerShadow);

    const tridentHeight = h * 0.78;
    this.addChild(
      trident(-pad - 54, h / 2 + tridentHeight / 2, tridentHeight, 1),
      trident(w + pad + 54, h / 2 + tridentHeight / 2, tridentHeight, -1),
    );

    // Рамка рисуется от левого верхнего угла поля.
    this.x = FIELD.centerX - w / 2;
    this.y = FIELD.centerY - h / 2;
  }
}

/** Стилизованный трезубец остриями вверх. */
function trident(x: number, y: number, height: number, flip: 1 | -1): Graphics {
  const g = new Graphics();
  const shaftWidth = height * 0.022;
  const barY = -height * 0.52;
  const barHalf = height * 0.1;
  const tipY = -height;

  // Древко.
  g.roundRect(-shaftWidth, barY, shaftWidth * 2, -barY, shaftWidth);

  // Перекладина.
  g.roundRect(-barHalf, barY - shaftWidth, barHalf * 2, shaftWidth * 2, shaftWidth);

  // Центральный зубец.
  g.moveTo(-shaftWidth * 1.4, barY)
    .lineTo(0, tipY)
    .lineTo(shaftWidth * 1.4, barY)
    .closePath();

  // Боковые зубцы — дуги от концов перекладины вверх.
  for (const side of [-1, 1]) {
    g.moveTo(side * barHalf, barY);
    g.quadraticCurveTo(side * barHalf * 1.25, barY * 1.45, side * barHalf * 0.55, tipY * 0.92);
    g.lineTo(side * barHalf * 0.34, tipY * 0.9);
    g.quadraticCurveTo(side * barHalf * 0.95, barY * 1.4, side * (barHalf - shaftWidth * 2), barY);
    g.closePath();
  }

  g.fill(
    new FillGradient({
      type: 'linear',
      start: { x: 0, y: 0 },
      end: { x: 1, y: 0 },
      colorStops: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.45, color: '#e3e8f0' },
        { offset: 1, color: '#a9b4c6' },
      ],
    }),
  );

  g.x = x;
  g.y = y;
  g.scale.x = flip;
  return g;
}
