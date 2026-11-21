import {avecFlottesImportees, fusionnerFlottesImportees, FlotteImportee} from './flottesImporteesStorage';

const flotte = (over: Partial<FlotteImportee>): FlotteImportee =>
  ({type: 'detecte', num: 1, nom: 'F', pos: {x: 1, y: 1}, nbVso: 2, proprio: 3, puiss: 'petite', tour: 5, ...over});

describe('flottes importées', () => {
  test('même tour, propriétaire et numéro : remplacée', () => {
    const fusion = fusionnerFlottesImportees([flotte({}), flotte({tour: 4})], [flotte({nom: 'G'})]);
    expect(fusion.map(f => `${f.tour}:${f.nom}`)).toEqual(['4:F', '5:G']);
  });

  test('ajoutées au rapport de leur tour seulement, sans doublon', () => {
    const r = {tour: 5, flottesJoueur: [] as any[], flottesDetectees: [flotte({num: 2, tour: undefined}) as any]};
    const res = avecFlottesImportees(r, [flotte({}), flotte({num: 2}), flotte({num: 9, tour: 4})]);
    expect(res.flottesDetectees.map(f => f.num)).toEqual([2, 1]);
    expect((res.flottesDetectees[1] as any).tour).toBeUndefined();
    expect(avecFlottesImportees(r, [])).toBe(r);
  });
});
