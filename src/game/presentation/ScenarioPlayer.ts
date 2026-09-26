/**
 * Проигрыватель сценария спина.
 *
 * Сервер (сейчас — мок) присылает список шагов; здесь каждый шаг превращается
 * в анимацию и дожидается её окончания. Новая фича = новый тип шага + ветка
 * в `playStep`, презентация больше нигде не меняется.
 */

import { TIMINGS } from '@/config/timings.config';
import { sound } from '@/game/core/SoundManager';
import { tweens } from '@/game/core/Tween';
import { gameBus } from '@/game/events';
import type { BigWinOverlay } from './BigWinOverlay';
import type { FreeSpinsCard } from './FreeSpinsCard';
import type { WinLabel } from './WinLabel';
import type { LightningLayer } from '@/game/fx/LightningFx';
import type { ZeusLayer } from '@/game/layers/ZeusLayer';
import type { ReelsView } from '@/game/reels/ReelsView';
import { SCATTER } from '@/config/symbols.config';
import type { Grid, Pos, SpinResponse, SpinStep } from '@/api/types';

export interface ScenarioDeps {
  reels: ReelsView;
  zeus: ZeusLayer;
  lightning: LightningLayer;
  winLabel: WinLabel;
  bigWin: BigWinOverlay;
  freeSpinsCard: FreeSpinsCard;
  flash: (intensity: number, duration: number) => Promise<void>;
  shake: (strength: number, duration: number) => Promise<void>;
}

/**
 * Скаттеры, упавшие в каскаде. Досыпанные символы — это верхние ряды колонки,
 * столько штук, сколько в ней лопнуло.
 */
function newScatters(removed: readonly Pos[], grid: Grid): Pos[] {
  const dropped = new Map<number, number>();
  for (const [col] of removed) dropped.set(col, (dropped.get(col) ?? 0) + 1);

  const result: Pos[] = [];
  for (const [col, count] of dropped) {
    for (let row = 0; row < count; row++) {
      if (grid[col]?.[row]?.symbol === SCATTER) result.push([col, row] as Pos);
    }
  }
  return result;
}

export class ScenarioPlayer {
  private factor = 1;
  private runningWin = 0;
  private hadSlam = false;
  private freeSpinsAwarded = 0;
  /** Монета, в которую слетелись номиналы, — с неё убираем сумму под экран выигрыша. */
  private collector: Pos | null = null;

  constructor(private readonly deps: ScenarioDeps) {}

  async play(response: SpinResponse, turbo: boolean): Promise<void> {
    this.factor = turbo ? TIMINGS.turboFactor : 1;
    this.runningWin = 0;
    this.hadSlam = false;
    this.freeSpinsAwarded = 0;
    this.collector = null;

    // Гашеные ячейки и подсветка кулака — часть удара, к началу спина их
    // быть не должно (в том числе если прошлый сценарий оборвался с ошибкой).
    this.deps.reels.setInactive([], 0);
    this.deps.reels.clearSlamHighlight();

    for (const step of response.steps) {
      await this.playStep(step, response);
    }

    await this.deps.winLabel.hide();

    if (response.totalWin > 0) {
      // Сумма с коллектора «переезжает» в счётчик: гаснет, пока темнеет экран,
      // и к началу счёта на монете её уже нет.
      if (this.collector) {
        void this.deps.reels.fadeOutValue(this.collector, TIMINGS.bigWinIntroMs * this.factor);
      }
      await this.deps.bigWin.show(response.totalWin, response.bet, this.factor, this.hadSlam);
    }

    // После удара поле целиком в монетах — высыпаем их и досыпаем символы,
    // иначе монеты так и висят на экране до следующего спина.
    if (this.hadSlam) {
      await this.deps.reels.resetAfterSlam();
    }

    // Порядок как в реальных слотах: сначала показали выигрыш, потом бонус.
    if (this.freeSpinsAwarded > 0 && response.mode === 'base') {
      await this.deps.freeSpinsCard.showIntro(this.freeSpinsAwarded, this.factor);
    }

    this.deps.reels.clearHighlight();
    gameBus.emit('spin:end', { totalWin: response.totalWin });
  }

