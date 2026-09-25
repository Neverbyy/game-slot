/**
 * Манифест ассетов.
 *
 * Картинки лежат в `src/assets/img`, поэтому импортируются через Vite —
 * он сам подставит хэшированный URL и положит файлы в сборку.
 */

import armorLaurel from '@/assets/img/armor_laurel.png';
import background from '@/assets/img/background.png';
import bannerBig from '@/assets/img/big_win.png';
import bannerEpic from '@/assets/img/epic_win.png';
import bannerMega from '@/assets/img/mega_win.png';
import bannerSuper from '@/assets/img/super_mega_win.png';
import coinGold from '@/assets/img/coin_gold_25.png';
import coinSilver from '@/assets/img/coin_silver_bolt.png';
import scatterTex from '@/assets/img/scatter.png';
import extraSlam from '@/assets/img/extra_slam.png';
import gemClover from '@/assets/img/gem_clover.png';
import gemDiamond from '@/assets/img/gem_diamond.png';
import gemHeart from '@/assets/img/gem_heart.png';
import gemSpade from '@/assets/img/gem_spade.png';
import gemStar from '@/assets/img/gem_star.png';
import helmetHoplite from '@/assets/img/helmet_hoplite.png';
import logo from '@/assets/img/logo.png';
import medallionStar from '@/assets/img/medallion_star.png';
import wildZeus from '@/assets/img/wild_zeus.png';
import zeus from '@/assets/img/zeus.png';

import type { SymbolId } from '@/api/types';

/** Алиасы текстур символов совпадают с их id. */
export const SYMBOL_TEXTURES: Record<SymbolId, string> = {
  gem_spade: gemSpade,
  gem_clover: gemClover,
  gem_diamond: gemDiamond,
  gem_heart: gemHeart,
  gem_star: gemStar,
  helmet_hoplite: helmetHoplite,
  armor_laurel: armorLaurel,
  medallion_star: medallionStar,
  wild_zeus: wildZeus,
  scatter: scatterTex,
  extra_slam: extraSlam,
  coin_gold: coinGold,
  coin_silver: coinSilver,
};

export const SCENE_TEXTURES = {
  background,
  logo,
  zeus,
  banner_big: bannerBig,
  banner_mega: bannerMega,
  banner_super: bannerSuper,
  banner_epic: bannerEpic,
} as const;

export type SceneTextureId = keyof typeof SCENE_TEXTURES;

/** Полный список для Assets.load. */
export const ASSET_ENTRIES: { alias: string; src: string }[] = [
  ...Object.entries(SYMBOL_TEXTURES).map(([alias, src]) => ({ alias, src })),
  ...Object.entries(SCENE_TEXTURES).map(([alias, src]) => ({ alias, src })),
];
