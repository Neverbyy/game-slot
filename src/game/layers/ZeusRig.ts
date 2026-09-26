/**
 * «Скелет» Зевса поверх статичной картинки.
 *
 * Спрайт один, отдельных рук в ассетах нет, поэтому текстура натягивается на
 * сетку вершин, а руки двигаются деформацией: каждая вершина поворачивается
 * вокруг плеча на угол, умноженный на её влияние от кости плечо→кисть.
 * Влияние спадает по расстоянию до кости, поэтому торс и голова стоят на
 * месте, а рука сгибается целиком, без швов и дыр — в отличие от варианта
 * с вырезанными руками.
 */

import { ColorMatrixFilter, Container, Mesh, MeshGeometry, type Texture } from 'pixi.js';

import { smoothstep } from '@/utils/math';

/** Сегментов сетки: чем больше, тем плавнее изгиб. */
const COLS = 14;
const ROWS = 18;

interface Bone {
  /** Точка вращения и конец кости в долях текстуры. */
  pivot: { x: number; y: number };
  tip: { x: number; y: number };
  /** Угол при полностью поднятых руках, радианы. У ног — ноль. */
  raiseAngle: number;
  /** Амплитуда покачивания в покое. */
  swayAngle: number;
  /** Скорость и сдвиг фазы, чтобы конечности не ходили синхронно. */
  swaySpeed: number;
  swayPhase: number;
  /** Радиусы влияния в долях высоты текстуры. */
  inner: number;
  outer: number;
}

const DEG = Math.PI / 180;

/** Кости. Координаты сняты с самой картинки. */
const BONES: readonly Bone[] = [
  // Руки: плечо → кисть.
  {
    pivot: { x: 0.34, y: 0.255 },
    tip: { x: 0.115, y: 0.385 },
    raiseAngle: 53 * DEG,
    swayAngle: 2.2 * DEG,
    swaySpeed: 1,
    swayPhase: 0,
    inner: 0.06,
    outer: 0.2,
  },
  {
    pivot: { x: 0.64, y: 0.235 },
    tip: { x: 0.9, y: 0.275 },
    raiseAngle: -47 * DEG,
    swayAngle: -2.6 * DEG,
    swaySpeed: 1,
    swayPhase: 1.9,
    inner: 0.06,
    outer: 0.2,
  },
  // Ноги: точка вращения под подолом, иначе кость тянет за собой юбку,
  // которая в этой же зоне уже гуляет от волны — и всё превращается в кашу.
  // Двигаются только голени со стопами, примерно на 5 px — еле заметно.
  {
    pivot: { x: 0.44, y: 0.7 },
    tip: { x: 0.46, y: 0.96 },
    raiseAngle: 0,
    swayAngle: 1.4 * DEG,
    swaySpeed: 0.62,
    swayPhase: 2.6,
    inner: 0.035,
    outer: 0.09,
  },
  {
    pivot: { x: 0.585, y: 0.68 },
    tip: { x: 0.61, y: 0.9 },
    raiseAngle: 0,
    swayAngle: -1.6 * DEG,
    swaySpeed: 0.47,
    swayPhase: 0.8,
    inner: 0.035,
    outer: 0.09,
  },
];

/** Юбка и ленты: где начинается ткань и где заканчивается подол. */
const CLOTH_TOP = 0.42;
const CLOTH_HEM = 0.97;
/** Амплитуда развевания в долях высоты текстуры. */
const CLOTH_AMPLITUDE = 0.017;

export class ZeusRig extends Container {
  readonly body: Mesh;
  readonly glow: Mesh;

  private readonly geometry: MeshGeometry;
  private readonly uvs: Float32Array;
  /**
   * Влияние каждой кости на каждую вершину: `[vertex * BONES.length + bone]`.
   * Зависит только от UV, поэтому считается один раз, а не каждый кадр.
   */
  private readonly influences: Float64Array;
  /** Угол каждой кости в текущем кадре — до умножения на влияние. */
  private readonly boneAngles = new Float64Array(BONES.length);
  private readonly colorMatrix = new ColorMatrixFilter();

  private readonly width_: number;
  private readonly height_: number;

