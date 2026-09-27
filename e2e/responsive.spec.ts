/**
 * Адаптив: на каждом экране игра загружается без ошибок, страница не
 * прокручивается, панель и поле целиком видны и не перекрывают друг друга,
 * кнопки не мельче пальца, спин доигрывается. Скриншоты каждого экрана
 * складываются в `test-results/screens` — их удобно пролистать глазами.
 */

import { expect, test, type Page } from '@playwright/test';

type LayoutName = 'landscape' | 'portrait';
type PanelMode = 'docked' | 'fixed';

interface SlotHooks {
  ready(): boolean;
  layout(): { name: LayoutName; panel: PanelMode };
  fieldRect(): { x: number; y: number; width: number; height: number };
  status(): 'idle' | 'spinning';
}

declare global {
  interface Window {
    __slot?: SlotHooks;
  }
}

interface Screen {
  name: string;
  width: number;
  height: number;
  layout: LayoutName;
  panel: PanelMode;
  touch?: boolean;
}

const SCREENS: Screen[] = [
  { name: 'desktop-1920x1080', width: 1920, height: 1080, layout: 'landscape', panel: 'docked' },
  { name: 'laptop-1366x768', width: 1366, height: 768, layout: 'landscape', panel: 'docked' },
  {
    name: 'tablet-landscape-1024x768',
    width: 1024,
    height: 768,
    layout: 'landscape',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'tablet-portrait-768x1024',
    width: 768,
    height: 1024,
    layout: 'portrait',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'tablet-pro-portrait-1024x1366',
    width: 1024,
    height: 1366,
    layout: 'portrait',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'phone-portrait-390x844',
    width: 390,
    height: 844,
    layout: 'portrait',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'phone-landscape-844x390',
    width: 844,
    height: 390,
    layout: 'landscape',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'android-portrait-360x780',
    width: 360,
    height: 780,
    layout: 'portrait',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'android-landscape-780x360',
    width: 780,
    height: 360,
    layout: 'landscape',
    panel: 'fixed',
    touch: true,
  },
  {
    name: 'small-phone-320x568',
    width: 320,
    height: 568,
    layout: 'portrait',
    panel: 'fixed',
    touch: true,
  },
];

/** Минимальный размер SPIN — под палец. */
const MIN_TOUCH = 44;
/** Размер остальных кнопок сенсорной панели. */
const MIN_ICON = 36;
/** Допуск на субпиксельное округление. */
const EPS = 1;

/** Открыть игру и дождаться, пока она загрузится. Возвращает список ошибок страницы. */
async function boot(page: Page, query = ''): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto(`/${query}`);
  await page.waitForFunction(() => window.__slot?.ready() === true);
  await expect(page.locator('.loading')).toBeHidden();
  return errors;
}

function panelLocator(page: Page, panel: PanelMode) {
  return page.getByTestId(panel === 'docked' ? 'docked-panel' : 'touch-panel');
}

async function waitIdle(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__slot?.status() === 'idle', undefined, {
    timeout: 90_000,
  });
}

