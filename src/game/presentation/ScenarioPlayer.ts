/**
 * Проигрыватель сценария спина.
 *
 * Сервер (сейчас — мок) присылает список шагов; здесь каждый шаг превращается
 * в анимацию и дожидается её окончания. Новая фича = новый тип шага + ветка
 * в `playStep`, презентация больше нигде не меняется.
 */

import { TIMINGS } from '@/config/timings.config';
import { tweens } from '@/game/core/Tween';
import { gameBus } from '@/game/events';
import type { BigWinOverlay } from './BigWinOverlay';
import type { FreeSpinsCard } from './FreeSpinsCard';
import type { WinLabel } from './WinLabel';
import type { LightningLayer } from '@/game/fx/LightningFx';
import type { ZeusLayer } from '@/game/layers/ZeusLayer';
import type { ReelsView } from '@/game/reels/ReelsView';
import type { SpinResponse, SpinStep } from '@/api/types';

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

export class ScenarioPlayer {
  private factor = 1;
  private runningWin = 0;
  private hadSlam = false;
  private freeSpinsAwarded = 0;

  constructor(private readonly deps: ScenarioDeps) {}

  async play(response: SpinResponse, turbo: boolean): Promise<void> {
    this.factor = turbo ? TIMINGS.turboFactor : 1;
    this.runningWin = 0;
    this.hadSlam = false;
    this.freeSpinsAwarded = 0;

    // Гашеные ячейки — часть удара кулака, к началу спина их быть не должно.
    this.deps.reels.setInactive([], 0);

    for (const step of response.steps) {
      await this.playStep(step, response);
    }

    await this.deps.winLabel.hide();

    if (response.totalWin > 0) {
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
        await reels.stopWith(step.grid);
        gameBus.emit('spin:reels-stopped', undefined);
        break;
      }

      case 'win': {
        this.runningWin += step.win;
        gameBus.emit('win:progress', this.runningWin);

        const positions = step.clusters.flatMap((cluster) => cluster.positions);
        reels.highlight(positions);
        await winLabel.show(this.runningWin, step.multiplier);
        await tweens.delay(TIMINGS.winHighlightMs * this.factor);
        break;
      }

      case 'tumble': {
        await reels.tumble(step.removed, step.grid);
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
        gameBus.emit('win:progress', this.runningWin);
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

  private async playLightning(step: Extract<SpinStep, { type: 'lightning' }>): Promise<void> {
    const { reels, zeus, flash } = this.deps;

    await zeus.charge(TIMINGS.lightningChargeMs * this.factor);

    const points = step.targets.map(([col, row]) => reels.cellPoint(col, row));

    void flash(0.35, 220 * this.factor);
    for (const [col, row] of step.targets) void reels.flashCell(col, row);

    await zeus.strikeAt(points, this.factor < 1);
    await tweens.delay(TIMINGS.lightningHoldMs * this.factor);
    await reels.convertToWild(step.targets);

    if (step.multiplierAdded > 0) {
      gameBus.emit('win:multiplier', step.multiplierAdded);
    }

    void zeus.relax();
  }

  /** Удар кулака: молния в эпицентр, ударная волна, монеты на всём поле. */
  private async playSlam(step: Extract<SpinStep, { type: 'slam' }>): Promise<void> {
    const { reels, zeus, winLabel, flash, shake } = this.deps;

    await winLabel.hide();

    const [col, row] = step.origin;
    const point = reels.cellPoint(col, row);

    // Ячейки, до которых удар не дотянется, гаснут вместе с зарядом.
    reels.setInactive(step.inactive);
    await zeus.charge(TIMINGS.slamChargeMs * this.factor);

    void flash(0.7, 340 * this.factor);
    void reels.flashCell(col, row);
    void shake(26, TIMINGS.slamShakeMs * this.factor);

    await zeus.strikeAt([point], this.factor < 1);
    await reels.slam(step.origin, step.coins);

    // Номиналы слетаются в одну монету — и только потом экран выигрыша.
    await reels.collectValues(step.coins, step.collector);
    await tweens.delay(TIMINGS.slamHoldMs * this.factor);

    void zeus.relax();
  }
}