  private async playStep(step: SpinStep, response: SpinResponse): Promise<void> {
    const { reels, winLabel, flash } = this.deps;

    switch (step.type) {
      case 'reveal': {
        // Скаттер «приземляется» в момент остановки своего барабана.
        await reels.stopWith(step.grid, (col) => {
          const rows = (step.grid[col] ?? [])
            .map((cell, row) => (cell.symbol === SCATTER ? row : -1))
            .filter((row) => row >= 0);
          this.landScatters(rows.map((row) => [col, row] as Pos));
        });
        gameBus.emit('spin:reels-stopped', undefined);
        break;
      }

      case 'win': {
        this.runningWin += step.win;
        gameBus.emit('win:progress', this.runningWin);

        const positions = step.clusters.flatMap((cluster) => cluster.positions);
        reels.highlight(positions);
        sound.play('symbols_match');
        await winLabel.show(this.runningWin, step.multiplier);
        await tweens.delay(TIMINGS.winHighlightMs * this.factor);
        break;
      }

      case 'tumble': {
        await reels.tumble(step.removed, step.grid);
        // Скаттер мог упасть сверху вместе с досыпанными символами.
        this.landScatters(newScatters(step.removed, step.grid));
        reels.clearHighlight();
        await tweens.delay(TIMINGS.tumbleGapMs * this.factor);
        break;
      }

      case 'lightning': {
        await this.playLightning(step);
        break;
      }

      case 'slam': {
        this.hadSlam = true;
        this.runningWin += step.win;
        await this.playSlam(step);
        // Выигрыш удара в TOTAL WIN не отдаём: он зачислится, когда отыграют
        // сбор монет и экран выигрыша, — иначе панель обгоняет счётчик.
        break;
      }

      case 'scatters': {
        this.freeSpinsAwarded = step.freeSpinsAwarded;
        reels.highlight(step.positions);
        await flash(0.5, 260 * this.factor);
        await tweens.delay(TIMINGS.winHighlightMs * this.factor);
        reels.clearHighlight();
        gameBus.emit('freespins:start', { total: response.freeSpins?.total ?? 0 });
        break;
      }
    }
  }

  /** Приземление скаттеров: один звук на всю пачку и подскок каждого. */
  private landScatters(positions: readonly Pos[]): void {
    if (!positions.length) return;
    sound.play('scatter_land');
    for (const [col, row] of positions) this.deps.reels.landScatter(col, row);
  }

  private async playLightning(step: Extract<SpinStep, { type: 'lightning' }>): Promise<void> {
    const { reels, zeus, flash } = this.deps;

    await zeus.charge(TIMINGS.lightningChargeMs * this.factor);

    const points = step.targets.map(([col, row]) => reels.cellPoint(col, row));

    void flash(0.35, 220 * this.factor);
    sound.play('zeus_thunder');
    for (const [col, row] of step.targets) void reels.flashCell(col, row);

    await zeus.strikeAt(points, this.factor < 1);
    await tweens.delay(TIMINGS.lightningHoldMs * this.factor);
    await reels.convertToWild(step.targets);

    if (step.multiplierAdded > 0) {
      gameBus.emit('win:multiplier', step.multiplierAdded);
    }

    void zeus.relax();
  }

  /** Потрескивание вокруг ячейки с кулаком, пока идёт замах. */
  private async crackleAround(point: { x: number; y: number }): Promise<void> {
    const { lightning } = this.deps;

    for (let i = 0; i < 6; i++) {
      void lightning.spark(point, 70 + Math.random() * 60, { width: 3, life: 260 });
      await tweens.delay(170 * this.factor);
    }
  }

  /** Удар кулака: молния в эпицентр, ударная волна, монеты на всём поле. */
  private async playSlam(step: Extract<SpinStep, { type: 'slam' }>): Promise<void> {
    const { reels, zeus, winLabel, flash, shake } = this.deps;

    await winLabel.hide();

    const [col, row] = step.origin;
    const point = reels.cellPoint(col, row);

    // Сначала показываем сам кулак: ячейка вспыхивает, иконка вылезает наружу.
    await reels.highlightSlam(step.origin, this.factor);

    // Ячейки, до которых удар не дотянется, гаснут вместе с зарядом.
    reels.setInactive(step.inactive);

    // Разряды вокруг ячейки, пока Зевс замахивается.
    void this.crackleAround(point);

    // Взмах руками вверх и гром с неба в обе ладони.
    await zeus.summon(this.factor);

    void flash(0.7, 340 * this.factor);
    sound.play('zeus_thunder');
    void reels.flashCell(col, row);
    void shake(26, TIMINGS.slamShakeMs * this.factor);

    void zeus.throwDown();
    await Promise.all([zeus.strikeAt([point], this.factor < 1), reels.releaseSlam(this.factor)]);
    await reels.slam(step.origin, step.coins);

    // Номиналы слетаются в одну монету — и только потом экран выигрыша.
    await reels.collectValues(step.coins, step.collector);
    this.collector = step.collector;
    await tweens.delay(TIMINGS.slamHoldMs * this.factor);

    void zeus.relax();
  }
}
