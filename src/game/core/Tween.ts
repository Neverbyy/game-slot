/**
 * Минимальный твинер на тикере Pixi.
 *
 * Возвращает промисы, поэтому сценарий спина можно писать линейным async-кодом.
 * Внешних зависимостей (GSAP и т.п.) сознательно не тянем.
 */

import { linear, type EasingFn } from './Easing';

export interface TweenOptions {
  duration: number;
  delay?: number;
  ease?: EasingFn;
  /** Прогресс 0..1 после применения easing. */
  onUpdate?: (progress: number) => void;
  onComplete?: () => void;
}

/**
 * Анимируемые свойства задаются простой картой «имя → конечное значение».
 *
 * Выводить ключи из типа цели (`keyof T`) не получается: у Pixi-объектов
 * в `keyof` попадают методы, а для полиморфного `this` условные типы
 * схлопываются в `never`. Проверка имён тут не стоит борьбы с типами —
 * это внутренний помощник, а не публичный API.
 */
export type AnimatableProps = Record<string, number>;

class Tween {
  private elapsed = 0;
  private finished = false;

  constructor(
    private readonly options: TweenOptions,
    private readonly resolve: () => void,
  ) {}

  get isFinished(): boolean {
    return this.finished;
  }

  update(dt: number): void {
    if (this.finished) return;

    this.elapsed += dt;
    const delay = this.options.delay ?? 0;
    if (this.elapsed < delay) return;

    const duration = Math.max(this.options.duration, 1);
    const raw = Math.min((this.elapsed - delay) / duration, 1);
    const ease = this.options.ease ?? linear;

    this.options.onUpdate?.(ease(raw));

    if (raw >= 1) {
      this.finished = true;
      this.options.onComplete?.();
      this.resolve();
    }
  }

  /** Отменить без применения конечного состояния. */
  cancel(): void {
    if (this.finished) return;
    this.finished = true;
    this.resolve();
  }
}

export class TweenManager {
  private tweens: Tween[] = [];

  /** Произвольная анимация по прогрессу. */
  animate(options: TweenOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      this.tweens.push(new Tween(options, resolve));
    });
  }

  /** Анимация числовых свойств объекта. */
  to(
    target: object,
    props: AnimatableProps,
    options: Omit<TweenOptions, 'onUpdate'>,
  ): Promise<void> {
    const values = props;
    const mutable = target as Record<string, number>;
    const keys = Object.keys(values);
    const from = new Map<string, number>();

    return this.animate({
      ...options,
      onUpdate: (progress) => {
        for (const key of keys) {
          // Стартовые значения берём в первом кадре — после возможной задержки.
          if (!from.has(key)) from.set(key, mutable[key] as number);
          const start = from.get(key) as number;
          const end = values[key] as number;
          mutable[key] = start + (end - start) * progress;
        }
      },
    });
  }

  delay(ms: number): Promise<void> {
    return this.animate({ duration: ms });
  }

  update(dt: number): void {
    if (!this.tweens.length) return;

    for (const tween of this.tweens) tween.update(dt);

    if (this.tweens.some((tween) => tween.isFinished)) {
      this.tweens = this.tweens.filter((tween) => !tween.isFinished);
    }
  }

  /** Сброс без применения конечных состояний (уничтожение сцены). */
  cancelAll(): void {
    for (const tween of [...this.tweens]) tween.cancel();
    this.tweens = [];
  }
}

/** Общий экземпляр: обновляется из тикера в GameApp. */
export const tweens = new TweenManager();
