/**
 * Отладочный режим: оверлей с FPS и кнопками баннеров, а также параметры URL
 * `?force=`, `?seed=`, `?tuning=`. Включается переменной `VITE_DEBUG=true`
 * (в `.env.development` она включена, на проде — выключена, иначе любой
 * игрок мог бы через URL включить профиль `demo` или выбить крупный выигрыш).
 */

// `import.meta.env` подставляет Vite; в чистом Node (скрипт симуляции) его нет.
export const DEBUG = import.meta.env?.VITE_DEBUG === 'true';

/** Отладочный параметр из адресной строки; вне отладки — всегда `null`. */
export function debugParam(name: string): string | null {
  if (!DEBUG || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}
