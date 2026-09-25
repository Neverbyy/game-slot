/**
 * Молнии.
 *
 * Ломаная строится midpoint displacement: отрезок делится пополам, середина
 * смещается перпендикулярно на случайную величину, и так несколько итераций.
 * Рисуется в два прохода — широкая размытая «аура» с аддитивным блендингом
 * и тонкое яркое ядро сверху.
 */

import { BlurFilter, Container, Graphics } from 'pixi.js';

import { tweens } from '@/game/core/Tween';
import { randomRange } from '@/utils/math';

export interface Point {
  x: number;
  y: number;
}

export interface BoltOptions {
  /** Длительность жизни разряда, мс. */
  life?: number;
  /** Толщина ядра. */
  width?: number;
  /** Цвет свечения. */
  color?: number;
  /** Сила излома: доля длины отрезка. */
  roughness?: number;
  /** Количество ответвлений. */
  branches?: number;
}

const DEFAULTS: Required<BoltOptions> = {
  life: 260,
  width: 5,
  color: 0x6fd2ff,
  roughness: 0.22,
  branches: 2,
};

/** Генерация ломаной между двумя точками. */
export function generateBolt(from: Point, to: Point, roughness: number, steps = 5): Point[] {
  let points: Point[] = [from, to];

  for (let i = 0; i < steps; i++) {
    const next: Point[] = [points[0] as Point];

    for (let j = 0; j < points.length - 1; j++) {
      const a = points[j] as Point;
      const b = points[j + 1] as Point;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);
      const offset = randomRange(-1, 1) * length * roughness;

      // Смещение перпендикулярно отрезку.
      next.push({
        x: (a.x + b.x) / 2 - (dy / length) * offset,
        y: (a.y + b.y) / 2 + (dx / length) * offset,
      });
      next.push(b);
    }

    points = next;
    roughness *= 0.55;
  }

  return points;
}

/** Слой, в котором живут все разряды. */
export class LightningLayer extends Container {
  private readonly glowFilter = new BlurFilter({ strength: 12, quality: 3 });

  constructor() {
    super();
    this.eventMode = 'none';
  }

  /**
   * Разряд из точки в точку. Промис резолвится, когда разряд погас.
   * Сам разряд живёт короче, чем анимация, которая его вызвала, — это нормально.
   */
  strike(from: Point, to: Point, options: BoltOptions = {}): Promise<void> {
    const opts = { ...DEFAULTS, ...options };

    const holder = new Container();
    const glow = new Graphics();
    const core = new Graphics();

    glow.filters = [this.glowFilter];
    glow.blendMode = 'add';
    core.blendMode = 'add';

    const paths: Point[][] = [generateBolt(from, to, opts.roughness)];

    // Ответвления уходят в сторону от случайной точки основного разряда.
    const main = paths[0] as Point[];
    for (let i = 0; i < opts.branches; i++) {
      const start = main[Math.floor(randomRange(main.length * 0.2, main.length * 0.8))] as Point;
      const end = {
        x: start.x + randomRange(-160, 160),
        y: start.y + randomRange(-120, 120),
      };
      paths.push(generateBolt(start, end, opts.roughness * 1.4, 3));
    }

    for (const path of paths) {
      drawPath(glow, path, opts.width * 3.2, opts.color, 0.55);
      drawPath(core, path, opts.width, 0xffffff, 1);
    }

    holder.addChild(glow, core);
    this.addChild(holder);

    return tweens
      .animate({
        duration: opts.life,
        onUpdate: (t) => {
          // Мерцание: разряд «дрожит» по яркости, а не гаснет линейно.
          const flicker = 0.75 + Math.random() * 0.25;
          holder.alpha = (1 - t) * flicker;
        },
      })
      .then(() => {
        holder.destroy({ children: true });
      });
  }

  /** Короткая искра вокруг точки — для ауры в руках Зевса. */
  spark(center: Point, radius: number, options: BoltOptions = {}): Promise<void> {
    const angle = randomRange(0, Math.PI * 2);
    const length = randomRange(radius * 0.5, radius);

    return this.strike(
      { x: center.x + Math.cos(angle) * radius * 0.2, y: center.y + Math.sin(angle) * radius * 0.2 },
      { x: center.x + Math.cos(angle) * length, y: center.y + Math.sin(angle) * length },
      { life: 200, width: 3, branches: 1, roughness: 0.3, ...options },
    );
  }
}

function drawPath(g: Graphics, path: Point[], width: number, color: number, alpha: number): void {
  const first = path[0];
  if (!first) return;

  g.moveTo(first.x, first.y);
  for (let i = 1; i < path.length; i++) {
    const point = path[i] as Point;
    g.lineTo(point.x, point.y);
  }
  g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
}
