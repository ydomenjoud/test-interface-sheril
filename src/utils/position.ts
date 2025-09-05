import { XY } from '../types';
export const BOUNDS = { minX: 0, maxX: 40, minY: 0, maxY: 40 };

export function parsePosString(pos: string): XY {
  // format GALAXIE_POSY_POSX ; "0_4_6" => x=4 (vertical), y=6 (horizontal)
  const parts = pos.split('_');
  if (parts.length < 3) return { x: 1, y: 1 };
  const x = parseInt(parts[1], 10);
  const y = parseInt(parts[2], 10);
  return { x, y };
}

export function wrapX(x: number): number {
  const range = BOUNDS.maxX;
  let nx = x;
  while (nx < 1) nx += range;
  while (nx > range) nx -= range;
  return nx;
}

export function wrapY(y: number): number {
  const range = BOUNDS.maxY;
  let ny = y;
  while (ny < 1) ny += range;
  while (ny > range) ny -= range;
  return ny;
}

export function torusDelta(center: number, offset: number, max: number): number {
  let v = center + offset;
  while (v < 1) v += max;
  while (v > max) v -= max;
  return v;
}
