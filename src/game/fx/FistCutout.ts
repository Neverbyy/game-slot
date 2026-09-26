/**
 * Вырезка кулака из иконки extra_slam: остаётся только сам кулак с молниями,
 * без тёмно-синего диска и золотого кольца. Нужна, чтобы кулак можно было
 * увеличить поверх рамки — увеличенная иконка целиком закрыла бы кольцо диском.
 *
 * Ключ подобран по самой картинке: кулак светло-голубой (0.4·G + 0.6·B ≳ 195),
 * фон диска тёмно-синий (≲ 150), кольцо жёлтое (R заметно больше B).
 *
 * Область вырезки — эллипс по внутреннему краю кольца: сбоку кольцо ближе
 * (0.29 ширины), а сверху костяшки доходят до 0.305 — круг их срезал бы.
 * Низ запястья гасим плавно, иначе при увеличении виден ровный срез.
 */

import { Texture } from 'pixi.js';

import { smoothstep } from '@/utils/math';

/** Порог яркости «голубизны»: ниже — фон диска, выше — кулак. */
const KEY_LOW = 150;
const KEY_HIGH = 195;
/** Полуоси эллипса вырезки в долях ширины иконки. */
const AREA_RX = 0.285;
const AREA_RY = 0.33;
/** Затухание запястья: от и до (смещение вниз от центра, доли ширины). */
const WRIST_FROM = 0.17;
const WRIST_TO = 0.27;

export function createFistCutout(source: Texture, size = 512): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const resource = source.source.resource as CanvasImageSource | undefined;
  if (!ctx || !resource) return Texture.EMPTY;

  const { x, y, width, height } = source.frame;
  ctx.drawImage(resource, x, y, width, height, 0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  const count = size * size;
  const radial = new Float32Array(count);
  const key = new Float32Array(count);
  const center = size / 2;

  for (let i = 0; i < count; i++) {
    const r = px[i * 4]!;
    const g = px[i * 4 + 1]!;
    const b = px[i * 4 + 2]!;

    const dx = ((i % size) - center) / size;
    const dy = (Math.floor(i / size) - center) / size;
    const ellipse = Math.hypot(dx / AREA_RX, dy / AREA_RY);
    radial[i] = (1 - smoothstep(0.9, 1, ellipse)) * (1 - smoothstep(WRIST_FROM, WRIST_TO, dy));

    const blue = smoothstep(KEY_LOW, KEY_HIGH, 0.4 * g + 0.6 * b);
    const gold = smoothstep(20, 80, r - b);
    key[i] = blue * (1 - gold) * radial[i]!;
  }

  // Тени на ладони и запястье тоже тёмно-синие и выпадают из ключа дырами.
  // Размытый ключ плотный там, где кулак, — им дыры и затягиваем. Радиус и
  // порог держим маленькими: иначе заливается и дымка молний вокруг, и
  // вырезка превращается в круглое пятно, закрывающее кольцо.
  const radius = Math.max(1, Math.round(size * 0.012));
  const dense = boxBlur(boxBlur(key, size, radius), size, radius);

  for (let i = 0; i < count; i++) {
    const fill = smoothstep(0.6, 0.85, dense[i]!) * radial[i]!;
    px[i * 4 + 3] = Math.round(px[i * 4 + 3]! * Math.max(key[i]!, fill));
  }

  ctx.putImageData(image, 0, 0);
  return Texture.from(canvas);
}

/** Раздельное box-размытие квадратного поля значений. */
function boxBlur(src: Float32Array, size: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const span = radius * 2 + 1;
  const clamp = (v: number) => Math.min(size - 1, Math.max(0, v));

  for (let y = 0; y < size; y++) {
    const row = y * size;
    let sum = 0;
    for (let x = -radius; x <= radius; x++) sum += src[row + clamp(x)]!;
    for (let x = 0; x < size; x++) {
      tmp[row + x] = sum / span;
      sum += src[row + clamp(x + radius + 1)]! - src[row + clamp(x - radius)]!;
    }
  }

  for (let x = 0; x < size; x++) {
    let sum = 0;
    for (let y = -radius; y <= radius; y++) sum += tmp[clamp(y) * size + x]!;
    for (let y = 0; y < size; y++) {
      dst[y * size + x] = sum / span;
      sum += tmp[clamp(y + radius + 1) * size + x]! - tmp[clamp(y - radius) * size + x]!;
    }
  }

  return dst;
}
