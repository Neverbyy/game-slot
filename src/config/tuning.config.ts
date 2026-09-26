/**
 * Профили настроек частот.
 *
 * `balanced` — боевые числа, под которые выверен RTP.
 * `demo` — тестовый режим: скаттеры и кулак выпадают часто, чтобы можно было
 * быстро проверить фриспины и все четыре баннера крупного выигрыша. RTP в этом
 * профиле заведомо выше 100% — так и задумано, играть на нём нельзя.
 *
 * Профиль выбирается так: `?tuning=` в URL (только в отладке) → переменная
 * окружения `VITE_TUNING` → `balanced`.
 */

import { debugParam } from './debug.config';

export type TuningProfile = 'balanced' | 'demo';

export interface Tuning {
  /** Вес скаттера в базовой игре и во фриспинах. */
  scatter: { base: number; free: number };
  /** Вес кулака там же. */
  slam: { base: number; free: number };
}

export const TUNING: Record<TuningProfile, Tuning> = {
  balanced: {
    scatter: { base: 0.905, free: 0.5 },
    slam: { base: 0.0008, free: 0.034 },
  },
  demo: {
    scatter: { base: 3.4, free: 1 },
    slam: { base: 0.06, free: 1.55 },
  },
};

const PROFILES: readonly TuningProfile[] = ['balanced', 'demo'];

function detectProfile(): TuningProfile {
  const fromUrl = debugParam('tuning');
  if (isProfile(fromUrl)) return fromUrl;

  // `import.meta.env` подставляет Vite; в чистом Node (скрипт симуляции) его нет.
  const fromEnv = import.meta.env?.VITE_TUNING;
  return isProfile(fromEnv) ? fromEnv : 'balanced';
}

function isProfile(value: string | null | undefined): value is TuningProfile {
  return !!value && PROFILES.includes(value as TuningProfile);
}

let active: TuningProfile = detectProfile();

export function activeProfile(): TuningProfile {
  return active;
}

/** Переключение профиля — нужно скрипту симуляции. */
export function setProfile(profile: TuningProfile): void {
  active = profile;
}

export function tuning(): Tuning {
  return TUNING[active];
}
