import {Alliance, FlotteDetectee, FlotteJoueur, Rapport, SystemeDetecte, SystemeJoueur, PlanVaisseau} from '../types';
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

// Cache module-level pour conserver les systèmes détectés entre les chargements de rapports
let __detectedSystemsCache: Map<string, SystemeDetecte> = new Map();

// Persistance LocalStorage (désactivée durant les tests pour éviter la pollution du runner)
const LS_KEY_DETECTEDS = 'sheril_detected_systems_v1';
function canUseLocalStorage(): boolean {
    // jsdom expose window/localStorage en test, mais on désactive explicitement en test
    // pour éviter des interactions entre tests
    try {
        // @ts-ignore
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'test') return false;
        if (typeof window === 'undefined' || !('localStorage' in window)) return false;
        return true;
    } catch {
        return false;
    }
}

function loadDetectedFromLS(): Map<string, SystemeDetecte> {
    if (!canUseLocalStorage()) return new Map();
    try {
        const raw = window.localStorage.getItem(LS_KEY_DETECTEDS);
        if (!raw) return new Map();
        const arr = JSON.parse(raw) as any[];
        if (!Array.isArray(arr)) return new Map();
        const m = new Map<string, SystemeDetecte>();
        for (const it of arr) {
            if (!it || !it.pos || typeof it.pos.x !== 'number' || typeof it.pos.y !== 'number') continue;
            const key = `${it.pos.x}_${it.pos.y}`;
            // Reconstituer l'objet en s'assurant des champs attendus
            const sd: SystemeDetecte = {
                type: 'detecte',
                nom: String(it.nom || 'Système'),
                pos: { x: Number(it.pos.x), y: Number(it.pos.y) },
                typeEtoile: Number(it.typeEtoile || 0),
                nbPla: Number(it.nbPla || 0),
                proprietaires: Array.isArray(it.proprietaires) ? it.proprietaires.map((n: any) => Number(n)).filter((n: any) => !Number.isNaN(n)) : [],
                politique: typeof it.politique === 'number' ? it.politique : undefined,
                entretien: typeof it.entretien === 'number' ? it.entretien : undefined,
                revenu: typeof it.revenu === 'number' ? it.revenu : undefined,
                bcont: typeof it.bcont === 'number' ? it.bcont : undefined,
                besp: typeof it.besp === 'number' ? it.besp : undefined,
                btech: typeof it.btech === 'number' ? it.btech : undefined,
            };
            m.set(key, sd);
        }
        return m;
    } catch {
        return new Map();
    }
}

function saveDetectedToLS(map: Map<string, SystemeDetecte>): void {
    if (!canUseLocalStorage()) return;
    try {
        const arr = Array.from(map.values());
        window.localStorage.setItem(LS_KEY_DETECTEDS, JSON.stringify(arr));
    } catch {
        // ignore
    }
}

// Charger l'état depuis le localStorage au chargement du module
(() => {
    try {
        const fromLS = loadDetectedFromLS();
        if (fromLS.size) {
            __detectedSystemsCache = fromLS;
        }
    } catch {
        // ignore
    }
})();

const keyOf = (sd: Pick<SystemeDetecte, 'pos'>) => `${sd.pos.x}_${sd.pos.y}`;

// Ajout manuel de systèmes détectés (persistance + cache)
export function addManualDetectedSystems(systems: SystemeDetecte[]) {
    if (!systems || systems.length === 0) return;
    const merged = new Map(__detectedSystemsCache);
    systems.forEach(sd => {
        merged.set(keyOf(sd), sd);
    });
    __detectedSystemsCache = merged;
    try { saveDetectedToLS(merged); } catch { /* ignore */ }
}

export function getCachedDetectedSystems(): SystemeDetecte[] {
    return Array.from(__detectedSystemsCache.values());
}

