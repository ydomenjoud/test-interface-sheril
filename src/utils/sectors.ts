import { BOUNDS } from './position';

export const SECTOR_SIZE = 10;

const SECTOR_LABEL_OFFSET = Math.floor((SECTOR_SIZE - 1) / 2);

/** Damier : moitié noire (fond de base), moitié teinte chaude (évite le bleu des scans). */
const SECTOR_FILL_TINTED = 'rgba(115, 88, 42, 0.28)';

// BOUNDS est lue à l'appel (et non capturée au chargement du module) : sa taille est
// recalculée dynamiquement selon les coordonnées observées (voir position.ts).
function localCoord(coord: number, size: number): number {
  return ((coord - 1) % size + size) % size;
}

export function getSectorGridCoords(x: number, y: number): { row: number; col: number } {
  const localX = localCoord(x, BOUNDS.maxX);
  const localY = localCoord(y, BOUNDS.maxY);
  return {
    row: Math.floor(localX / SECTOR_SIZE),
    col: Math.floor(localY / SECTOR_SIZE),
  };
}

/** Numéro de secteur (1..nbLignes×nbColonnes) pour des coordonnées galaxie 1-based. */
export function getSectorNumber(x: number, y: number): number {
  const { row, col } = getSectorGridCoords(x, y);
  return row * Math.floor(BOUNDS.maxY / SECTOR_SIZE) + col + 1;
}

/** Case centrale du secteur 10×10, pour y placer le libellé. */
export function isSectorLabelCell(x: number, y: number): boolean {
  const localX = localCoord(x, BOUNDS.maxX);
  const localY = localCoord(y, BOUNDS.maxY);
  return localX % SECTOR_SIZE === SECTOR_LABEL_OFFSET
    && localY % SECTOR_SIZE === SECTOR_LABEL_OFFSET;
}

/** Couleur de fond du secteur, ou null pour laisser le fond noir. */
export function sectorBackgroundColor(x: number, y: number): string | null {
  const { row, col } = getSectorGridCoords(x, y);
  return (row + col) % 2 === 0 ? null : SECTOR_FILL_TINTED;
}

export function sectorLabelColor(): string {
  return 'rgba(235, 240, 255, 0.45)';
}
