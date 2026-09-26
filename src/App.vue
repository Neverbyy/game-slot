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
import { useButtonHoverSound } from '@/composables/useButtonHoverSound';
import { DEBUG } from '@/config/debug.config';

const { game, ui } = useBootstrap();
useButtonHoverSound();

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
      <!-- Панель висит поверх канваса прямо под барабанами. -->
      <BottomBar />
      <DebugOverlay v-if="DEBUG" />
      <ToastMessage />
    </main>

    <LoadingOverlay />
    <MenuModal />
    <PaytableModal />
  </div>
</template>

<style scoped lang="scss">
.app {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;

  &__stage {
    position: absolute;
    inset: 0;
  }
}
</style>
