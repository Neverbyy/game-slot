/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Базовый URL API. Пусто → относительные пути через прокси Vite. */
  readonly VITE_API_URL?: string;
  /** 'false' переключает на реальный HTTP-бэкенд. */
  readonly VITE_USE_MOCK_API?: string;
  /** Отладка: параметры URL `?force=`, `?seed=`, `?tuning=` и подсказка о них в меню. */
  readonly VITE_DEBUG?: string;
  /** Виджет с FPS и кнопками проверки экранов выигрыша (BIG / MEGA / SUPER / EPIC). */
  readonly VITE_DEBUG_PANEL?: string;
  /** Профиль настроек частот: 'balanced' (боевой) или 'demo' (тестовый). */
  readonly VITE_TUNING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
