/** Словарь игровых событий и общая шина. Через неё Pixi-слой говорит с Vue. */

import { EventBus } from './core/EventBus';
import type { ViewportInfo } from './core/Layout';
import type { BigWinTierId } from '@/config/symbols.config';
import type { FreeSpinsState, GameMode } from '@/api/types';

export type GameEvents = {
  'assets:progress': number;
  'game:ready': void;
  'game:resize': ViewportInfo;

  'spin:start': { bet: number; mode: GameMode };
  'spin:reels-stopped': void;
  'spin:end': { totalWin: number };

  /** Текущий накопленный выигрыш спина — для счётчика TOTAL WIN. */
  'win:progress': number;
  'win:multiplier': number;

  'bigwin:start': { tier: BigWinTierId; amount: number };
  'bigwin:end': void;

  'freespins:start': { total: number };
  'freespins:update': FreeSpinsState;
  'freespins:end': { totalWin: number };

  'sound:play': string;
  error: Error;
};

export const gameBus = new EventBus<GameEvents>();
