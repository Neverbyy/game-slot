<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';

import GameCanvas from '@/components/GameCanvas.vue';
import BottomBar from '@/components/ui/BottomBar.vue';
import DebugOverlay from '@/components/ui/DebugOverlay.vue';
import LoadingOverlay from '@/components/ui/LoadingOverlay.vue';
import MenuModal from '@/components/ui/MenuModal.vue';
import PaytableModal from '@/components/ui/PaytableModal.vue';
import ToastMessage from '@/components/ui/ToastMessage.vue';
import { useBootstrap } from '@/composables/useBootstrap';

const { game, ui } = useBootstrap();

const isDebug = import.meta.env.VITE_DEBUG === 'true';

/** Пробел — спин, как в большинстве слотов. */
function onKeydown(event: KeyboardEvent): void {
  if (event.code !== 'Space' || event.repeat) return;
  const target = event.target as HTMLElement | null;
  if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

  event.preventDefault();
  if (ui.modal) return;
  void game.spin();
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div class="app">
    <main class="app__stage">
      <GameCanvas />
      <DebugOverlay v-if="isDebug" />
      <ToastMessage />
    </main>

    <BottomBar />

    <LoadingOverlay />
    <MenuModal />
    <PaytableModal />
  </div>
</template>

<style scoped lang="scss">
.app {
  position: relative;
  display: grid;
  grid-template-rows: 1fr auto;
  width: 100%;
  height: 100%;
  overflow: hidden;

  &__stage {
    position: relative;
    min-height: 0;
  }
}
</style>
