import {parseConstructionsEnCoursHtml, resoudreConstructionEnCours} from './parseConstructionsEnCours';
import {PlanVaisseau, Technologie} from '../types';

// Extrait réduit d'un principal.htm : une ancre par système, puis ses tableaux
const section = (lignes: string) => `
<TR><TD align="center" colspan="6" class="bg"><SPAN class="c7">Budget</SPAN></TD></TR>
<TR><TD><SPAN class="c4">Technologie</SPAN></TD><TD>0% </TD><TD><SPAN class="c4">Services spéciaux</SPAN></TD><TD>0%</TD><TD><SPAN class="c4">Contre-espionnage</SPAN></TD><TD>0% </TD></TR>
<TR><TD align="center" colspan="6" class="bg"><SPAN class="c7">Constructions en cours</SPAN></TD></TR>
<TR><TD align="center"><SPAN class="c4">Type</SPAN></TD><TD align="center"><SPAN class="c4">Nombre</SPAN></TD><TD align="center" colspan="2"><SPAN class="c4">Points constru. nécessaires</SPAN></TD><TD align="center" colspan="2"><SPAN class="c4">Pour la planète</SPAN></TD></TR>
${lignes}
<TR><TD align="center" colspan="6" class="bg"><SPAN class="c7">Bâtiments</SPAN></TD></TR>
<TR><TD><SPAN class="technologie">Mines</SPAN></TD><TD>58</TD><TD><SPAN class="technologie">Chantier naval</SPAN></TD><TD>1</TD></TR>`;

const ligne = (type: string, nb: number, pdc: number, pla: string) =>
    `<TR><TD align="center">${type}</TD><TD align="center">${nb}</TD><TD align="center" colspan="2">${pdc}</TD><TD align="center" colspan="2">${pla}</TD></TR>`;

const html = `<HTML><HEAD><TITLE>Rapport du commandant <span class="race0">Astheon&nbsp;(23)</span></TITLE></HEAD><BODY>
<A name="resumeS"></A>
<A name="0_25_10"></A><TABLE>${section('')}</TABLE>
<A name="0_27_7"></A><TABLE>${section(ligne('Colonisateur', 1, 0, '7'))}</TABLE>
<A name="0_29_10"></A><TABLE>${section(ligne('station de produits de luxe de type I', 3, 12, 'Non précisé') + ligne('Mine', 4, 2, '2'))}</TABLE>
</BODY></HTML>`;

describe('parseConstructionsEnCoursHtml', () => {
    const res = parseConstructionsEnCoursHtml(html);

    test('lit le numéro du commandant et compte les systèmes', () => {
        expect(res.commandant).toBe(23);
        expect(res.nbSystemes).toBe(3);
    });

    test('rattache chaque construction à son système, planète en base 0', () => {
        expect(res.systemes['25_10']).toBeUndefined();
        expect(res.systemes['27_7']).toEqual([{nom: 'Colonisateur', nombre: 1, pdcRestants: 0, planete: 6}]);
        expect(res.systemes['29_10']).toEqual([
            {nom: 'station de produits de luxe de type I', nombre: 3, pdcRestants: 12},
            {nom: 'Mine', nombre: 4, pdcRestants: 2, planete: 1},
        ]);
    });

    test('ignore un fichier qui n\'est pas un rapport principal', () => {
        expect(parseConstructionsEnCoursHtml('<html><body>rien</body></html>')).toEqual({nbSystemes: 0, systemes: {}});
    });
});

describe('resoudreConstructionEnCours', () => {
    const tech = (code: string, nom: string, niv: number, type = 0) => ({code, nom, niv, type, base: nom} as unknown as Technologie);
    const technologies = [
        tech('modeI', 'station de produits de luxe', 0),
        tech('modeII', 'station de produits de luxe', 1),
        tech('mineI', 'Mine', 0),
        tech('laserI', 'Laser', 0, 1),
    ];
    const plans = [{nom: 'Colonisateur'} as PlanVaisseau];

    test('bâtiment par son nom complet avec niveau', () => {
        expect(resoudreConstructionEnCours('station de produits de luxe de type II', technologies, plans))
            .toEqual({type: 'building', code: 'modeII'});
        expect(resoudreConstructionEnCours('Station de produits de luxe de type I', technologies, plans))
            .toEqual({type: 'building', code: 'modeI'});
    });

    test('bâtiment à niveau unique affiché sans niveau', () => {
        expect(resoudreConstructionEnCours('Mine', technologies, plans)).toEqual({type: 'building', code: 'mineI'});
    });

    test('vaisseau par le nom du plan, inconnu sinon', () => {
        expect(resoudreConstructionEnCours('Colonisateur', technologies, plans)).toEqual({type: 'ship', code: 'Colonisateur'});
        expect(resoudreConstructionEnCours('Laser', technologies, plans)).toBeUndefined();
        expect(resoudreConstructionEnCours('Inconnu', technologies, plans)).toBeUndefined();
    });
});
