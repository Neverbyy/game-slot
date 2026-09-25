/**
 * Заглушка бэкенда: держит баланс и состояние фриспинов, считает спин
 * локальным движком и отдаёт тот же контракт, что потом отдаст сервер.
 */

import { GRID } from '@/config/layout.config';
import {
  BET_LEVELS,
  BIG_WIN_TIERS,
  DEFAULT_BET_INDEX,
  FREE_SPINS_MAX,
  MIN_CLUSTER,
  PAYTABLE,
} from '@/config/symbols.config';
import { playSpin } from './engine';
import type {
  BalanceResponse,
  FreeSpinsState,
  GameMode,
  InitResponse,
  SlotApi,
  SpinRequest,
  SpinResponse,
} from '@/api/types';

const LATENCY_MS = 180;
const START_BALANCE = 500_000; // 5000.00

/** Отладочный режим: `?force=bigwin|freespins|lightning|slam`. */
type ForcedScenario = 'bigwin' | 'freespins' | 'lightning' | 'slam';
const FORCE_ATTEMPTS = 3000;

let balance = START_BALANCE;
let spinCounter = 0;

const freeSpins: FreeSpinsState = { left: 0, total: 0, multiplier: 1 };

/** Идемпотентность: повтор запроса не списывает ставку дважды. */
const processed = new Map<string, SpinResponse>();

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockSlotApi: SlotApi = {
  async init(): Promise<InitResponse> {
    await delay(LATENCY_MS);
    return {
      sessionId: `mock-${Date.now()}`,
      user: { id: 'demo', name: 'Demo', currency: 'EUR' },
      balance,
      config: {
        cols: GRID.cols,
        rows: GRID.rows,
        betLevels: BET_LEVELS,
        defaultBetIndex: DEFAULT_BET_INDEX,
        paytable: PAYTABLE,
        minClusterSize: MIN_CLUSTER,
        rtp: 96.4,
      },
    };
  },

  async spin(req: SpinRequest): Promise<SpinResponse> {
    const cached = processed.get(req.clientSpinId);
    if (cached) return cached;

    await delay(LATENCY_MS);

    const mode: GameMode = freeSpins.left > 0 ? 'free' : 'base';

    if (mode === 'base') {
      if (req.bet > balance) throw new Error('INSUFFICIENT_FUNDS');
      balance -= req.bet;
      freeSpins.multiplier = 1;
    } else {
      freeSpins.left -= 1;
    }

    const outcome = rollOutcome(req.bet, mode);
    balance += outcome.totalWin;

    if (mode === 'free') freeSpins.multiplier = outcome.multiplier;

    if (outcome.freeSpinsAwarded > 0) {
      // Потолок серии: на демо-настройках ретриггеры иначе не кончаются.
      const room = Math.max(FREE_SPINS_MAX - freeSpins.total, 0);
      const awarded = Math.min(outcome.freeSpinsAwarded, room);
      freeSpins.left += awarded;
      freeSpins.total += awarded;
      if (mode === 'base') freeSpins.multiplier = 1;
    } else if (mode === 'free' && freeSpins.left === 0) {
      // Серия закончилась — сбрасываем после ответа.
      freeSpins.total = 0;
    }

    const response: SpinResponse = {
      spinId: `mock-${++spinCounter}`,
      bet: req.bet,
      mode,
      steps: outcome.steps,
      totalWin: outcome.totalWin,
      balanceAfter: balance,
      freeSpins:
        freeSpins.left > 0 || outcome.freeSpinsAwarded > 0 ? { ...freeSpins } : undefined,
    };

    processed.set(req.clientSpinId, response);
    if (processed.size > 50) {
      processed.delete(processed.keys().next().value as string);
    }

    return response;
  },

  async getBalance(): Promise<BalanceResponse> {
    await delay(60);
    return { balance, currency: 'EUR' };
  },
};

/** Обычный прогон; при `?force=` крутим, пока не выпадет нужный сценарий. */
function rollOutcome(bet: number, mode: GameMode) {
  const forced = readForced();
  const multiplier = mode === 'free' ? freeSpins.multiplier : 1;

  let outcome = playSpin({ bet, mode, multiplier });
  if (!forced) return outcome;

  for (let i = 0; i < FORCE_ATTEMPTS && !matchesScenario(outcome, forced, bet); i++) {
    outcome = playSpin({ bet, mode, multiplier });
  }

  return outcome;
}

function matchesScenario(
  outcome: ReturnType<typeof playSpin>,
  scenario: ForcedScenario,
  bet: number,
): boolean {
  switch (scenario) {
    case 'bigwin':
      return outcome.totalWin >= bet * (BIG_WIN_TIERS[0]?.threshold ?? 40);
    case 'freespins':
      return outcome.freeSpinsAwarded > 0;
    case 'lightning':
      return outcome.steps.some((step) => step.type === 'lightning');
    case 'slam':
      return outcome.slamWin > 0;
  }
}

const FORCED_SCENARIOS: readonly ForcedScenario[] = ['bigwin', 'freespins', 'lightning', 'slam'];

function readForced(): ForcedScenario | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('force') as ForcedScenario | null;
  return value && FORCED_SCENARIOS.includes(value) ? value : null;
}
