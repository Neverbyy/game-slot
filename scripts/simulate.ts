/**
 * Прогон мок-движка: RTP, частота выигрышей и фичей.
 *
 *   npm run sim            — 200 000 спинов
 *   npm run sim -- 1000000 — столько, сколько скажут
 *
 * Пейтейбл в `src/config/symbols.config.ts` подгоняется по этим цифрам.
 */

import { playSpin } from '../src/api/mock/engine';
import { Rng } from '../src/api/mock/rng';
import { FREE_SPINS_MAX } from '../src/config/symbols.config';
import { activeProfile, setProfile, type TuningProfile } from '../src/config/tuning.config';
import type { GameMode } from '../src/api/types';

const SPINS = Number(process.argv[2] ?? 200_000);
const BET = 100;

const requested = process.argv[3];
if (requested === 'demo' || requested === 'balanced') setProfile(requested as TuningProfile);
const profile = activeProfile();

const rng = new Rng(20260921);

let totalBet = 0;
let totalWin = 0;
let paidSpins = 0;
let hits = 0;
let freeSpinTriggers = 0;
let freeSpinsPlayed = 0;
let lightningEvents = 0;
let slamsBase = 0;
let slamsFree = 0;
let slamWin = 0;
let cascades = 0;
let maxWin = 0;
let baseWin = 0;
let freeWin = 0;
let clusterWin = 0;
let maxMultiplier = 1;

let freeLeft = 0;
let freeMultiplier = 1;
let seriesTotal = 0;

for (let i = 0; i < SPINS; i++) {
  const mode: GameMode = freeLeft > 0 ? 'free' : 'base';

  if (mode === 'base') {
    totalBet += BET;
    paidSpins++;
    freeMultiplier = 1;
  } else {
    freeLeft--;
    freeSpinsPlayed++;
  }

  const outcome = playSpin({
    bet: BET,
    mode,
    multiplier: mode === 'free' ? freeMultiplier : 1,
    rng,
  });

  totalWin += outcome.totalWin;
  if (mode === 'free') freeWin += outcome.totalWin;
  else baseWin += outcome.totalWin;
  for (const step of outcome.steps) {
    if (step.type === 'win') clusterWin += step.win;
  }

  if (outcome.slamWin > 0) {
    slamWin += outcome.slamWin;
    if (mode === 'free') slamsFree++;
    else slamsBase++;
  }
  maxMultiplier = Math.max(maxMultiplier, outcome.multiplier);
  maxWin = Math.max(maxWin, outcome.totalWin);
  if (outcome.totalWin > 0) hits++;
  if (mode === 'free') freeMultiplier = outcome.multiplier;

  if (outcome.freeSpinsAwarded > 0) {
    // Тот же потолок серии, что и в mock.api.ts.
    const awarded = Math.min(outcome.freeSpinsAwarded, Math.max(FREE_SPINS_MAX - seriesTotal, 0));
    freeLeft += awarded;
    seriesTotal += awarded;
    if (mode === 'base') freeSpinTriggers++;
  }

  if (mode === 'free' && freeLeft === 0) seriesTotal = 0;

  for (const step of outcome.steps) {
    if (step.type === 'lightning') lightningEvents++;
    if (step.type === 'tumble') cascades++;
  }
}

const pct = (value: number) => `${(value * 100).toFixed(2)}%`;

console.log(`Профиль настроек:    ${profile}${profile === 'demo' ? '  (тестовый: частоты завышены, RTP не боевой)' : ''}`);
console.log(`Спинов:              ${SPINS.toLocaleString('ru-RU')} (платных ${paidSpins.toLocaleString('ru-RU')})`);
console.log(`RTP:                 ${pct(totalWin / totalBet)}`);
console.log(`Hit rate:            ${pct(hits / SPINS)}`);
console.log(`Каскадов на спин:    ${(cascades / SPINS).toFixed(2)}`);
console.log(`Молний на спин:      ${pct(lightningEvents / SPINS)}`);
console.log(`Фриспинов запущено:  ${freeSpinTriggers.toLocaleString('ru-RU')} (1 на ${Math.round(paidSpins / Math.max(freeSpinTriggers, 1))} платных)`);
console.log(`Фриспинов сыграно:   ${freeSpinsPlayed.toLocaleString('ru-RU')}`);
console.log(`Максимальный выигрыш: ×${(maxWin / BET).toFixed(1)} ставки`);
console.log('');
console.log(`Ударов кулака в базе:      ${slamsBase} (1 на ${Math.round(paidSpins / Math.max(slamsBase, 1))} платных)`);
console.log(`Ударов кулака во фриспинах: ${slamsFree} (${pct(slamsFree / Math.max(freeSpinsPlayed, 1))} фриспинов, ${((slamsFree / Math.max(freeSpinsPlayed, 1)) * 10).toFixed(1)} на серию из 10)`);
console.log(`Средняя выплата удара:     ×${(slamWin / Math.max(slamsBase + slamsFree, 1) / BET).toFixed(1)} ставки`);
console.log('');
console.log(`RTP базовой игры:    ${pct(baseWin / totalBet)}`);
console.log(`RTP фриспинов:       ${pct(freeWin / totalBet)}`);
console.log(`  кластеры:          ${pct(clusterWin / totalBet)}`);
console.log(`  удары кулака:      ${pct(slamWin / totalBet)}`);
console.log(`Максимальный множитель фриспинов: ×${maxMultiplier}`);
