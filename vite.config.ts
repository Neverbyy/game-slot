import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  server: {
    host: true,
    port: 5173,
  },

  build: {
    // Чанк Pixi сам по себе ~600 kB — это движок, дробить его незачем.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Движок и фреймворк меняются реже кода игры — отдельные чанки
        // остаются в кеше браузера между деплоями.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](pixi\.js|@pixi)[\\/]/.test(id)) return 'pixi';
          if (/[\\/]node_modules[\\/](@vue|vue|pinia)[\\/]/.test(id)) return 'vue';
          return undefined;
        },
      },
    },
  },
});
