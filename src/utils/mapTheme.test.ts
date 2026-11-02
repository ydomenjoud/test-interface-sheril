import {adaptColorToTheme, MAP_THEMES} from './mapTheme';
import {getColorForPlayer} from './global';

describe('adaptColorToTheme', () => {
    it('laisse les couleurs inchangées sur fond sombre', () => {
        expect(adaptColorToTheme('#fde047', MAP_THEMES.sombre)).toBe('#fde047');
        expect(adaptColorToTheme(getColorForPlayer(7), MAP_THEMES.sombre)).toBe(getColorForPlayer(7));
    });

    it('assombrit les teintes pâles sur fond clair', () => {
        expect(adaptColorToTheme('#fde047', MAP_THEMES.clair)).toBe('#ca8a04');
        expect(adaptColorToTheme('#FDE047', MAP_THEMES.clair)).toBe('#ca8a04');
        // commandant impair (luminosité 65 %) et pair (45 %) : la teinte est gardée, ils restent distincts
        expect(adaptColorToTheme(getColorForPlayer(7), MAP_THEMES.clair)).toMatch(/^hsl\(\d+, 85%, 42%\)$/);
        expect(adaptColorToTheme(getColorForPlayer(8), MAP_THEMES.clair)).toMatch(/^hsl\(\d+, 85%, 30%\)$/);
    });

    it('garde les couleurs déjà soutenues et les valeurs absentes', () => {
        expect(adaptColorToTheme('#ef4444', MAP_THEMES.clair)).toBe('#ef4444');
        expect(adaptColorToTheme(undefined, MAP_THEMES.clair)).toBeUndefined();
    });
});