export function parseRapportXml(text: string): Rapport {
    const doc = new DOMParser().parseFromString(text, 'text/xml');

    // Nœuds racines strictement en lowercase
    const rapportNode = qOne(doc, ['rapport']);
    const joueurNode = qOne(rapportNode, ['commandant']);
    const tour = getAttrNum(rapportNode, ['numTour', 'numtour']);

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

    // Technologies connues (lowercase)
    const technologiesAtteignables: string[] = [];
    qAll(joueurNode, ['technologies > atteignable']).forEach((n) => {
        const code = getAttr(n, ['code']);
        if (code) technologiesAtteignables.push(code);
    });


    // Systèmes du joueur (lowercase only)
    const systemesJoueur: SystemeJoueur[] = [];
    const sysNodes = qAll(joueurNode, ['systemes > s',]);
    sysNodes.forEach((s) => {
        const pos = parsePosString(getAttr(s, ['pos']) || '0_1_1');
        const nom = getAttr(s, ['nom']) || 'Système';
        const rawStar = getAttrNum(s, ['typeEtoile', 'typeetoile', 'type']);
        const typeEtoile = (rawStar ?? 0);
        const nbPla = getAttrNum(s, ['nbpla', 'nombrepla']) ?? 0;

        const proprietaires: Set<number> = new Set();

        const planetes: any[] = [];
        let revenuEstime = 0;
        const pNodes = qAll(s, ['planetes > p',]);
        pNodes.forEach((p) => {
            const proprietaire = getAttrNum(p, ['prop']);
            proprietaires.add(proprietaire);
            if (proprietaire === joueur.numero) {
                const tax = getAttrNum(p, ['tax']);
                const popNode = qOne(p, ['population']);
                if (popNode) {
                    const popAct = getAttrNum(popNode, ['popAct']);
                    const popMax = getAttrNum(popNode, ['popMax']);
                    const popAug = getAttrNum(popNode, ['popAug']);
                    revenuEstime += Math.min(popAct + Math.floor(popAct * popAug / 100), popMax) * tax / 10;
                }
            }

            const num = getAttrNum(p, ['num']) ?? 0;
            const pdc = getAttrNum(p, ['pdc']) ?? 0;
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

            const populations: { raceId: number; nb: number, growth: number, max: number }[] = [];
            const popNodes = [...qAll(p, ['pop']), ...qAll(p, ['population']),];
            popNodes.forEach((pop) => {
                const raceStr = getAttr(pop, ['race']) || getAttr(pop, ['code']) || (pop.textContent || '').trim();
                // nb peut être dans nb, count, ou popact (cas fréquent)
                const nbStr = getAttr(pop, ['nb']) || getAttr(pop, ['count']) || getAttr(pop, ['popAct']) || '0';
                const raceId = Number(raceStr);
                const nb = Number(nbStr);
                const growth = Number(getAttr(pop, ['popAug']) || '0');
                const max = Number(getAttr(pop, ['popMax']) || '0');

                if (!Number.isNaN(raceId) && !Number.isNaN(nb) && nb > 0) {
                    populations.push({ raceId, nb, max, growth });
                }
            });
            const tax = getAttrNum(p, ['tax']) ?? 0;

            const atmosphere = getAttrNum(p, ['atm']) ?? 0;
            const gravity = getAttrNum(p, ['grav']) ?? 0;
            const radiation = getAttrNum(p, ['rad']) ?? 0;
            const temperature = getAttrNum(p, ['temp']) ?? 0;
            const terraformation = getAttrNum(p, ['terra']) ?? 0;
            const size = getAttrNum(p, ['tai']) ?? 0;


            planetes.push({
                num,
                pdc,
                proprietaire,
                minerai,
                batiments,
                populations,
                tax,
                atmosphere,
                gravity,
                radiation,
                temperature,
                terraformation,
                size
            });
        });

        // si il était présent avant dans les détections, et qu'il possédé maintenant, on le supprime
        const key = keyOf({pos});
        if(__detectedSystemsCache.has(key)) {
            __detectedSystemsCache.delete(key)
        }

        const sortedProprietaires = Array.from(proprietaires).sort((a, b) => a - b);
        systemesJoueur.push({
            type: 'joueur',
            nom,
            pos,
            typeEtoile,
            nbPla,
            proprietaires: sortedProprietaires,
            scan: getAttrNum(s, ['hscan']),
            planetes, // attributs additionnels présents sur les systèmes du joueur
            politique: getAttrNum(s, ['politique']),
            entretien: getAttrNum(s, ['entretien']),
            revenu: getAttrNum(s, ['revenu']),
            revenuEstime,
            bcont: getAttrNum(s, ['bcont']),
            besp: getAttrNum(s, ['besp']),
            btech: getAttrNum(s, ['btech']),
        });
    });

    // Systèmes détectés (lowercase only)
    const systemesDetectes: SystemeDetecte[] = [];
    let sysDetNodes = qAll(joueurNode, ['detections > systeme', 'detection > systeme']);
    sysDetNodes.forEach((s) => {
        const pos = parsePosString(getAttr(s, ['pos']) || '0_1_1');
        const nom = getAttr(s, ['nom']) || 'Système';
        const rawStar = getAttrNum(s, ['typeEtoile', 'typeetoile', 'type']);
        const typeEtoile = rawStar ?? 0;
        const nbPla = getAttrNum(s, ['nbpla', 'nombrepla']) ?? 0;
        const proprietaires: number[] = [];
        qAll(s, ['proprio']).forEach((p) => {
            const v = Number((p.textContent || '').trim());
            if (!Number.isNaN(v)) proprietaires.push(v);
        });
        const sortedProprietaires = Array.from(proprietaires).sort((a, b) => a - b);
        systemesDetectes.push({type: 'detecte', nom, pos, typeEtoile, nbPla, proprietaires: sortedProprietaires});
    });

    // Fusionner avec le cache précédent (clé = position)
    const mergedMap: Map<string, SystemeDetecte> = new Map(__detectedSystemsCache);
    systemesDetectes.forEach(sd => {
        mergedMap.set(keyOf(sd), sd);
    });
    const mergedSystemesDetectes: SystemeDetecte[] = Array.from(mergedMap.values());
    __detectedSystemsCache = mergedMap;
    // Sauvegarder dans le localStorage (si disponible)
    try { saveDetectedToLS(mergedMap); } catch { /* ignore */ }

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
    let fltDetNodes = qAll(joueurNode, ['detections > flotte', 'detection > flotte']);
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

    // Plans privés du commandant
    const plansVaisseaux: PlanVaisseau[] = [];
    qAll(joueurNode, ['plans > p']).forEach((p) => {
        const nom = getAttr(p, ['nom']) || 'Plan';
        const concepteur = getAttrNum(p, ['concepteur']) || 0;
        const marque = getAttr(p, ['marque']) || undefined;
        const tour = getAttrNum(p, ['tour']) || undefined;
        const taille = getAttrNum(p, ['taille']) || undefined;
        const vitesse = getAttrNum(p, ['vitesse']) || undefined;
        const pc = getAttrNum(p, ['pc']) || undefined;
        const minerai = getAttrNum(p, ['minerai']) || undefined;
        const prix = getAttrNum(p, ['centaures', 'prix']) || undefined;
        const ap = getAttrNum(p, ['ap']) || undefined;
        const as = getAttrNum(p, ['as']) || undefined;
        const royalties = getAttrNum(p, ['royalties']) || undefined;

        const composants = qAll(p, ['comp']).map((c) => ({
            code: getAttr(c, ['code']) || '',
            nb: getAttrNum(c, ['nb']) || 0,
        }));

        plansVaisseaux.push({
            nom, concepteur, marque, tour, taille, vitesse, pc, minerai, prix, ap, as, royalties, composants,
        });
    });

    // Budget technologique (valeur absolue)
    let budgetTechnologique = 0;
    const budgetsNode = qOne(joueurNode, ['budgets']);
    qAll(budgetsNode, ['b']).forEach((b) => {
        if ((getAttr(b, ['type']) || '').toLowerCase() === 'budget technologique') {
            budgetTechnologique = Math.abs(getAttrNum(b, ['valeur']));
        }
    });

    const rapport: Rapport = {
        tour,
        technologiesAtteignables,
        technologiesConnues, joueur, systemesJoueur, systemesDetectes: mergedSystemesDetectes, flottesJoueur, flottesDetectees, plansVaisseaux,
        budgetTechnologique,
    };

    return rapport;
}

export default parseRapportXml;
