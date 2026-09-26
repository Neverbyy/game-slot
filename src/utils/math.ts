/** Положительный остаток: mod(-1, 5) === 4. */
export function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Плавная ступенька Эрмита: 0 до edge0, 1 после edge1. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min((value - edge0) / (edge1 - edge0), 1));
  return t * t * (3 - 2 * t);
}
