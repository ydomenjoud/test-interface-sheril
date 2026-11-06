import {PlanVaisseau, Technologie} from '../types';
import {toRoman} from '../utils/global';

// Constructions en cours d'un système, lues dans le rapport HTML (principal.htm).
// Le rapport XML ne les contient pas : voir docs/constructions-en-cours.md.
export type ConstructionEnCours = {
    nom: string;          // nom complet du bâtiment (« station de produits de luxe de type I ») ou nom du plan
    nombre: number;       // nombre d'unités restant à sortir
    pdcRestants: number;  // points de construction encore nécessaires pour tout le lot
    planete?: number;     // numéro de planète (0-based) ; absent = « Non précisé »
};

export type ConstructionsEnCoursHtml = {
    commandant?: number;                              // numéro lu dans le titre « Rapport du commandant Nom (23) »
    nbSystemes: number;                               // systèmes rencontrés (0 : ce n'est pas principal.htm)
    systemes: Record<string, ConstructionEnCours[]>;  // clé x_y
};

const texte = (el: Element | null | undefined) =>
    (el?.textContent || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

const TITRE_SECTION = 'constructions en cours';

export function parseConstructionsEnCoursHtml(html: string): ConstructionsEnCoursHtml {
    const out: ConstructionsEnCoursHtml = {nbSystemes: 0, systemes: {}};
    if (!html) return out;

    const titre = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
    const num = titre.match(/\((\d+)\)/);
    if (num) out.commandant = parseInt(num[1], 10);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Ancres <A name="0_x_y"> et lignes de tableau, dans l'ordre du document
    const noeuds = Array.from(doc.querySelectorAll('a[name], tr'));
    let systeme: string | undefined;
    let dansSection = false;

    for (const n of noeuds) {
        if (n.tagName === 'A') {
            const m = (n.getAttribute('name') || '').match(/^\d+_(\d+)_(\d+)$/);
            systeme = m ? `${parseInt(m[1], 10)}_${parseInt(m[2], 10)}` : undefined;
            if (systeme) out.nbSystemes++;
            dansSection = false;
            continue;
        }
        const tds = Array.from(n.children).filter(c => c.tagName === 'TD');
        if (tds.length === 1) {
            // En-tête de section (« Constructions en cours », « Bâtiments »…)
            dansSection = texte(tds[0]).toLowerCase() === TITRE_SECTION && !!systeme;
            continue;
        }
        if (!dansSection || !systeme || tds.length !== 4) continue;

        const [type, nombre, pdc, planete] = tds.map(texte);
        if (type.toLowerCase() === 'type') continue; // ligne d'en-tête des colonnes
        const nb = parseInt(nombre, 10);
        const pts = parseInt(pdc, 10);
        if (!type || isNaN(nb)) continue;
        const numPla = parseInt(planete, 10);
        const entree: ConstructionEnCours = {
            nom: type,
            nombre: nb,
            pdcRestants: isNaN(pts) ? 0 : pts,
            // Le rapport affiche la planète en base 1
            ...(isNaN(numPla) ? {} : {planete: numPla - 1}),
        };
        (out.systemes[systeme] = out.systemes[systeme] || []).push(entree);
    }
    return out;
}

const normaliser = (s: string) =>
    s.normalize('NFC').replace(/ /g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

// Nom affiché par le jeu pour un bâtiment : « nom de type II », ou « nom » seul
// pour un bâtiment sans autre niveau.
const nomsPossibles = (t: Technologie) => [
    normaliser(t.nom),
    normaliser(`${t.nom} de type ${toRoman(t.niv)}`),
];

// Retrouve le bâtiment (code) ou le plan de vaisseau (nom) d'une construction en cours
export function resoudreConstructionEnCours(
    nom: string,
    technologies: Technologie[],
    plans: PlanVaisseau[],
): { type: 'building' | 'ship'; code: string } | undefined {
    const cible = normaliser(nom);
    const batiments = technologies.filter(t => t.type === 0);
    // Le nom complet (avec niveau) prime sur le nom seul, ambigu entre niveaux
    const tech = batiments.find(t => nomsPossibles(t)[1] === cible)
        ?? batiments.find(t => nomsPossibles(t)[0] === cible && t.niv === 0);
    if (tech) return {type: 'building', code: tech.code};
    // Pour un vaisseau, le jeu affiche le nom du plan
    const plan = plans.find(p => p.nom === nom) ?? plans.find(p => normaliser(p.nom) === cible);
    if (plan) return {type: 'ship', code: plan.nom};
    return undefined;
}
