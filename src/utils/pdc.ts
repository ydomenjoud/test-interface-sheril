import { Lieutenant, SystemeJoueur } from '../types';
import { isPos, parsePosString, posToString } from './position';

// Compétence "maîtrise de la vitesse" (data.xml > leader_competences) : pour un gouverneur,
// la caractéristique vitesse augmente d'autant les PDC du système
export const COMP_VITESSE = 0;
// Marchandise "robots" (data.xml > marchandises) : stock ≥ 100 → +5 PDC
export const MARCH_ROBOTS = 7;
export const SEUIL_STOCK_IMPORTANT = 100;
// Bonus PDC d'un stock important de robots
export const BONUS_PDC_ROBOTS = 5;
// Multiplicateurs de PDC des politiques (data.xml > politiques)
export const POLITIQUE_CONSTRUCTION = 3; // +50 %
export const POLITIQUE_ESCLAVAGISTE = 7; // ×2

// Niveau d'une compétence : 0 si absente, 1 si présente avec la valeur 0, sinon la valeur
export const niveauCompetence = (l: Lieutenant | undefined, comp: number): number => {
    const c = l?.competences.find(x => x.comp === comp);
    return c ? Math.max(1, c.val) : 0;
};

// Bonus PDC du gouverneur : la vitesse augmente d'autant les PDC du système,
// la vitesse étant augmentée de 50 % par niveau de maîtrise de la vitesse (arrondi à l'inférieur)
export const bonusPdcGouverneur = (l: Lieutenant | undefined): number =>
    l ? Math.floor(l.vit * (1 + 0.5 * niveauCompetence(l, COMP_VITESSE))) : 0;

// Multiplicateur de PDC de la politique du système
export const modificateurPdcPolitique = (code: number | undefined): number =>
    code === POLITIQUE_CONSTRUCTION ? 1.5 : code === POLITIQUE_ESCLAVAGISTE ? 2 : 1;

// Gouverneurs (lieutenants de type 1) en poste, indexés par clé de système "x_y"
export const gouverneursParPosition = (lieutenants: Lieutenant[]): Record<string, Lieutenant> => {
    const m: Record<string, Lieutenant> = {};
    lieutenants.filter(l => l.type === 1).forEach(l => {
        if (isPos(l.pos)) m[posToString(parsePosString(l.pos))] = l;
    });
    return m;
};

// PDC d'un système pour un gouverneur et une politique donnés :
// floor(Σ pdc des planètes du joueur × multiplicateur politique) + bonus gouverneur + bonus robots
export function pdcSysteme(
    s: SystemeJoueur,
    numeroJoueur: number | undefined,
    gouverneur: Lieutenant | undefined,
    politique: number | undefined
): number {
    const base = s.planetes
        .filter(p => p.proprietaire === numeroJoueur)
        .reduce((acc, p) => acc + (p.pdc || 0), 0);
    const robots = (s.marchandises ?? []).some(m => m.code === MARCH_ROBOTS && m.stock >= SEUIL_STOCK_IMPORTANT)
        ? BONUS_PDC_ROBOTS : 0;
    return Math.floor(base * modificateurPdcPolitique(politique)) + bonusPdcGouverneur(gouverneur) + robots;
}

// Détail du calcul pour l'infobulle
export function detailPdc(
    s: SystemeJoueur,
    numeroJoueur: number | undefined,
    gouverneur: Lieutenant | undefined,
    politique: number | undefined
): string {
    const mesPlanetes = s.planetes.filter(p => p.proprietaire === numeroJoueur);
    const base = mesPlanetes.reduce((acc, p) => acc + (p.pdc || 0), 0);
    const mult = modificateurPdcPolitique(politique);
    const nomPolitique = politique !== undefined ? `politique ${politique}` : 'politique ?';
    const lignes = [
        `base : ${mesPlanetes.length} planète(s) du joueur, Σ pdc = ${base}`,
        `× ${nomPolitique} : ×${String(mult).replace('.', ',')} → ${Math.floor(base * mult)}`,
        gouverneur
            ? `+ gouverneur ${gouverneur.nom} : vitesse ${gouverneur.vit} × (1 + 0,5 × ${niveauCompetence(gouverneur, COMP_VITESSE)}) = +${bonusPdcGouverneur(gouverneur)}`
            : '+ gouverneur : aucun',
        (s.marchandises ?? []).some(m => m.code === MARCH_ROBOTS && m.stock >= SEUIL_STOCK_IMPORTANT)
            ? `+ robots (stock ≥ ${SEUIL_STOCK_IMPORTANT}) : +${BONUS_PDC_ROBOTS}`
            : '+ robots : stock < ' + SEUIL_STOCK_IMPORTANT,
    ];
    lignes.push(`= ${pdcSysteme(s, numeroJoueur, gouverneur, politique)}`);
    return lignes.join('\n');
}