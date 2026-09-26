/**
 * Звук на Web Audio.
 *
 * Клипы декодируются один раз при старте и играются кусками с подрезкой
 * и затуханием из `sounds.config.ts`. Звуки можно раскладывать по каналам:
 * новый звук на занятом канале плавно гасит предыдущий — так смех Зевса
 * не накладывается сам на себя при быстрой смене баннеров.
 *
 * Фоновая музыка идёт потоком через `<audio>` в тот же граф: трек длинный,
 * целиком в память его не декодируем. Её громкость живёт на своём узле,
 * поэтому её можно приглушать под смех, не трогая остальные звуки.
 */

import { MUSIC, SOUNDS, type SoundId } from '@/config/sounds.config';

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export interface PlayOptions {
  /** Канал: новый звук на нём гасит предыдущий. */
  channel?: string;
  /** Задержка перед стартом, с. */
  delay?: number;
  /** Приглушить музыку, пока звучит этот звук. */
  duck?: boolean;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private readonly channels = new Map<string, Voice>();
  private enabled = true;
  private loading: Promise<void> | null = null;

  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  /** Сколько звуков сейчас просят приглушить музыку. */
  private duckers = 0;
  /** Снять слушатели разблокировки звука, если жеста так и не было. */
  private removeUnlock: (() => void) | null = null;

  /** Загрузить и декодировать все клипы. Ошибка одного не мешает остальным. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(value ? 1 : 0, this.ctx.currentTime, 0.05);
    }
    if (value) {
      this.startMusic();
    } else {
      for (const channel of [...this.channels.keys()]) this.stopChannel(channel, 0.1);
      // Беззвучную музыку незачем тянуть и декодировать.
      this.music?.pause();
    }
  }

  /** Остановить всё и освободить аудио — когда модуль заменяется при HMR. */
  dispose(): void {
    for (const channel of [...this.channels.keys()]) this.stopChannel(channel, 0);
    this.removeUnlock?.();
    this.removeUnlock = null;

    if (this.music) {
      this.music.pause();
      this.music.removeAttribute('src');
      this.music.load();
    }
    this.music = null;
    this.musicGain = null;

    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
    this.duckers = 0;
    this.loading = null;
  }

  play(id: SoundId, options: PlayOptions = {}): void {
    const ctx = this.ctx;
    const master = this.master;
    const buffer = this.buffers.get(id);
    if (!ctx || !master || !buffer || !this.enabled) return;

    // Браузер держит звук на паузе до первого действия пользователя.
    if (ctx.state === 'suspended') void ctx.resume();

    const clip = SOUNDS[id];
    const start = Math.min(clip.start, buffer.duration);
    const end = Math.min(clip.end, buffer.duration);
    const duration = Math.max(end - start, 0.05);
    const fadeOut = Math.min(clip.fadeOut, duration);

    const when = ctx.currentTime + (options.delay ?? 0);

    if (options.channel) this.stopChannel(options.channel, 0.25, when);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, when);

    if (clip.loop) {
      // Зацикленный звук: крутится, пока его не остановят stopChannel.
      source.loop = true;
      source.loopStart = start;
      source.loopEnd = end;
      gain.gain.linearRampToValueAtTime(clip.volume, when + 0.08);
      source.connect(gain).connect(master);
      source.start(when, start);
    } else {
      gain.gain.linearRampToValueAtTime(clip.volume, when + 0.01);
      gain.gain.setValueAtTime(clip.volume, when + duration - fadeOut);
      gain.gain.linearRampToValueAtTime(0, when + duration);
      source.connect(gain).connect(master);
      source.start(when, start, duration);
    }

    if (options.duck) this.duckStart(when);

    const channel = options.channel;
    const voice = { source, gain };
    if (channel) this.channels.set(channel, voice);

    // onended срабатывает и при естественном конце, и при stop() —
    // в обоих случаях снимаем приглушение и освобождаем канал.
    source.onended = () => {
      if (channel && this.channels.get(channel) === voice) this.channels.delete(channel);
      if (options.duck) this.duckEnd();
    };
  }

  /** Плавно заглушить то, что играет на канале. */
  stopChannel(channel: string, fade = 0.3, at?: number): void {
    const ctx = this.ctx;
    const voice = this.channels.get(channel);
    if (!ctx || !voice) return;

    const now = Math.max(at ?? ctx.currentTime, ctx.currentTime);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + fade);
    try {
      voice.source.stop(now + fade + 0.02);
    } catch {
      /* уже остановлен */
    }
    this.channels.delete(channel);
  }

  /* --- Музыка --- */

  /** Запустить фоновую музыку (если браузер уже разрешил звук). */
  private startMusic(): void {
    if (!this.enabled || !this.music || !this.music.paused) return;
    void this.music.play().catch(() => {
      /* ещё не было действия пользователя — запустим на первом клике */
    });
  }

  private duckStart(when: number): void {
    const ctx = this.ctx;
    const gain = this.musicGain;
    this.duckers++;
    if (!ctx || !gain || this.duckers > 1) return;

    const at = Math.max(when, ctx.currentTime);
    gain.gain.cancelScheduledValues(at);
    gain.gain.setTargetAtTime(MUSIC.volume * MUSIC.duckLevel, at, MUSIC.duckIn / 3);
  }

  private duckEnd(): void {
    const ctx = this.ctx;
    const gain = this.musicGain;
    this.duckers = Math.max(this.duckers - 1, 0);
    if (!ctx || !gain || this.duckers > 0) return;

    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(MUSIC.volume, now, MUSIC.duckOut / 3);
  }

  private setupMusic(ctx: AudioContext, master: GainNode): void {
    const audio = new Audio(MUSIC.src);
    audio.loop = true;
    audio.preload = 'auto';

    const gain = ctx.createGain();
    gain.gain.value = MUSIC.volume;
    ctx.createMediaElementSource(audio).connect(gain).connect(master);

    this.music = audio;
    this.musicGain = gain;
    this.startMusic();
  }

  private async doLoad(): Promise<void> {
    if (typeof window === 'undefined' || !('AudioContext' in window)) return;

    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.enabled ? 1 : 0;
    master.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;

    this.setupMusic(ctx, master);
    this.unlockOnGesture(ctx);

    await Promise.all(
      (Object.entries(SOUNDS) as [SoundId, (typeof SOUNDS)[SoundId]][]).map(async ([id, clip]) => {
        try {
          const response = await fetch(clip.src);
          const data = await response.arrayBuffer();
          const buffer = await ctx.decodeAudioData(data);
          // Пока грузилось, звук могли освободить — в новый контекст не пишем.
          if (this.ctx === ctx) this.buffers.set(id, buffer);
        } catch (error) {
          if (this.ctx === ctx) console.warn(`[sound] не удалось загрузить «${id}»`, error);
        }
      }),
    );
  }

  /** Первый клик/нажатие снимает запрет браузера на звук и запускает музыку. */
  private unlockOnGesture(ctx: AudioContext): void {
    const remove = () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      this.removeUnlock = null;
    };
    const unlock = () => {
      if (ctx.state === 'suspended') void ctx.resume();
      this.startMusic();
      remove();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    this.removeUnlock = remove;
  }
}

export const sound = new SoundManager();

// При горячей замене модуля старый экземпляр иначе продолжил бы играть музыку
// поверх нового и держать слушатели на window.
import.meta.hot?.dispose(() => sound.dispose());
