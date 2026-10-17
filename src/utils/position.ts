import { Rapport, XY } from '../types';
// Bornes de la galaxie (coordonnées 1-based : 1..maxX / 1..maxY).
// Le jeu ne donne nulle part la taille de la galaxie : la valeur par défaut est 60×60,
// puis BOUNDS est recalculée à chaque chargement via appliquerBornesDepuisPositions
// (max des coordonnées observées, arrondi à la dizaine supérieure).
export const BOUNDS = { minX: 0, maxX: 60, minY: 0, maxY: 60 };
export const CENTER = { x: 30, y: 30 }; // centre par défaut, avant tout chargement de rapport

/** Taille d'un axe à partir du max des coordonnées observées : arrondi à la dizaine supérieure (47→50, 53→60, 60→60). */
export function tailleAxeDepuisCoord(coords: number[]): number {
    let max = 0;
    for (const c of coords) if (c > max) max = c;
    return Math.max(10, Math.ceil(max / 10) * 10);
}

/** Recalcule BOUNDS (in place) depuis les positions observées ; sans effet si la liste est vide. */
export function appliquerBornesDepuisPositions(positions: XY[]): void {
    if (!positions || positions.length === 0) return;
    BOUNDS.maxX = tailleAxeDepuisCoord(positions.map(p => p.x));
    BOUNDS.maxY = tailleAxeDepuisCoord(positions.map(p => p.y));
}

export function reinitialiserBornesGalaxie(): void {
    BOUNDS.minX = 0; BOUNDS.maxX = 60; BOUNDS.minY = 0; BOUNDS.maxY = 60;
}

/** Toutes les positions observées dans un rapport (systèmes, flottes, capitale). */
export function positionsDuRapport(r: Rapport): XY[] {
    const positions: XY[] = [];
    if (r.joueur?.capitale) positions.push(r.joueur.capitale);
    r.systemesJoueur?.forEach(s => positions.push(s.pos));
    r.systemesDetectes?.forEach(s => positions.push(s.pos));
    r.flottesJoueur?.forEach(f => positions.push(f.pos));
    r.flottesDetectees?.forEach(f => positions.push(f.pos));
    return positions;
}

export  function isPos(pos: string): boolean {
    if(!pos || !pos.split) { return false; }
    const parts = pos.split('_');
    if (parts.length < 3) return false;
    const x = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    return !isNaN(x) && !isNaN(y);
}

export function parsePosString(pos: string): XY {
  // format GALAXIE_POSY_POSX ; "0_4_6" => x=4 (vertical), y=6 (horizontal)
  const parts = pos.split('_');
  if (parts.length < 3) return { x: 0, y: 0 };
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

export function getTorusDistance(p1: XY, p2: XY): number {
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    const adx = Math.min(dx, BOUNDS.maxX - dx);
    const ady = Math.min(dy, BOUNDS.maxY - dy);
    return Math.max(adx, ady);
}

export function posToString(pos: XY): string {
    return `${pos.x}_${pos.y}`;
}
