/** Интерфейс: загрузка, модалки, звук, всплывающие сообщения. */

import { ref } from 'vue';
import { defineStore } from 'pinia';

import { sound } from '@/game/core/SoundManager';

export type ModalName = 'paytable' | 'menu' | null;

const STORAGE_KEY = 'zeus.ui.prefs';

interface Prefs {
  sound: boolean;
  turbo: boolean;
}

function readPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { sound: true, turbo: false, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* приватный режим — настройки не критичны */
  }
  return { sound: true, turbo: false };
}

export const useUiStore = defineStore('ui', () => {
  const prefs = readPrefs();

  const isBooting = ref(true);
  const loadProgress = ref(0);
  const modal = ref<ModalName>(null);
  const toast = ref<string | null>(null);
  const soundEnabled = ref(prefs.sound);
  const turbo = ref(prefs.turbo);

  sound.setEnabled(soundEnabled.value);

  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function persist(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sound: soundEnabled.value, turbo: turbo.value }),
      );
    } catch {
      /* игнорируем */
    }
  }

  function setSound(value: boolean): void {
    soundEnabled.value = value;
    sound.setEnabled(value);
    persist();
  }

  function setTurbo(value: boolean): void {
    turbo.value = value;
    persist();
  }

  function openModal(name: Exclude<ModalName, null>): void {
    modal.value = name;
  }

  function closeModal(): void {
    modal.value = null;
  }

  function showToast(message: string, durationMs = 2600): void {
    toast.value = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.value = null;
    }, durationMs);
  }

  function setBooting(value: boolean): void {
    isBooting.value = value;
  }

  function setProgress(value: number): void {
    loadProgress.value = value;
  }

  return {
    isBooting,
    loadProgress,
    modal,
    toast,
    soundEnabled,
    turbo,
    setSound,
    setTurbo,
    openModal,
    closeModal,
    showToast,
    setBooting,
    setProgress,
  };
});
