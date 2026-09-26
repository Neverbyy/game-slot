/**
 * Звук наведения на любую кнопку интерфейса.
 *
 * Один делегированный слушатель на весь документ, а не обработчик на каждой
 * кнопке, — так звук получают и кнопки, которые появятся позже (меню,
 * модалки, выпадающий список автоигры).
 */

import { onBeforeUnmount, onMounted } from 'vue';

import { sound } from '@/game/core/SoundManager';

/** Не чаще — иначе при проводке мышью по ряду кнопок звуки сливаются в треск. */
const MIN_INTERVAL_MS = 60;

export function useButtonHoverSound(): void {
  let current: Element | null = null;
  let lastPlayed = 0;

  function onPointerOver(event: PointerEvent): void {
    // Только мышь: на тач-экранах «наведения» нет, звук шёл бы на каждое касание.
    if (event.pointerType !== 'mouse') return;

    const button = (event.target as Element | null)?.closest('button');

    // Переход между дочерними элементами одной кнопки — не новое наведение.
    if (button === current) return;
    current = button ?? null;

    if (!button || (button as HTMLButtonElement).disabled) return;

    const now = performance.now();
    if (now - lastPlayed < MIN_INTERVAL_MS) return;
    lastPlayed = now;

    sound.play('ui_hover');
  }

  onMounted(() => document.addEventListener('pointerover', onPointerOver));
  onBeforeUnmount(() => document.removeEventListener('pointerover', onPointerOver));
}
