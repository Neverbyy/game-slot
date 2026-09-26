/**
 * Карточки входа в бонус и выхода из него.
 *
 * Отдельных ассетов под них нет, поэтому карточка собрана из текста с тем же
 * золотым градиентом, что и на экране крупного выигрыша, и разрядов молний.
 */

import { Container, Graphics, Text, TextStyle } from 'pixi.js';

import { DESIGN, FIELD } from '@/config/layout.config';
import { easeOutBack, easeOutCubic } from '@/game/core/Easing';
import { tweens } from '@/game/core/Tween';
import { formatMoney } from '@/utils/format';
import { visibleRect, type ViewportInfo } from '@/game/core/Layout';
import { DISPLAY_FONT, GOLD_FILL } from '@/game/core/textStyles';
import type { LightningLayer } from '@/game/fx/LightningFx';

function titleStyle(size: number): TextStyle {
  return new TextStyle({
    fontFamily: DISPLAY_FONT,
    fontSize: size,
    fontWeight: '900',
    fill: GOLD_FILL,
    stroke: { color: 0x2a1602, width: 13, join: 'round' },
    dropShadow: { color: 0x000000, alpha: 0.6, blur: 10, distance: 6, angle: Math.PI / 2 },
    letterSpacing: 3,
    align: 'center',
  });
}

export class FreeSpinsCard extends Container {
  private readonly veil = new Graphics();
  private readonly headline: Text;
  private readonly subline: Text;
  /** Своя молниевая прослойка, чтобы разряды рисовались поверх вуали. */
  private readonly lightning: LightningLayer;

  constructor(createLightning: () => LightningLayer) {
    super();
    this.eventMode = 'none';
    this.visible = false;
    this.lightning = createLightning();

    this.headline = new Text({ text: '', style: titleStyle(104) });
    this.headline.anchor.set(0.5);
    this.headline.position.set(DESIGN.width / 2, FIELD.centerY - 60);

    this.subline = new Text({ text: '', style: titleStyle(56) });
    this.subline.anchor.set(0.5);
    this.subline.position.set(DESIGN.width / 2, FIELD.centerY + 70);

    this.addChild(this.veil, this.lightning, this.headline, this.subline);
  }

  resize(viewport: ViewportInfo): void {
    const { x, y, width, height } = visibleRect(viewport);
    this.veil.clear().rect(x, y, width, height).fill({ color: 0x03060f });
  }

  /** Вход в бонус — только количество спинов, без пояснений. */
  showIntro(spins: number, factor = 1): Promise<void> {
    return this.present(`${spins} ФРИСПИНОВ`, '', factor);
  }

  /** Итог серии. */
  showOutro(totalWin: number, spins: number, factor = 1): Promise<void> {
    return this.present(
      'ФРИСПИНЫ ЗАВЕРШЕНЫ',
      `${formatMoney(totalWin)} за ${spins} спинов`,
      factor,
      1400,
    );
  }

  private async present(
    headline: string,
    subline: string,
    factor: number,
    holdMs = 1600,
  ): Promise<void> {
    const hasSubline = subline.length > 0;

    this.headline.text = headline;
    this.subline.text = subline;
    this.subline.visible = hasSubline;

    // Без подписи заголовок встаёт по центру поля, а не над ней.
    this.headline.y = hasSubline ? FIELD.centerY - 60 : FIELD.centerY;

    this.visible = true;
    this.veil.alpha = 0;
    this.headline.alpha = 0;
    this.subline.alpha = 0;

    await tweens.to(this.veil, { alpha: 0.78 }, { duration: 320 * factor });

    // Пара разрядов по бокам от надписи — бонус же грозовой.
    void this.lightning.strike(
      { x: DESIGN.width / 2 - 520, y: FIELD.centerY - 220 },
      { x: DESIGN.width / 2 - 200, y: FIELD.centerY + 40 },
      { life: 420, width: 8, branches: 3 },
    );
    void this.lightning.strike(
      { x: DESIGN.width / 2 + 520, y: FIELD.centerY - 220 },
      { x: DESIGN.width / 2 + 200, y: FIELD.centerY + 40 },
      { life: 420, width: 8, branches: 3 },
    );

    await Promise.all([
      tweens.animate({
        duration: 460 * factor,
        ease: easeOutBack(2.4),
        onUpdate: (t) => {
          this.headline.alpha = Math.min(t * 2, 1);
          this.headline.scale.set(0.5 + t * 0.5);
        },
      }),
      tweens.to(this.subline, { alpha: 1 }, { duration: 520 * factor }),
    ]);

    this.headline.scale.set(1);
    await tweens.delay(holdMs * factor);

    await Promise.all([
      tweens.to(this.veil, { alpha: 0 }, { duration: 340 * factor, ease: easeOutCubic }),
      tweens.to(this.headline, { alpha: 0 }, { duration: 340 * factor }),
      tweens.to(this.subline, { alpha: 0 }, { duration: 340 * factor }),
    ]);

    this.visible = false;
  }
}
