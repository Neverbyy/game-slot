/**
 * Сборка Pixi-приложения: слои, тикер, ресайз.
 *
 * Это единственная точка соприкосновения Vue с рендером — компоненты и сторы
 * дергают методы фасада и слушают `gameBus`, но ничего не знают про Pixi.
 */

import { Application, Container, Graphics, Texture } from 'pixi.js';

import { DESIGN } from '@/config/layout.config';
import { TIMINGS } from '@/config/timings.config';
// Символы-«наполнители» для крутящихся барабанов берём из того же генератора,
// что и мок: он чисто конфигурационный и на результат спина не влияет —
// итоговую сетку всё равно присылает сервер.
import { randomCell, randomGrid } from '@/api/mock/engine';
import { computeViewport, visibleRect, type ViewportInfo } from './core/Layout';
import { loadAssets, texture } from './core/AssetLoader';
import { sound } from './core/SoundManager';
import { flashCurve } from './core/Easing';
import { tweens } from './core/Tween';
import { gameBus } from './events';
import { LightningLayer } from './fx/LightningFx';
import { createFistCutout } from './fx/FistCutout';
import { BackgroundLayer } from './layers/BackgroundLayer';
import { FrameLayer } from './layers/FrameLayer';
import { LogoLayer } from './layers/LogoLayer';
import { ZeusLayer } from './layers/ZeusLayer';
import { ReelsView } from './reels/ReelsView';
import { BigWinOverlay } from './presentation/BigWinOverlay';
import { FreeSpinsCard } from './presentation/FreeSpinsCard';
import { ScenarioPlayer } from './presentation/ScenarioPlayer';
import { WinLabel } from './presentation/WinLabel';
import type { GameMode, SpinResponse } from '@/api/types';

export class GameApp {
  private app: Application | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  /**
   * Номер запуска: если `destroy()` вызвали, пока `init()` ждал загрузки,
   * недостроенный запуск по нему понимает, что опоздал, и не собирает сцену.
   */
  private generation = 0;

  // Сцена собирается заново на каждый `init()`: `destroy()` уничтожает её целиком.
  private world!: Container;
  private flashOverlay!: Graphics;
  private background!: BackgroundLayer;
  private logo!: LogoLayer;
  private frame!: FrameLayer;
  private reels!: ReelsView;
  private zeus!: ZeusLayer;
  private lightning!: LightningLayer;
  private winLabel!: WinLabel;
  private bigWin!: BigWinOverlay;
  private freeSpinsCard!: FreeSpinsCard;
  private player!: ScenarioPlayer;
  /** Вырезка кулака рисуется на canvas — это своя текстура, её надо освобождать. */
  private fistCutout: Texture | null = null;

  private viewport: ViewportInfo = computeViewport(DESIGN.width, DESIGN.height);
  private mode: GameMode = 'base';
  private bet = 100;
  private ready = false;

  get isReady(): boolean {
    return this.ready;
  }

  /** Текущий масштаб и видимая область — по ним DOM-панель встаёт под барабаны. */
  get viewportInfo(): ViewportInfo {
    return this.viewport;
  }

  get pixi(): Application | null {
    return this.app;
  }

  async init(host: HTMLElement): Promise<void> {
    if (this.app) return;
    const generation = ++this.generation;
    const stale = () => generation !== this.generation;

    const app = new Application();
    await app.init({
      background: 0x05070f,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      resizeTo: host,
    });

    if (stale()) {
      app.destroy(true);
      return;
    }

    this.app = app;
    this.host = host;
    host.appendChild(app.canvas);

    // Звуки грузим параллельно с картинками, но не ждём: если не успели
    // или не загрузились — игра просто идёт без них.
    void sound.load();
    await loadAssets((progress) => gameBus.emit('assets:progress', progress));

    // Пока грузились картинки, игру уже уничтожили — `destroy()` всё убрал.
    if (stale()) return;

    this.buildScene();

    app.stage.addChild(this.world);
    app.ticker.add((ticker) => this.update(ticker.deltaMS));

    // Кулак без диска и кольца — для «вылезания» из рамки. Считается один раз.
    this.fistCutout = createFistCutout(texture('extra_slam'));
    this.reels.setFistCutout(this.fistCutout);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(host);
    this.handleResize();

    this.ready = true;
    gameBus.emit('game:ready', undefined);
  }

  destroy(): void {
    this.generation++;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    tweens.cancelAll();
    sound.dispose();

    // Общие текстуры из Assets не трогаем — только сцену и свою вырезку.
    this.app?.destroy(true, { children: true, texture: false });
    this.app = null;
    if (this.fistCutout && this.fistCutout !== Texture.EMPTY) this.fistCutout.destroy(true);
    this.fistCutout = null;

    this.host = null;
    this.ready = false;
  }

  /* --- Команды из Vue --- */

  setBet(bet: number): void {
    this.bet = bet;
  }

  setTurbo(turbo: boolean): void {
    this.reels?.setTurbo(turbo);
  }

