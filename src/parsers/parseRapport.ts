import {Alliance, FlotteDetectee, FlotteJoueur, Rapport, SystemeDetecte, SystemeJoueur} from '../types';
import {isPos, parsePosString} from '../utils/position';

function getAttr(el: Element | null | undefined, names: string[]): string  {
    if (!el) return '';
    for (const n of names) {
        const v = el.getAttribute(n);
        if (v != null) return v;
    }
    return '';
}

function getAttrNum(el: Element | null | undefined, names: string[]): number {
    const v = getAttr(el, names);
    if (v == null || v === '') return 0;
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
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

    // Nœuds racines strictement en lowercase
    const rapportNode = qOne(doc, ['rapport']);
    const joueurNode = qOne(rapportNode, ['commandant']);

    const joueur: Rapport['joueur'] = {
        numero: getAttrNum(joueurNode, ['numero']),
        nom: getAttr(joueurNode, ['nom']),
        raceId: getAttrNum(joueurNode, ['race']),
        reputation: getAttr(joueurNode, ['reputation']),
        statut: getAttr(joueurNode, ['statut']),
        puissance: getAttrNum(joueurNode, ['puissance']),
        argent: getAttrNum(joueurNode, ['argent']),
        capitale: (() => {
            const cap = getAttr(joueurNode, ['capitale']);
            return cap ? parsePosString(cap) : {x: 1, y: 1};
        })(),
        alliances: [],
        pna: [],
    };


    // Technologies connues (lowercase)
    const technologiesConnues: string[] = [];
    qAll(joueurNode, ['technologies > connue']).forEach((n) => {
        const code = getAttr(n, ['code']);
        if (code) technologiesConnues.push(code);
    });

    // Systèmes du joueur (lowercase only)
    const systemesJoueur: SystemeJoueur[] = [];
    const sysNodes = qAll(joueurNode, ['systemes > s',]);
    sysNodes.forEach((s) => {
        const pos = parsePosString(getAttr(s, ['pos']) || '0_1_1');
        const nom = getAttr(s, ['nom']) || 'Système';
        const rawStar = getAttrNum(s, ['typeEtoile']) ?? getAttrNum(s, ['type']);
        const typeEtoile = (rawStar ?? 0);
        const nbPla = getAttrNum(s, ['nbpla']) ?? getAttrNum(s, ['nbpla']) ?? 0;

        const proprietaires: number[] = [joueur.numero || 0];

        const planetes: any[] = [];
        const pNodes = qAll(s, ['planetes > p',]);
        pNodes.forEach((p) => {
            const num = getAttrNum(p, ['num']) ?? 0;
            const pdc = getAttrNum(p, ['pdc']) ?? 0;
            const proprietaire = getAttrNum(p, ['prop']);
            const minerai = getAttrNum(p, ['stockmin']) ?? getAttrNum(p, ['minerai']);

            const batiments: { techCode: string; count: number }[] = [];
            const batNodes = [...qAll(p, ['batiment']), ...qAll(p, ['bat']), ...qAll(p, ['bats > bat']),];
            batNodes.forEach((b) => {
                const techCode = getAttr(b, ['code']) || getAttr(b, ['tech']) || '';
                const countStr = getAttr(b, ['nombre']) || getAttr(b, ['nb']) || getAttr(b, ['count']) || (b.textContent || '0').trim();
                const count = Number(countStr);
                if (techCode && !Number.isNaN(count) && count > 0) {
                    batiments.push({techCode, count});
                }
            });

            const populations: { raceId: number; nb: number }[] = [];
            const popNodes = [...qAll(p, ['pop']), ...qAll(p, ['population']),];
            popNodes.forEach((pop) => {
                const raceStr = getAttr(pop, ['race']) || getAttr(pop, ['code']) || (pop.textContent || '').trim();
                // nb peut être dans nb, count, ou popact (cas fréquent)
                const nbStr = getAttr(pop, ['nb']) || getAttr(pop, ['count']) || getAttr(pop, ['popact']) || '0';
                const raceId = Number(raceStr);
                const nb = Number(nbStr);
                if (!Number.isNaN(raceId) && !Number.isNaN(nb) && nb > 0) {
                    populations.push({raceId, nb});
                }
            });

            planetes.push({
                num, pdc, proprietaire, minerai, batiments, populations,
            });
        });

        systemesJoueur.push({
            type: 'joueur',
            nom,
            pos,
            typeEtoile,
            nbPla,
            proprietaires,
            scan: getAttrNum(s, ['hscan']),
            planetes, // attributs additionnels présents sur les systèmes du joueur
            politique: getAttrNum(s, ['politique']),
            entretien: getAttrNum(s, ['entretien']),
            revenu: getAttrNum(s, ['revenu']),
            bcont: getAttrNum(s, ['bcont']),
            besp: getAttrNum(s, ['besp']),
            btech: getAttrNum(s, ['btech']),
        });
    });

    // Systèmes détectés (lowercase only)
    const systemesDetectes: SystemeDetecte[] = [];
    let sysDetNodes = qAll(joueurNode, ['detections > systeme']);
    sysDetNodes.forEach((s) => {
        const pos = parsePosString(getAttr(s, ['pos']) || '0_1_1');
        const nom = getAttr(s, ['nom']) || 'Système';
        const rawStar = getAttrNum(s, ['typeEtoile']) ?? getAttrNum(s, ['type']);
        const typeEtoile = rawStar ?? 0;
        const nbPla = getAttrNum(s, ['nbpla']) ?? getAttrNum(s, ['nbpla']) ?? 0;
        const proprietaires: number[] = [];
        qAll(s, ['proprio']).forEach((p) => {
            const v = Number((p.textContent || '').trim());
            if (!Number.isNaN(v)) proprietaires.push(v);
        });
        systemesDetectes.push({type: 'detecte', nom, pos, typeEtoile, nbPla, proprietaires});
    });

    // Flottes du joueur (lowercase only)
    const flottesJoueur: FlotteJoueur[] = [];
    const fltNodes = qAll(joueurNode, ['flottes > f', 'flottes > flotte']);
    fltNodes.forEach((f) => {
        const pos = parsePosString(getAttr(f, ['pos']) || '0_1_1');
        const nom = getAttr(f, ['nom']) || 'Flotte';
        const num = getAttrNum(f, ['num']) ?? 0;
        const vaisseaux: { type: string; plan: string; nb?: number; puissance?: string }[] = [];
        qAll(f, ['vaisseau']).forEach((v) => {
            vaisseaux.push({
                type: getAttr(v, ['type']) || getAttr(v, ['plan']) || 'Vaisseau', plan: getAttr(v, ['plan']) || '',
            });
        });
        const direction = getAttr(f, ['direction']);
        flottesJoueur.push({
            type: 'joueur', proprio: joueur.numero,
            num, nom, pos, vaisseaux,
            nbVso: vaisseaux.length,
            scan: getAttrNum(f, ['hscan']),
            as: getAttrNum(f, ['as']) ?? 0,
            ap: getAttrNum(f, ['ap']) ?? 0,
            directive: getAttrNum(f, ['directive'])|| 0,
            vitesse: getAttrNum(f, ['vitesse'])|| 0,
            direction: isPos(direction) ? parsePosString(direction) : undefined
        });
    });

    // Flottes détectées (lowercase only)
    const flottesDetectees: FlotteDetectee[] = [];
    let fltDetNodes = qAll(joueurNode, ['detections > flotte']);
    fltDetNodes.forEach((f) => {
        const pos = parsePosString(getAttr(f, ['pos']) || '0_1_1');
        flottesDetectees.push({
            type: 'detecte',
            num: getAttrNum(f, ['num']) ?? 0,
            nom: getAttr(f, ['nom']) || 'Flotte',
            pos,
            nbVso: getAttrNum(f, ['nbvso']) ?? 0,
            proprio: getAttrNum(f, ['proprio']) ?? 0,
            puiss: getAttr(f, ['puiss']) || 'inconnue',
        });
    });

    const alliances: Alliance[] = [];
    let allianceNode = qAll(joueurNode, ['alliance']);
    allianceNode.forEach((a) => {
        alliances.push({
            createur: Number(getAttr(a, ['createur'])) || 0,
            nom: getAttr(a, ['nom']) || 'introuvable',
            commandants: qAll(a, ['com']).map(c => Number(getAttr(c, ['num'])) || 0),
            dirigeant: Number(getAttr(a, ['createur'])) || 0,
            droits: Number(getAttr(a, ['droits'])) || 0
        })
    });

    joueur.alliances = alliances;

    const rapport: Rapport = {
        technologiesConnues, joueur, systemesJoueur, systemesDetectes, flottesJoueur, flottesDetectees,
    };

    console.log('RAPPORT', rapport)

    return rapport;
}

export default parseRapportXml;
