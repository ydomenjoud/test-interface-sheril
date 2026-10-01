import {XY, Zone} from '../types';
import {wrapX, wrapY} from './position';

// Vrai si la zone couvre la case (en tenant compte du tore)
export function zoneCovers(z: Zone, pos: XY): boolean {
    const dx = wrapX(pos.x - z.x + 1) - 1; // 0-based
    const dy = wrapY(pos.y - z.y + 1) - 1;
    return dx < z.height && dy < z.width;
}
