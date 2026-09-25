/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API. Пусто → относительные пути через прокси Vite. */
  readonly VITE_API_URL?: string;
  /** 'false' переключает на реальный HTTP-бэкенд. */
  readonly VITE_USE_MOCK_API?: string;
  /** Отладочный оверлей с FPS. */
  readonly VITE_DEBUG?: string;
  /** Профиль настроек частот: 'balanced' (боевой) или 'demo' (тестовый). */
  readonly VITE_TUNING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
