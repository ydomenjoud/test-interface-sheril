import {exportSystemesJoueur, parseManualDetectedSystems} from './parseManualSystems';
import {SystemeJoueur} from '../types';

const systeme = (over: Partial<SystemeJoueur>): SystemeJoueur => ({
  type: 'joueur', nom: 'Alpha', pos: {x: 10, y: 20}, typeEtoile: 3, nbPla: 16, proprietaires: [7],
  planetes: [], revenuEstime: 0, scan: 0, evostab: [], pop: 12000, popMax: 40000,
  ...over,
});

const rapport = {
  tour: 7,
  joueur: {numero: 7, nom: 'Exemplar'} as any,
  systemesJoueur: [
    systeme({}),
    systeme({nom: 'Be;ta', pos: {x: 12, y: 22}, nbPla: 17, proprietaires: [0, 7, 9], pop: 900, popMax: undefined}),
  ],
};

describe('exportSystemesJoueur', () => {
  test('une ligne par système, après un en-tête commentaire', () => {
    const lignes = exportSystemesJoueur(rapport).split('\n');
    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toMatch(/^# Systèmes de Exemplar \(n°7\), tour 7 : 2 système\(s\)/);
    expect(lignes[1]).toBe('nbpla=16; nom=Alpha; pop=12000; popMax=40000; pos=0_10_20; typeEtoile=3; proprios=7; tour=7');
  });

  test('neutre retiré des propriétaires, « ; » retiré du nom', () => {
    const ligne = exportSystemesJoueur(rapport).split('\n')[2];
    expect(ligne).toBe('nbpla=17; nom=Be ta; pop=900; pos=0_12_22; typeEtoile=3; proprios=7,9; tour=7');
  });

  test('l’import relit le texte exporté à l’identique', () => {
    const {systems, errors} = parseManualDetectedSystems(exportSystemesJoueur(rapport));
    expect(errors).toEqual([]);
    expect(systems).toEqual([
      {type: 'detecte', nom: 'Alpha', pos: {x: 10, y: 20}, typeEtoile: 3, nbPla: 16, proprietaires: [7], pop: 12000, popMax: 40000, tour: 7},
      {type: 'detecte', nom: 'Be ta', pos: {x: 12, y: 22}, typeEtoile: 3, nbPla: 17, proprietaires: [7, 9], pop: 900, tour: 7},
    ]);
  });
});

describe('parseManualDetectedSystems', () => {
  test('format d’origine sans tour : pas de tour (le rapport chargé le fournit)', () => {
    const {systems} = parseManualDetectedSystems('nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1');
    expect(systems[0].tour).toBeUndefined();
    expect(systems[0].proprietaires).toEqual([1, 4]);
    expect(systems[0].pop).toBe(3475);
  });
});

describe('radars des alliés', () => {
  const avecRadars = {
    ...rapport,
    systemesJoueur: [systeme({scan: 2}), systeme({nom: 'Gamma', pos: {x: 14, y: 25}, scan: 0})],
    flottesJoueur: [{pos: {x: 16, y: 30}, scan: 1} as any, {pos: {x: 18, y: 5}, scan: 0} as any],
  };

  test('l’export ajoute une ligne par système ou flotte qui a un radar', () => {
    const lignes = exportSystemesJoueur(avecRadars).split('\n');
    expect(lignes[0]).toMatch(/2 système\(s\) et 2 radar\(s\)/);
    expect(lignes.slice(3)).toEqual([
      'radar=2; pos=0_10_20; cdt=7; tour=7',
      'radar=1; pos=0_16_30; cdt=7; tour=7',
    ]);
  });

  test('l’import sépare les radars des systèmes', () => {
    const {systems, radars, errors} = parseManualDetectedSystems(exportSystemesJoueur(avecRadars));
    expect(errors).toEqual([]);
    expect(systems).toHaveLength(2);
    expect(radars).toEqual([
      {cdt: 7, pos: {x: 10, y: 20}, scan: 2, tour: 7},
      {cdt: 7, pos: {x: 16, y: 30}, scan: 1, tour: 7},
    ]);
  });

  test('cases à cocher : systèmes seuls, radars seuls, rien', () => {
    const systemesSeuls = exportSystemesJoueur(avecRadars, {radars: false}).split('\n');
    expect(systemesSeuls[0]).toMatch(/: 2 système\(s\), à coller/);
    expect(systemesSeuls.some(l => l.startsWith('radar='))).toBe(false);
    const radarsSeuls = exportSystemesJoueur(avecRadars, {systemes: false}).split('\n');
    expect(radarsSeuls[0]).toMatch(/: 2 radar\(s\), à coller/);
    expect(radarsSeuls.slice(1).every(l => l.startsWith('radar='))).toBe(true);
    expect(exportSystemesJoueur(avecRadars, {systemes: false, radars: false})).toBe('');
  });

  test('un radar sans commandant est une erreur', () => {
    const {radars, errors} = parseManualDetectedSystems('radar=3; pos=0_10_10; tour=7');
    expect(radars).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});
