import {getPuissanceFromString} from './puissance';

describe('reported power ranges', () => {
    it.each([['insignifiante', '0-24'], ['moyenne', '200-499'], ['titanesque', '10000-17999'],
        ['inimaginable', '≥18000'], [' INIMAGINABLE ', '≥18000'], ['inconnue', '']])(
        'formats %s without overlapping bounds or undefined values', (label, range) => {
            expect(getPuissanceFromString(label)).toBe(range);
        });
});
