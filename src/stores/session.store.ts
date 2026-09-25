/** Сессия игрока: профиль, баланс, конфиг игры с сервера. */

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { api, ApiError } from '@/api';
import { configureMoney } from '@/utils/format';
import type { GameConfigDto, UserDto } from '@/api/types';

export const useSessionStore = defineStore('session', () => {
  const sessionId = ref<string | null>(null);
  const user = ref<UserDto | null>(null);
  const balance = ref(0);
  const config = ref<GameConfigDto | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isReady = computed(() => sessionId.value !== null);
  const currency = computed(() => user.value?.currency ?? 'EUR');

  async function init(): Promise<void> {
    if (isLoading.value) return;
    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.init();
      sessionId.value = response.sessionId;
      user.value = response.user;
      balance.value = response.balance;
      config.value = response.config;
      configureMoney({ currency: response.user.currency });
    } catch (e) {
      error.value = e instanceof ApiError ? e.message : 'Не удалось начать сессию';
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function setBalance(value: number): void {
    balance.value = value;
  }

  /** Оптимистичное списание ставки до ответа сервера. */
  function adjustBalance(delta: number): void {
    balance.value = Math.max(0, balance.value + delta);
  }

  return {
    sessionId,
    user,
    balance,
    config,
    isLoading,
    error,
    isReady,
    currency,
    init,
    setBalance,
    adjustBalance,
  };
});
