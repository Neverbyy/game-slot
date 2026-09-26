/**
 * Молния с неба из готовых кадров.
 *
 * Кадры вырезаны из видео скриптом `scripts/key-lightning.ps1`:
 * - bolt_single_1/2 — одиночные разряды;
 * - bolt_1 — два разряда рядом;
 * - bolt_2 → bolt_3 → bolt_4 — стадии полного удара с ветвлением.
 * Кадры проигрываются быстрой последовательностью с неровной яркостью —
 * так получается «перестук» разряда.
 */

import { Sprite, type Container } from 'pixi.js';

import { texture } from '@/game/core/AssetLoader';
import { tweens } from '@/game/core/Tween';

export type SkyBoltKind = 'single' | 'double' | 'full';

/** Где на кадре начинается ствол молнии (доля ширины, сверху). */
const ORIGIN_X: Record<string, number> = {
  bolt_single_1: 0.31,
  bolt_single_2: 0.27,
  bolt_1: 0.31,
  bolt_2: 0.34,
  bolt_3: 0.34,
  bolt_4: 0.34,
};

/** Яркость по кадрам — неровная, как у настоящей молнии. */
const FLICKER = [1, 0.55, 1, 0.7, 0.95];

function framesFor(kind: SkyBoltKind): string[] {
  switch (kind) {
    case 'single': {
      // Одиночный разряд: один кадр, мерцание только яркостью.
      const frame = Math.random() < 0.5 ? 'bolt_single_1' : 'bolt_single_2';
      return [frame, frame, frame, frame];
    }
    case 'double':
      return ['bolt_1', 'bolt_1', 'bolt_2', 'bolt_1'];
    case 'full':
      return ['bolt_2', 'bolt_3', 'bolt_4', 'bolt_3', 'bolt_4'];
  }
}

export interface SkyBoltOptions {
  kind?: SkyBoltKind;
  /** Отразить по горизонтали — разряд уходит влево. */
  mirror?: boolean;
  /** Турбо-множитель времени. */
  factor?: number;
  /** Задержка перед ударом, мс. */
  delay?: number;
}

/**
 * Удар молнии: ствол начинается в точке (x, top), кадр вытягивается
 * на `height` вниз.
 */
export async function skyBolt(
  parent: Container,
  x: number,
  top: number,
  height: number,
  options: SkyBoltOptions = {},
): Promise<void> {
  const factor = options.factor ?? 1;
  const frames = framesFor(options.kind ?? 'full');
  const firstId = frames[0] as string;

  if (options.delay) await tweens.delay(options.delay * factor);

  const first = texture(firstId);
  const sprite = new Sprite(first);
  sprite.anchor.set(ORIGIN_X[firstId] ?? 0.33, 0);
  sprite.position.set(x, top);
  sprite.blendMode = 'add';
  sprite.tint = 0xcfe8ff;

  const scale = height / (first.height || 1);
  sprite.scale.set(options.mirror ? -scale : scale, scale);
  parent.addChild(sprite);

  // Перестук: кадры сменяются быстро, яркость скачет.
  for (let i = 0; i < frames.length; i++) {
    const id = frames[i] as string;
    sprite.texture = texture(id);
    sprite.anchor.x = ORIGIN_X[id] ?? 0.33;
    sprite.alpha = FLICKER[i % FLICKER.length] ?? 1;
    await tweens.delay(55 * factor);
  }

  // Послесвечение и угасание.
  await tweens.to(sprite, { alpha: 0 }, { duration: 320 * factor });
  sprite.destroy();
}
