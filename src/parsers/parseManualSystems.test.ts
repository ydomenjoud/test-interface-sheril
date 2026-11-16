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

describe('flottes', () => {
  const flotteJoueur = (over: any) => ({type: 'joueur', proprio: 7, num: 1, nom: 'Garde', pos: {x: 10, y: 20}, nbVso: 4,
    vaisseaux: [], directive: 0, vitesse: 3, as: 150, ap: 100, scan: 0, ...over});
  const avecFlottes = {
    ...rapport,
    systemesJoueur: [systeme({scan: 2})],
    flottesJoueur: [flotteJoueur({}), flotteJoueur({num: 2, nom: 'Sco;ut', pos: {x: 30, y: 30}, as: 0, ap: 0, nbVso: 1})] as any,
    flottesDetectees: [
      {type: 'detecte', num: 5, nom: 'Intrus', pos: {x: 11, y: 21}, nbVso: 3, proprio: 3, puiss: 'petite'},     // à portée
      {type: 'detecte', num: 8, nom: 'Lointaine', pos: {x: 25, y: 25}, nbVso: 9, proprio: 4, puiss: 'moyenne'}, // alliance
    ] as any,
  };

  test('décochées par défaut : aucune ligne flotte', () => {
    expect(exportSystemesJoueur(avecFlottes, {detections: true, detectionsAlliance: true})).not.toMatch(/flotte=/);
  });

  test('mes flottes : puissance en toutes lettres, sans AS ni AP', () => {
    const lignes = exportSystemesJoueur(avecFlottes, {radars: false, typeSystemes: false, typeFlottes: true}).split('\n');
    expect(lignes[0]).toMatch(/: 2 flotte\(s\), à coller/);
    expect(lignes.slice(1)).toEqual([
      'flotte=1; nom=Garde; pos=0_10_20; proprio=7; nbVso=4; puiss=moyenne; tour=7',
      'flotte=2; nom=Sco ut; pos=0_30_30; proprio=7; nbVso=1; puiss=insignifiante; tour=7',
    ]);
  });

  test('flottes détectées réparties entre détections propres et de l’alliance', () => {
    const propres = exportSystemesJoueur(avecFlottes, {systemes: false, radars: false, detections: true, typeSystemes: false, typeFlottes: true});
    expect(propres.split('\n').slice(1)).toEqual(['flotte=5; nom=Intrus; pos=0_11_21; proprio=3; nbVso=3; puiss=petite; tour=7']);
    const alliance = exportSystemesJoueur(avecFlottes, {systemes: false, radars: false, detectionsAlliance: true, typeSystemes: false, typeFlottes: true});
    expect(alliance.split('\n').slice(1)).toEqual(['flotte=8; nom=Lointaine; pos=0_25_25; proprio=4; nbVso=9; puiss=moyenne; tour=7']);
  });

  test('l’import relit les flottes', () => {
    const texte = exportSystemesJoueur(avecFlottes, {radars: false, detections: true, typeFlottes: true});
    const {systems, flottes, errors} = parseManualDetectedSystems(texte);
    expect(errors).toEqual([]);
    expect(systems).toHaveLength(1);
    expect(flottes).toEqual([
      {type: 'detecte', num: 1, nom: 'Garde', pos: {x: 10, y: 20}, nbVso: 4, proprio: 7, puiss: 'moyenne', tour: 7},
      {type: 'detecte', num: 2, nom: 'Sco ut', pos: {x: 30, y: 30}, nbVso: 1, proprio: 7, puiss: 'insignifiante', tour: 7},
      {type: 'detecte', num: 5, nom: 'Intrus', pos: {x: 11, y: 21}, nbVso: 3, proprio: 3, puiss: 'petite', tour: 7},
    ]);
  });

  test('une flotte sans propriétaire est une erreur', () => {
    const {flottes, errors} = parseManualDetectedSystems('flotte=3; pos=0_10_10; tour=7');
    expect(flottes).toEqual([]);
    expect(errors).toHaveLength(1);
  });
});

describe('détections propres', () => {
  const detecte = (nom: string, x: number, y: number, proprietaires: number[] = []) =>
    ({type: 'detecte', nom, pos: {x, y}, typeEtoile: 2, nbPla: 5, proprietaires, pop: 100, popMax: 800, tour: 7} as const);
  const avecDetections = {
    ...rapport,
    systemesJoueur: [systeme({scan: 2})], // radar de système en (10,20), portée 2
    flottesJoueur: [{pos: {x: 40, y: 59}, scan: 3} as any], // scanner de flotte près du bord du tore
    systemesDetectesDuTour: [
      detecte('Proche', 12, 21, [3]),     // à 2 du système : vu par le joueur
      detecte('Loin', 13, 20),            // à 3 du système : vu par un allié seulement
      detecte('Bord', 41, 2, [4]),        // à 3 de la flotte en passant par le bord (60×60)
      detecte('Alpha', 10, 20, [7]),      // système du joueur : déjà dans « Mes systèmes »
    ],
  };

  test('seuls les systèmes à portée des radars du joueur sont exportés', () => {
    const lignes = exportSystemesJoueur(avecDetections, {systemes: false, radars: false, detections: true}).split('\n');
    expect(lignes[0]).toMatch(/: 2 détection\(s\), à coller/);
    expect(lignes.slice(1)).toEqual([
      'nbpla=5; nom=Proche; pop=100; popMax=800; pos=0_12_21; typeEtoile=2; proprios=3; tour=7',
      'nbpla=5; nom=Bord; pop=100; popMax=800; pos=0_41_2; typeEtoile=2; proprios=4; tour=7',
    ]);
  });

  test('détections de l’alliance : celles hors de portée du joueur', () => {
    const lignes = exportSystemesJoueur(avecDetections, {systemes: false, radars: false, detectionsAlliance: true}).split('\n');
    expect(lignes[0]).toMatch(/: 1 détection\(s\) de l'alliance, à coller/);
    expect(lignes.slice(1)).toEqual(['nbpla=5; nom=Loin; pop=100; popMax=800; pos=0_13_20; typeEtoile=2; proprios=; tour=7']);
    const lesDeux = exportSystemesJoueur(avecDetections, {systemes: false, radars: false, detections: true, detectionsAlliance: true});
    expect(lesDeux.split('\n')[0]).toMatch(/: 2 détection\(s\) et 1 détection\(s\) de l'alliance/);
    const {systems, errors} = parseManualDetectedSystems(lesDeux);
    expect(errors).toEqual([]);
    expect(systems.map(s => s.nom)).toEqual(['Proche', 'Bord', 'Loin']);
  });

  test('décochées par défaut, et relues par l’import', () => {
    expect(exportSystemesJoueur(avecDetections)).not.toMatch(/détection/);
    const {systems, errors} = parseManualDetectedSystems(exportSystemesJoueur(avecDetections, {detections: true}));
    expect(errors).toEqual([]);
    expect(systems.map(s => s.nom)).toEqual(['Alpha', 'Proche', 'Bord']);
  });
});