  /** 0 — руки в покое, 1 — подняты к небу. */
  private raise = 0;
  private sway = 0;
  /** 0 — лёгкий ветерок, 1 — ткань рвёт на призыве грозы. */
  private wind = 0;

  constructor(texture: Texture, displayHeight: number) {
    super();

    this.height_ = displayHeight;
    this.width_ = (texture.width / (texture.height || 1)) * displayHeight;

    const { positions, uvs, indices } = buildGrid(this.width_, this.height_);
    this.uvs = uvs;
    this.geometry = new MeshGeometry({ positions, uvs, indices });

    const count = uvs.length / 2;
    this.influences = new Float64Array(count * BONES.length);
    for (let i = 0; i < count; i++) {
      this.writeInfluences(uvs[i * 2] as number, uvs[i * 2 + 1] as number, this.influences, i);
    }

    // Геометрия общая: свечение деформируется вместе с телом само собой.
    this.glow = new Mesh({ geometry: this.geometry, texture });
    this.glow.blendMode = 'add';
    this.glow.alpha = 0.18;
    this.glow.scale.set(1.02);

    this.body = new Mesh({ geometry: this.geometry, texture });
    this.body.filters = [this.colorMatrix];

    this.addChild(this.glow, this.body);
    this.applyPose();
  }

  get displayWidth(): number {
    return this.width_;
  }

  get displayHeight(): number {
    return this.height_;
  }

  setGlowAlpha(value: number): void {
    this.glow.alpha = value;
  }

  setBrightness(value: number): void {
    this.colorMatrix.brightness(value, false);
  }

  /** 0..1 — насколько подняты руки. Поза применится в ближайшем `update()`. */
  setRaise(value: number): void {
    this.raise = value;
  }

  /** 0..1 — сила ветра в ткани. */
  setWind(value: number): void {
    this.wind = value;
  }

  get raiseValue(): number {
    return this.raise;
  }

  /** Лёгкое дыхание рук в покое. */
  update(elapsed: number): void {
    this.sway = elapsed / 1000;
    this.applyPose();
  }

  /**
   * Куда уехала точка текстуры после деформации — нужно, чтобы молнии
   * вылетали из ладоней, а не из того места, где они были в покое.
   */
  deformPoint(u: number, v: number): { x: number; y: number } {
    const influences = new Float64Array(BONES.length);
    this.writeInfluences(u, v, influences, 0);
    this.updateBoneAngles();

    const [x, y] = this.deform(u, v, influences, 0);
    return { x: x - this.width_ / 2, y: y - this.height_ / 2 };
  }

  private applyPose(): void {
    const positions = this.geometry.positions;
    const count = this.uvs.length / 2;

    this.updateBoneAngles();

    for (let i = 0; i < count; i++) {
      const u = this.uvs[i * 2] as number;
      const v = this.uvs[i * 2 + 1] as number;
      const [x, y] = this.deform(u, v, this.influences, i);

      positions[i * 2] = x - this.width_ / 2;
      positions[i * 2 + 1] = y - this.height_ / 2;
    }

    this.geometry.getBuffer('aPosition').update();
  }

  /** Влияние всех костей на точку (u, v) — в `target` начиная с вершины `vertex`. */
  private writeInfluences(u: number, v: number, target: Float64Array, vertex: number): void {
    BONES.forEach((bone, b) => {
      target[vertex * BONES.length + b] = boneInfluence(u, v, bone, this.width_, this.height_);
    });
  }

  /** Поворот каждой кости в этом кадре: подъём рук плюс покачивание. */
  private updateBoneAngles(): void {
    BONES.forEach((bone, b) => {
      this.boneAngles[b] =
        bone.raiseAngle * this.raise +
        bone.swayAngle * Math.sin(this.sway * bone.swaySpeed + bone.swayPhase);
    });
  }

