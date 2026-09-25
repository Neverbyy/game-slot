/**
 * Подложка ячейки — рисуется процедурно, пока нет текстуры.
 * Светлый вариант — «облачная» плитка, тёмный — приглушённая ячейка
 * (используется для шахматного узора, как в оригинале).
 */

import { Container, FillGradient, Graphics } from 'pixi.js';

import { GRID } from '@/config/layout.config';

export type TileVariant = 'light' | 'dark';

const PALETTE: Record<TileVariant, { top: string; bottom: string; cloud: number; border: number }> =
  {
    light: { top: '#7fd4f7', bottom: '#3fa5e0', cloud: 0xffffff, border: 0xbfe9ff },
    dark: { top: '#33415f', bottom: '#1d2740', cloud: 0x8fb4ff, border: 0x4a5c85 },
  };

export function createCellTile(variant: TileVariant, seed = 0): Container {
  const { cellWidth: w, cellHeight: h } = GRID;
  const palette = PALETTE[variant];
  const holder = new Container();
  holder.eventMode = 'none';

  const base = new Graphics()
    .roundRect(0, 0, w, h, 10)
    .fill(
      new FillGradient({
        type: 'linear',
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: palette.top },
          { offset: 1, color: palette.bottom },
        ],
      }),
    );

  // «Облака»: несколько мягких пятен, детерминированных по индексу ячейки,
  // чтобы плитки не выглядели одинаковыми штампами.
  const clouds = new Graphics();
  for (let i = 0; i < 4; i++) {
    const n = pseudoRandom(seed * 7 + i * 13);
    const m = pseudoRandom(seed * 11 + i * 29);
    clouds
      .ellipse(w * (0.15 + n * 0.7), h * (0.15 + m * 0.7), w * (0.16 + n * 0.16), h * 0.12)
      .fill({ color: palette.cloud, alpha: variant === 'light' ? 0.22 : 0.07 });
  }
  clouds.mask = new Graphics().roundRect(0, 0, w, h, 10).fill(0xffffff);

  const border = new Graphics()
    .roundRect(1.5, 1.5, w - 3, h - 3, 9)
    .stroke({ width: 3, color: palette.border, alpha: variant === 'light' ? 0.55 : 0.4 });

  holder.addChild(base, clouds, clouds.mask as Graphics, border);
  return holder;
}

/** Детерминированный «шум» 0..1 без внешних зависимостей. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
