/** Загрузка текстур с прогрессом. */

import { Assets, Texture } from 'pixi.js';

import { ASSET_ENTRIES } from '@/config/assets.manifest';

let loaded = false;

export async function loadAssets(onProgress?: (value: number) => void): Promise<void> {
  if (loaded) {
    onProgress?.(1);
    return;
  }

  Assets.add(ASSET_ENTRIES);
  await Assets.load(
    ASSET_ENTRIES.map((entry) => entry.alias),
    (progress) => onProgress?.(progress),
  );

  loaded = true;
}

/** Текстура по алиасу; если не загружена — пустая (Texture.EMPTY). */
export function texture(alias: string): Texture {
  return Assets.cache.has(alias) ? (Assets.get(alias) as Texture) : Texture.EMPTY;
}