  /** Суммарный сдвиг точки от всех костей плюс развевание ткани. */
  private deform(u: number, v: number, influences: Float64Array, vertex: number): [number, number] {
    const px = u * this.width_;
    const py = v * this.height_;
    let dx = 0;
    let dy = 0;

    for (let b = 0; b < BONES.length; b++) {
      const influence = influences[vertex * BONES.length + b] as number;
      if (influence <= 0) continue;

      const bone = BONES[b] as Bone;
      const angle = (this.boneAngles[b] as number) * influence;

      const sx = bone.pivot.x * this.width_;
      const sy = bone.pivot.y * this.height_;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const ox = px - sx;
      const oy = py - sy;

      dx += sx + ox * cos - oy * sin - px;
      dy += sy + ox * sin + oy * cos - py;
    }

    const [clothX, clothY] = this.clothOffset(u, v);

    return [px + dx + clothX, py + dy + clothY];
  }

  /**
   * Развевание юбки и лент: волна бежит поперёк фигуры, тем сильнее, чем
   * ниже точка и чем дальше она от центра — у пояса и по центру ткань
   * почти не гуляет, у подола и по краям гуляет заметно.
   */
  private clothOffset(u: number, v: number): [number, number] {
    const depth = smoothstep(CLOTH_TOP, CLOTH_HEM, v);
    if (depth <= 0) return [0, 0];

    // По центру ноги, там ткань прилегает; к краям — свободные полы и ленты.
    const side = Math.min(Math.abs(u - 0.5) / 0.26, 1);
    const weight = depth * depth * (0.3 + 0.7 * side);

    const amplitude = CLOTH_AMPLITUDE * this.height_ * (0.55 + this.wind * 0.9);
    const phase = this.sway * 1.7 + v * 8.5 + u * 3.2;

    return [Math.sin(phase) * amplitude * weight, Math.cos(phase * 0.8) * amplitude * 0.3 * weight];
  }
}

/**
 * Влияние кости: у основания — ноль (там ничего не двигается), к концу
 * растёт, и всё это гаснет по мере удаления от самой кости.
 */
function boneInfluence(u: number, v: number, bone: Bone, width: number, height: number): number {
  const sx = bone.pivot.x * width;
  const sy = bone.pivot.y * height;
  const hx = bone.tip.x * width;
  const hy = bone.tip.y * height;

  const bx = hx - sx;
  const by = hy - sy;
  const lengthSq = bx * bx + by * by;
  if (lengthSq === 0) return 0;

  const px = u * width;
  const py = v * height;

  const t = Math.max(0, Math.min(((px - sx) * bx + (py - sy) * by) / lengthSq, 1));
  const cx = sx + bx * t;
  const cy = sy + by * t;
  const distance = Math.hypot(px - cx, py - cy);

  const falloff = 1 - smoothstep(bone.inner * height, bone.outer * height, distance);

  // Влияние выходит на единицу уже к середине кости: дальняя половина
  // (предплечье с кистью, голень со стопой) поворачивается как единое целое,
  // а весь изгиб собирается у сустава. При линейном нарастании конечность
  // растягивало сдвигом — у локтя поворот вполовину, у кисти полный.
  return smoothstep(0, 0.55, t) * falloff;
}

function buildGrid(
  width: number,
  height: number,
): { positions: Float32Array; uvs: Float32Array; indices: Uint32Array } {
  const count = (COLS + 1) * (ROWS + 1);
  const positions = new Float32Array(count * 2);
  const uvs = new Float32Array(count * 2);
  const indices = new Uint32Array(COLS * ROWS * 6);

  for (let row = 0; row <= ROWS; row++) {
    for (let col = 0; col <= COLS; col++) {
      const index = row * (COLS + 1) + col;
      const u = col / COLS;
      const v = row / ROWS;

      uvs[index * 2] = u;
      uvs[index * 2 + 1] = v;
      positions[index * 2] = u * width - width / 2;
      positions[index * 2 + 1] = v * height - height / 2;
    }
  }

  let cursor = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const a = row * (COLS + 1) + col;
      const b = a + 1;
      const c = a + (COLS + 1);
      const d = c + 1;

      indices[cursor++] = a;
      indices[cursor++] = b;
      indices[cursor++] = c;
      indices[cursor++] = b;
      indices[cursor++] = d;
      indices[cursor++] = c;
    }
  }

  return { positions, uvs, indices };
}