  async setMode(mode: GameMode): Promise<void> {
    if (this.mode === mode || !this.ready) return;
    this.mode = mode;
    this.reels.setMode(mode);
    await this.background.setMode(mode);
  }

  /** Запустить вращение до прихода ответа сервера. */
  startSpin(): void {
    if (!this.ready) return;
    void this.winLabel.hide();
    void this.zeus.setPower(0.45, 260);
    this.reels.startSpin();
  }

  /** Проиграть присланный сервером сценарий. */
  async playResult(response: SpinResponse, turbo: boolean): Promise<void> {
    if (!this.ready) return;
    await this.player.play(response, turbo);
    void this.zeus.relax();
  }

  /** Итоговая карточка серии фриспинов. */
  async showFreeSpinsOutro(totalWin: number, spins: number, turbo: boolean): Promise<void> {
    if (!this.ready) return;
    await this.freeSpinsCard.showOutro(totalWin, spins, turbo ? TIMINGS.turboFactor : 1);
  }

  /** Отладка: показать экран крупного выигрыша на заданном множителе ставки. */
  async previewBigWin(multiplier: number): Promise<void> {
    if (!this.ready || this.bigWin.isActive) return;
    await this.bigWin.show(Math.round(this.bet * multiplier), this.bet, 1);
  }

  /** Вспышка на весь экран. */
  flash(intensity: number, duration: number): Promise<void> {
    return tweens
      .animate({
        duration,
        ease: flashCurve,
        onUpdate: (t) => {
          this.flashOverlay.alpha = t * intensity;
        },
      })
      .then(() => {
        this.flashOverlay.alpha = 0;
      });
  }

  /** Тряска камеры: дёргаем весь мир, кроме оверлеев поверх него. */
  shake(strength: number, duration: number): Promise<void> {
    // Точку покоя считаем каждый кадр заново: если окно растянули во время
    // тряски, мир не должен вернуться на старое место.
    return tweens
      .animate({
        duration,
        onUpdate: (t) => {
          const decay = (1 - t) * strength * this.viewport.scale;
          this.placeWorld((Math.random() * 2 - 1) * decay, (Math.random() * 2 - 1) * decay);
        },
      })
      .then(() => this.placeWorld());
  }

  /* --- Внутреннее --- */

  private buildScene(): void {
    this.world = new Container();
    this.flashOverlay = new Graphics();

    this.background = new BackgroundLayer();
    this.frame = new FrameLayer();
    this.lightning = new LightningLayer();
    this.zeus = new ZeusLayer(this.lightning);
    this.reels = new ReelsView((mode) => randomCell(mode, this.bet));
    this.logo = new LogoLayer();
    this.winLabel = new WinLabel();
    this.bigWin = new BigWinOverlay();
    this.freeSpinsCard = new FreeSpinsCard(() => new LightningLayer());

    this.flashOverlay.blendMode = 'add';
    this.flashOverlay.alpha = 0;
    this.flashOverlay.eventMode = 'none';

    // Оверлей крупного выигрыша лежит выше Зевса: на нём Зевс нарисован
    // прямо в баннере, а боковой должен уйти под вуаль.
    this.world.addChild(
      this.background,
      this.frame,
      this.reels,
      this.logo,
      this.winLabel,
      this.zeus,
      this.lightning,
      this.bigWin,
      this.freeSpinsCard,
      this.flashOverlay,
    );

    this.player = new ScenarioPlayer({
      reels: this.reels,
      zeus: this.zeus,
      lightning: this.lightning,
      winLabel: this.winLabel,
      bigWin: this.bigWin,
      freeSpinsCard: this.freeSpinsCard,
      flash: (intensity, duration) => this.flash(intensity, duration),
      shake: (strength, duration) => this.shake(strength, duration),
    });

    this.reels.setGrid(randomGrid('base', this.bet));
  }

  private update(dt: number): void {
    tweens.update(dt);
    this.background.update(dt);
    this.logo.update(dt);
    this.zeus.update(dt);
    this.reels.update(dt);
    this.bigWin.update(dt);
  }

  private handleResize(): void {
    if (!this.app || !this.host) return;

    const { clientWidth, clientHeight } = this.host;
    this.viewport = computeViewport(clientWidth, clientHeight);

    this.world.scale.set(this.viewport.scale);
    this.placeWorld();

    this.background.resize(this.viewport);
    this.bigWin.resize(this.viewport);
    this.freeSpinsCard.resize(this.viewport);

    const { x, y, width, height } = visibleRect(this.viewport);
    this.flashOverlay.clear().rect(x, y, width, height).fill({ color: 0xffffff });

    gameBus.emit('game:resize', this.viewport);
  }

  /** Мир по центру канваса; смещение — для тряски камеры. */
  private placeWorld(offsetX = 0, offsetY = 0): void {
    const { screenWidth, screenHeight, scale } = this.viewport;
    this.world.x = (screenWidth - DESIGN.width * scale) / 2 + offsetX;
    this.world.y = (screenHeight - DESIGN.height * scale) / 2 + offsetY;
  }
}

export const gameApp = new GameApp();
