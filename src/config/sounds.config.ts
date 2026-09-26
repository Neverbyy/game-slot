/**
 * Звуки и их подрезка.
 *
 * Исходники в `src/assets/sounds` не идеальны, поэтому каждый клип играется
 * не целиком, а куском [start, end] с плавным затуханием в конце — сами файлы
 * не трогаем, подрезку легко подвинуть здесь на слух.
 *
 * Точки реза сняты с огибающей громкости и спектрограммы (ffmpeg):
 * - big: целиком;
 * - mega: голос кончается на ~2.7 с, дальше 5 с одного низкого гула грома;
 * - super: с 2 с до ~5.3 с, дальше затухание;
 * - epic: играем с 4 с до конца — только протяжное «ХА-А-А»;
 * - молнии: оставляем почти целиком, срезаем только самый хвост.
 */

import bigWin from '@/assets/sounds/big-win_sound.mp3';
import coinCounter from '@/assets/sounds/coin-counter_sound.mp3';
import epicWin from '@/assets/sounds/epic-win_sound.mp3';
import lightning1 from '@/assets/sounds/lightning_sound-effect.mp3';
import lightning2 from '@/assets/sounds/lightning_sound-effect2.mp3';
import mainTheme from '@/assets/sounds/main-theme.mp3';
import symbolsMatch from '@/assets/sounds/symbols_match.mp3';
import scatterLand from '@/assets/sounds/scatter_sound.mp3';
import zeusThunder from '@/assets/sounds/thunder_sound-effect.mp3';
import uiHover from '@/assets/sounds/hover_sound-effect.mp3';
import megaWin from '@/assets/sounds/mega-win_sound.mp3';
import superMegaWin from '@/assets/sounds/super-mega-win_sound.mp3';

export type SoundId =
  | 'laugh_big'
  | 'laugh_mega'
  | 'laugh_super'
  | 'laugh_epic'
  | 'thunder_1'
  | 'thunder_2'
  | 'ui_hover'
  | 'symbols_match'
  | 'scatter_land'
  | 'zeus_thunder'
  | 'coin_counter';

export interface SoundClip {
  src: string;
  /** Откуда начинать, с. */
  start: number;
  /** Где закончить, с. */
  end: number;
  /** Длина затухания в конце, с. */
  fadeOut: number;
  /** Громкость 0..1. */
  volume: number;
  /**
   * Играть по кругу отрезок [start, end], пока его не остановят через
   * `stopChannel`. Такой звук обязательно запускать на канале.
   */
  loop?: boolean;
}

/**
 * Фоновая музыка: играет всегда, по кругу. Пока Зевс смеётся на экране
 * выигрыша, её приглушаем, а потом плавно возвращаем.
 */
export const MUSIC = {
  src: mainTheme,
  /** Обычная громкость музыки 0..1. */
  volume: 0.35,
  /** Во сколько раз тише, пока звучит смех (0.6 — примерно −4.5 дБ). */
  duckLevel: 0.6,
  /** Как быстро приглушить и как плавно вернуть, с. */
  duckIn: 0.15,
  duckOut: 0.8,
} as const;

export const SOUNDS: Record<SoundId, SoundClip> = {
  laugh_big: { src: bigWin, start: 0, end: 2.22, fadeOut: 0.05, volume: 0.9 },
  laugh_mega: { src: megaWin, start: 0, end: 3.2, fadeOut: 0.5, volume: 0.9 },
  laugh_super: { src: superMegaWin, start: 2, end: 5.3, fadeOut: 0.5, volume: 0.9 },
  laugh_epic: { src: epicWin, start: 4, end: 8.05, fadeOut: 0.6, volume: 0.95 },
  thunder_1: { src: lightning1, start: 0, end: 2.77, fadeOut: 0.4, volume: 0.55 },
  thunder_2: { src: lightning2, start: 0, end: 3.2, fadeOut: 0.5, volume: 0.55 },
  // Наведение на кнопку: короткий щелчок целиком, негромко.
  ui_hover: { src: uiHover, start: 0, end: 0.55, fadeOut: 0.05, volume: 0.2 },
  // Совпадение символов: звук затухает сам к ~1.9 с, дальше тишина — её срезаем.
  symbols_match: { src: symbolsMatch, start: 0, end: 1.9, fadeOut: 0.1, volume: 0.6 },
  // Приземление скаттера: звук ~1.2 с, дальше тишина — её срезаем.
  scatter_land: { src: scatterLand, start: 0, end: 1.2, fadeOut: 0.1, volume: 0.7 },
  // Удар молнии Зевса (wild и кулак): срезаем 0.55 с тишины в начале, чтобы
  // треск совпал со вспышкой; долгий раскат гасим к 5.5 с. Пик в файле чуть
  // выше 0 дБ — громкость пониже, чтобы не хрипело.
  zeus_thunder: { src: zeusThunder, start: 0.55, end: 5.5, fadeOut: 1.4, volume: 0.5 },
  // Счётчик крупного выигрыша: ровный звон монет по кругу, пока растёт сумма.
  // Самый конец файла чуть тише остального — в цикл его не берём.
  coin_counter: {
    src: coinCounter,
    start: 0,
    end: 4.9,
    fadeOut: 0.2,
    volume: 0.1,
    loop: true,
  },
};
