/** HTTP-реализация игрового API. Включится, когда появится бэкенд. */

import { request } from './http';
import type {
  BalanceResponse,
  InitResponse,
  SlotApi,
  SpinRequest,
  SpinResponse,
} from './types';

export const httpSlotApi: SlotApi = {
  init() {
    return request<InitResponse>('/api/game/init', { method: 'POST' });
  },

  spin(req: SpinRequest) {
    return request<SpinResponse>('/api/game/spin', { method: 'POST', body: req });
  },

  getBalance() {
    return request<BalanceResponse>('/api/wallet/balance');
  },
};
