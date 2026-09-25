import { httpSlotApi } from './http.api';
import { mockSlotApi } from './mock/mock.api';
import type { SlotApi } from './types';

/** Пока бэкенда нет — работает мок. Переключается переменной окружения. */
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false';

export const api: SlotApi = useMock ? mockSlotApi : httpSlotApi;

export { ApiError, setAuthToken } from './http';
export type * from './types';
