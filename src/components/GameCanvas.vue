<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

import { gameApp } from '@/game/GameApp';
import { useUiStore } from '@/stores/ui.store';

const host = ref<HTMLDivElement | null>(null);
const ui = useUiStore();

onMounted(async () => {
  if (!host.value) return;
  try {
    await gameApp.init(host.value);
  } catch (e) {
    console.error('[pixi] не удалось инициализировать рендер', e);
    ui.showToast('Не удалось запустить графику');
  }
});

onBeforeUnmount(() => gameApp.destroy());
</script>

<template>
  <div ref="host" class="game-canvas" />
</template>

<style scoped lang="scss">
.game-canvas {
  position: absolute;
  inset: 0;
  overflow: hidden;

  :deep(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
}
</style>
