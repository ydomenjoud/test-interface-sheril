import { FlotteDetectee, FlotteJoueur, Rapport, SystemeDetecte, SystemeJoueur } from '../types';
import { parsePosString } from '../utils/position';

function getAttr(el: Element | null | undefined, names: string[]): string | undefined {
  if (!el) return undefined;
  for (const n of names) {
    const v = el.getAttribute(n);
    if (v != null) return v;
  }
  return undefined;
}

function getAttrNum(el: Element | null | undefined, names: string[]): number | undefined {
  const v = getAttr(el, names);
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function qOne(root: ParentNode | null | undefined, selectors: string[]): Element | null {
  if (!root) return null;
  for (const s of selectors) {
    const el = (root as ParentNode).querySelector(s);
    if (el) return el as Element;
  }
  return null;
}

function qAll(root: ParentNode | null | undefined, selectors: string[]): Element[] {
  if (!root) return [];
  const out: Element[] = [];
  for (const s of selectors) {
    const list = (root as ParentNode).querySelectorAll(s);
    if (list && list.length) out.push(...Array.from(list) as Element[]);
  }
  return out;
}

export function parseRapportXml(text: string): Rapport {
  const doc = new DOMParser().parseFromString(text, 'text/xml');

  const rapportNode = qOne(doc, ['Rapport', 'rapport', 'RAPPORT']);
  const joueurNode = qOne(rapportNode, ['Commandant', 'commandant', 'COMMANDANT']);

  const joueur = {
    nom: getAttr(joueurNode, ['nom', 'Nom', 'NOM']),
    raceId: getAttrNum(joueurNode, ['race', 'Race', 'RACE']),
    reputation: getAttr(joueurNode, ['reputation', 'Reputation', 'REPUTATION']),
    statut: getAttr(joueurNode, ['statut', 'Statut', 'STATUT']),
    puissance: getAttrNum(joueurNode, ['puissance', 'Puissance', 'PUISSANCE']),
    argent: getAttrNum(joueurNode, ['argent', 'Argent', 'ARGENT']),
    capitale: (() => {
      const cap =
        getAttr(joueurNode, ['pos', 'POS']) ??
        getAttr(qOne(joueurNode, ['capitale', 'CAPITALE']), ['pos', 'POS']);
      return cap ? parsePosString(cap) : undefined;
    })(),
    alliances: [],
    pna: [],
  };

  // Systèmes du joueur
  const systemesJoueur: SystemeJoueur[] = [];
  const sysNodes = qAll(joueurNode, [
    'systemes > S',
    'Systemes > S',
    'SYSTEMES > S',
    'systemes > Systeme',
    'Systemes > Systeme',
    'SYSTEMES > SYSTEME',
  ]);
  sysNodes.forEach((s) => {
    const pos = parsePosString(getAttr(s, ['pos', 'POS']) || '0_1_1');
    const nom = getAttr(s, ['nom', 'Nom', 'NOM']) || 'Système';
    const typeEtoile = getAttrNum(s, ['typeEtoile', 'typeetoile', 'TYPEETOILE']) ?? 1;
    const nombrePla = getAttrNum(s, ['nombrePla', 'nbPla', 'NOMBREPLA', 'NBPLA']) ?? 0;

    const proprietaires: number[] = [];
    qAll(s, ['PROPRIO', 'Proprio', 'proprio']).forEach((p) => {
      const v = Number((p.textContent || '').trim());
      if (!Number.isNaN(v)) proprietaires.push(v);
    });

    const planetes: any[] = [];
    const pNodes = qAll(s, [
      'PLANETES > P',
      'Planetes > P',
      'PLANETES > Planete',
      'Planetes > Planete',
      'planetes > p',
    ]);
    pNodes.forEach((p) => {
      const num = getAttrNum(p, ['num', 'Num', 'NUM']) ?? 0;
      const pdc = getAttrNum(p, ['pdc', 'PDC']) ?? 0;
      const proprietaire = getAttrNum(p, ['prop', 'Prop', 'PROP']);
      const minerai = getAttrNum(p, ['stockmin', 'StockMin', 'STOCKMIN']) ?? getAttrNum(p, ['minerai', 'Minerai', 'MINERAI']);

      const batiments: { techCode: string; count: number }[] = [];
      const batNodes = [
        ...qAll(p, ['BAT', 'Bat', 'bat']),
        ...qAll(p, ['BATIMENT', 'Batiment', 'batiment']),
        ...qAll(p, ['BATS > BAT', 'Bats > Bat']),
      ];
      batNodes.forEach((b) => {
        const techCode = getAttr(b, ['code', 'CODE', 'tech', 'TECH']) || '';
        const countStr =
          getAttr(b, ['nb', 'NB', 'count', 'COUNT']) || (b.textContent || '0').trim();
        const count = Number(countStr);
        if (techCode && !Number.isNaN(count) && count > 0) {
          batiments.push({ techCode, count });
        }
      });

      const populations: { raceId: number; nb: number }[] = [];
      const popNodes = [
        ...qAll(p, ['POP', 'Pop', 'pop']),
        ...qAll(p, ['POPULATION', 'Population', 'population']),
      ];
      popNodes.forEach((pop) => {
        const raceStr = getAttr(pop, ['race', 'RACE', 'code', 'CODE']) || (pop.textContent || '').trim();
        const nbStr = getAttr(pop, ['nb', 'NB', 'count', 'COUNT']) || '0';
        const raceId = Number(raceStr);
        const nb = Number(nbStr);
        if (!Number.isNaN(raceId) && !Number.isNaN(nb) && nb > 0) {
          populations.push({ raceId, nb });
        }
      });

      planetes.push({
        num,
        pdc,
        proprietaire,
        minerai,
        batiments,
        populations,
      });
    });

    systemesJoueur.push({
      type: 'joueur',
      nom,
      pos,
      typeEtoile,
      nombrePla,
      proprietaires,
      planetes,
    });
  });

  // Systèmes détectés
  const systemesDetectes: SystemeDetecte[] = [];
  const sysDetNodes = qAll(joueurNode, [
    'detection > SYSTEME',
    'Detection > SYSTEME',
    'DETECTION > SYSTEME',
    'detection > Systeme',
    'Detection > Systeme',
  ]);
  sysDetNodes.forEach((s) => {
    const pos = parsePosString(getAttr(s, ['pos', 'POS']) || '0_1_1');
    const nom = getAttr(s, ['nom', 'Nom', 'NOM']) || 'Système';
    const typeEtoile = getAttrNum(s, ['typeEtoile', 'typeetoile', 'TYPEETOILE']) ?? 1;
    const nbPla = getAttrNum(s, ['nbPla', 'nombrePla', 'NBPLA', 'NOMBREPLA']) ?? 0;
    const proprietaires: number[] = [];
    qAll(s, ['PROPRIO', 'Proprio', 'proprio']).forEach((p) => {
      const v = Number((p.textContent || '').trim());
      if (!Number.isNaN(v)) proprietaires.push(v);
    });
    systemesDetectes.push({ type: 'detecte', nom, pos, typeEtoile, nbPla, proprietaires });
  });

  // Flottes du joueur
  const flottesJoueur: FlotteJoueur[] = [];
  const fltNodes = qAll(joueurNode, [
    'flottes > F',
    'Flottes > F',
    'FLOTTES > F',
    'flottes > Flotte',
    'Flottes > Flotte',
  ]);
  fltNodes.forEach((f) => {
    const pos = parsePosString(getAttr(f, ['pos', 'POS']) || '0_1_1');
    const nom = getAttr(f, ['nom', 'Nom', 'NOM']) || 'Flotte';
    const num = getAttrNum(f, ['num', 'Num', 'NUM']) ?? 0;
    const vaisseaux: { type: string; plan: string; nb?: number; puissance?: string }[] = [];
    qAll(f, ['VAISSEAU', 'Vaisseau', 'vaisseau']).forEach((v) => {
      vaisseaux.push({
        type: getAttr(v, ['type', 'TYPE']) || getAttr(v, ['plan', 'PLAN']) || 'Vaisseau',
        plan: getAttr(v, ['plan', 'PLAN']) || '',
      });
    });
    flottesJoueur.push({ type: 'joueur', num, nom, pos, vaisseaux });
  });

  // Flottes détectées
  const flottesDetectees: FlotteDetectee[] = [];
  const fltDetNodes = qAll(joueurNode, [
    'detection > FLOTTE',
    'Detection > FLOTTE',
    'DETECTION > FLOTTE',
    'detection > Flotte',
  ]);
  fltDetNodes.forEach((f) => {
    const pos = parsePosString(getAttr(f, ['pos', 'POS']) || '0_1_1');
    flottesDetectees.push({
      type: 'detecte',
      num: getAttrNum(f, ['num', 'Num', 'NUM']) ?? 0,
      nom: getAttr(f, ['nom', 'Nom', 'NOM']) || 'Flotte',
      pos,
      proprio: getAttrNum(f, ['proprio', 'Proprio', 'PROPRIO']) ?? 0,
      puiss: getAttr(f, ['puiss', 'Puiss', 'PUISS']) || 'inconnue',
    });
  });

  return {
    joueur,
    systemesJoueur,
    systemesDetectes,
    flottesJoueur,
    flottesDetectees,
  };
}

export default parseRapportXml;
