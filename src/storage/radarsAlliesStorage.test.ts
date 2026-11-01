import {fusionnerRadarsAllies, loadRadarsAllies, saveRadarsAllies} from './radarsAlliesStorage';

const r = (cdt: number, x: number, tour = 7) => ({cdt, pos: {x, y: 1}, scan: 2, tour});

describe('radars des alliés : stockage', () => {
  afterEach(() => localStorage.clear());

  test('un nouvel import d’un commandant remplace ses anciens radars, garde ceux des autres', () => {
    const fusion = fusionnerRadarsAllies([r(5, 1, 6), r(5, 2, 6), r(9, 3)], [r(5, 10)]);
    expect(fusion).toEqual([r(9, 3), r(5, 10)]);
  });

  test('sauvegarde et relecture ; liste vide = clé retirée', () => {
    saveRadarsAllies([r(5, 1)]);
    expect(loadRadarsAllies()).toEqual([r(5, 1)]);
    saveRadarsAllies([]);
    expect(localStorage.getItem('carte_radars_allies')).toBeNull();
    expect(loadRadarsAllies()).toEqual([]);
  });

  test('contenu illisible : liste vide', () => {
    localStorage.setItem('carte_radars_allies', '{pas du json');
    expect(loadRadarsAllies()).toEqual([]);
  });
});
