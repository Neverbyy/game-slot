import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import { DEBUG } from '@/config/debug.config';
import { gameApp } from '@/game/GameApp';
import { useGameStore } from '@/stores/game.store';
import '@/styles/main.scss';

const pinia = createPinia();
createApp(App).use(pinia).mount('#app');

// Хук для e2e-тестов адаптива (Playwright): только в отладочной сборке.
if (DEBUG) {
  const game = useGameStore(pinia);
  Object.assign(window, {
    __slot: {
      ready: () => gameApp.isReady,
      layout: () => ({
        name: gameApp.viewportInfo.layout.name,
        panel: gameApp.viewportInfo.panel,
      }),
      fieldRect: () => gameApp.fieldScreenRect(),
      status: () => game.status,
    },
  });
}
