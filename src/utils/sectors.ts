import { BOUNDS } from './position';

export const SECTOR_SIZE = 10;
export const GALAXY_SIZE = BOUNDS.maxX;
export const SECTORS_PER_AXIS = GALAXY_SIZE / SECTOR_SIZE;
export const SECTOR_COUNT = 16;

const SECTOR_LABEL_OFFSET = Math.floor((SECTOR_SIZE - 1) / 2);

/** Damier : moitié noire (fond de base), moitié teinte chaude (évite le bleu des scans). */
const SECTOR_FILL_TINTED = 'rgba(115, 88, 42, 0.38)';

function localCoord(coord: number): number {
  return ((coord - 1) % GALAXY_SIZE + GALAXY_SIZE) % GALAXY_SIZE;
}

export function getSectorGridCoords(x: number, y: number): { row: number; col: number } {
  const localX = localCoord(x);
  const localY = localCoord(y);
  return {
    row: Math.floor(localX / SECTOR_SIZE),
    col: Math.floor(localY / SECTOR_SIZE),
  };
}

/** Numéro de secteur (1–16) pour des coordonnées galaxie 1-based. */
export function getSectorNumber(x: number, y: number): number {
  const { row, col } = getSectorGridCoords(x, y);
  return row * SECTORS_PER_AXIS + col + 1;
}

/** Case centrale du secteur 10×10, pour y placer le libellé. */
export function isSectorLabelCell(x: number, y: number): boolean {
  const localX = localCoord(x);
  const localY = localCoord(y);
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