for (const screen of SCREENS) {
  test.describe(screen.name, () => {
    test.use({
      viewport: { width: screen.width, height: screen.height },
      hasTouch: screen.touch ?? false,
    });

    test('раскладка, панель и поле помещаются на экран', async ({ page }) => {
      const errors = await boot(page);

      const layout = await page.evaluate(() => window.__slot!.layout());
      expect(layout).toEqual({ name: screen.layout, panel: screen.panel });

      // Страница не прокручивается ни по одной оси.
      const scroll = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      expect(scroll.width).toBeLessThanOrEqual(screen.width);
      expect(scroll.height).toBeLessThanOrEqual(screen.height);

      // Панель целиком в пределах экрана.
      const panel = await panelLocator(page, screen.panel).boundingBox();
      expect(panel).not.toBeNull();
      expect(panel!.x).toBeGreaterThanOrEqual(-EPS);
      expect(panel!.y).toBeGreaterThanOrEqual(-EPS);
      expect(panel!.x + panel!.width).toBeLessThanOrEqual(screen.width + EPS);
      expect(panel!.y + panel!.height).toBeLessThanOrEqual(screen.height + EPS);

      // Поле (с рамкой) целиком видно и не заходит под панель.
      const field = await page.evaluate(() => window.__slot!.fieldRect());
      expect(field.x).toBeGreaterThanOrEqual(-EPS);
      expect(field.y).toBeGreaterThanOrEqual(-EPS);
      expect(field.x + field.width).toBeLessThanOrEqual(screen.width + EPS);
      expect(field.y + field.height).toBeLessThanOrEqual(panel!.y + EPS);

      // SPIN — не мельче пальца, остальные кнопки — не мельче 36 px.
      const spin = await page.getByTestId('spin').boundingBox();
      expect(spin).not.toBeNull();
      if (screen.panel === 'fixed') {
        expect(spin!.width).toBeGreaterThanOrEqual(MIN_TOUCH);
        expect(spin!.height).toBeGreaterThanOrEqual(MIN_TOUCH);

        const buttons = panelLocator(page, 'fixed').locator('button:visible');
        for (const box of await buttons.evaluateAll((items) =>
          items.map((item) => item.getBoundingClientRect().toJSON() as DOMRect),
        )) {
          expect(box.width).toBeGreaterThanOrEqual(MIN_ICON - EPS);
          expect(box.height).toBeGreaterThanOrEqual(MIN_ICON - EPS);
        }
      }

      // Содержимое панели (кнопки и суммы) не вылезает за край экрана:
      // сама панель может помещаться, а её ряд — оказаться шире неё.
      const items = panelLocator(page, screen.panel).locator(
        'button:visible, .panel__stat, .bar__stat',
      );
      for (const box of await items.evaluateAll((nodes) =>
        nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect),
      )) {
        expect(box.left).toBeGreaterThanOrEqual(-EPS);
        expect(box.right).toBeLessThanOrEqual(screen.width + EPS);
      }

      await page.screenshot({ path: `test-results/screens/${screen.name}.png` });
      expect(errors).toEqual([]);
    });

    test('спин доигрывается', async ({ page }) => {
      const errors = await boot(page);

      await page.getByTestId('spin').click();
      await page.waitForFunction(() => window.__slot?.status() === 'spinning');
      await waitIdle(page);

      expect(errors).toEqual([]);
    });
  });
}

test.describe('поворот экрана', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('раскладка переключается на лету', async ({ page }) => {
    const errors = await boot(page);
    const layout = () => page.evaluate(() => window.__slot!.layout());

    expect(await layout()).toEqual({ name: 'portrait', panel: 'fixed' });

    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(layout).toEqual({ name: 'landscape', panel: 'fixed' });
    await page.screenshot({ path: 'test-results/screens/rotate-landscape.png' });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect.poll(layout).toEqual({ name: 'landscape', panel: 'docked' });
    await expect(page.getByTestId('touch-panel')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(layout).toEqual({ name: 'portrait', panel: 'fixed' });
    await page.screenshot({ path: 'test-results/screens/rotate-portrait.png' });

    // Поворот посреди спина ничего не ломает.
    await page.getByTestId('spin').click();
    await page.setViewportSize({ width: 844, height: 390 });
    await waitIdle(page);

    expect(errors).toEqual([]);
  });
});

test.describe('телефон: модалки и фичи', () => {
  test.use({ viewport: { width: 360, height: 780 }, hasTouch: true });

  test('меню и таблица выплат помещаются на экран', async ({ page }) => {
    const errors = await boot(page);

    await page.getByTitle('Меню').click();
    const drawer = page.getByRole('dialog', { name: 'Меню' });
    await expect(drawer).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/phone-menu.png' });

    await page.getByRole('button', { name: 'Таблица выплат' }).click();
    const paytable = page.getByRole('dialog', { name: 'Таблица выплат' });
    await expect(paytable).toBeVisible();
    const box = await paytable.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360 + EPS);
    expect(box!.y + box!.height).toBeLessThanOrEqual(780 + EPS);
    await page.screenshot({ path: 'test-results/screens/phone-paytable.png' });

    expect(errors).toEqual([]);
  });

  test('удар кулака в портрете', async ({ page }) => {
    const errors = await boot(page, '?force=slam&seed=7');

    await page.getByTestId('spin').click();
    await page.waitForTimeout(4500);
    await page.screenshot({ path: 'test-results/screens/phone-slam-1.png' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: 'test-results/screens/phone-slam-2.png' });
    await waitIdle(page);

    expect(errors).toEqual([]);
  });

  test('экран крупного выигрыша в портрете', async ({ page }) => {
    const errors = await boot(page);

    await page.getByRole('button', { name: 'epic' }).click();
    await page.waitForTimeout(9000);
    await page.screenshot({ path: 'test-results/screens/phone-bigwin.png' });

    expect(errors).toEqual([]);
  });
});
