import {Rapport, SystemeDetecte, XY} from '../types';
import {parsePosString} from '../utils/position';

/** Portée radar d'un système ou d'une flotte d'un allié (case détectée : distance de Tchebychev ≤ scan) */
export type RadarAllie = {
  cdt: number;
  pos: XY;
  scan: number;
  tour?: number;
};

export type ManualParseResult = {
  systems: SystemeDetecte[];
  radars: RadarAllie[];
  errors: { line: number; message: string }[];
};

// Parse lines like:
// nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1
// pop, popMax et tour (tour de l'information) sont facultatifs ; une ligne commençant par « # » est
// un commentaire (en-tête du texte produit par exportSystemesJoueur).
// Une ligne avec « radar= » décrit une portée radar d'allié :
// radar=4; pos=0_10_20; cdt=7; tour=5
export function parseManualDetectedSystems(text: string): ManualParseResult {
  const systems: SystemeDetecte[] = [];
  const radars: RadarAllie[] = [];
  const errors: { line: number; message: string }[] = [];

  if (!text || !text.trim()) return { systems, radars, errors };

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, idx) => {
    const lineNum = idx + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return; // ligne vide ou commentaire
    try {
      const parts = line.split(';').map(s => s.trim()).filter(Boolean);
      const map: Record<string, string> = {};
      parts.forEach(p => {
        const [kRaw, ...rest] = p.split('=');
        const k = (kRaw || '').trim().toLowerCase();
        const v = rest.join('=').trim();
        if (k) map[k] = v;
      });

      const posStr = map['pos'];
      if (!posStr) throw new Error('pos manquant');
      const pos = parsePosString(posStr);

      if (map['radar'] !== undefined) {
        const cdt = safeInt(map['cdt'] ?? '0');
        if (!cdt) throw new Error('cdt manquant pour un radar');
        const tourRadar = safeInt(map['tour'] ?? '0');
        radars.push({cdt, pos, scan: safeInt(map['radar']), ...(tourRadar > 0 ? {tour: tourRadar} : {})});
        return;
      }

      const nom = map['nom'] || 'Système';
      const nbPla = safeInt(map['nbpla'] ?? map['nbpl'] ?? '0');
      const typeEtoile = safeInt(map['typeetoile'] ?? map['etoile'] ?? map['type'] ?? '0');

      const ownersStr = map['proprios'] ?? map['proprietaires'] ?? map['proprio'] ?? '';
      const proprietaires = ownersStr
        ? ownersStr.split(',').map(s => safeInt(s.trim())).filter(n => !Number.isNaN(n))
        : [];

      const optionnel = (k: string) => (map[k] !== undefined && map[k] !== '' ? safeInt(map[k]) : undefined);
      const systeme: SystemeDetecte = {
        type: 'detecte',
        nom,
        pos,
        typeEtoile,
        nbPla,
        proprietaires: proprietaires.sort((a, b) => a - b),
      };
      const pop = optionnel('pop');
      const popMax = optionnel('popmax');
      const tour = optionnel('tour');
      if (pop !== undefined) systeme.pop = pop;
      if (popMax !== undefined) systeme.popMax = popMax;
      if (tour !== undefined && tour > 0) systeme.tour = tour;
      systems.push(systeme);
    } catch (e: any) {
      errors.push({ line: lineNum, message: e?.message || 'Ligne invalide' });
    }
  });

  return { systems, radars, errors };
}

/**
 * Texte des systèmes du joueur, une ligne par système, à transmettre à un allié (Discord, mail…) :
 * il le colle dans « Importer systèmes » (parseManualDetectedSystems). Les systèmes du joueur ne
 * sont pas partagés automatiquement par l'alliance, contrairement aux détections.
 * Suivent les portées radar des systèmes et des flottes du joueur (position au tour du rapport).
 * `contenu` choisit ce qui est exporté (les deux par défaut).
 */
export function exportSystemesJoueur(
  rapport: Pick<Rapport, 'tour' | 'joueur' | 'systemesJoueur'> & Partial<Pick<Rapport, 'flottesJoueur'>>,
  contenu: { systemes?: boolean; radars?: boolean } = {},
): string {
  const avecSystemes = contenu.systemes ?? true;
  const avecRadars = contenu.radars ?? true;
  const propre = (s: string) => s.replace(/[;\r\n]+/g, ' ').trim();
  const lignes = !avecSystemes ? [] : rapport.systemesJoueur.map(s => {
    const autres = (s.proprietaires || []).filter(o => o !== 0);
    const proprios = Array.from(new Set(autres.length ? autres : [rapport.joueur.numero])).sort((a, b) => a - b);
    return [
      `nbpla=${s.nbPla}`,
      `nom=${propre(s.nom)}`,
      ...(s.pop != null ? [`pop=${s.pop}`] : []),
      ...(s.popMax != null ? [`popMax=${s.popMax}`] : []),
      `pos=0_${s.pos.x}_${s.pos.y}`,
      `typeEtoile=${s.typeEtoile}`,
      `proprios=${proprios.join(',')}`,
      `tour=${rapport.tour}`,
    ].join('; ');
  });
  const radars = !avecRadars ? [] : [...rapport.systemesJoueur, ...(rapport.flottesJoueur || [])]
    .filter(o => Number(o.scan) > 0)
    .map(o => `radar=${Number(o.scan)}; pos=0_${o.pos.x}_${o.pos.y}; cdt=${rapport.joueur.numero}; tour=${rapport.tour}`);
  const parties = [
    ...(avecSystemes ? [`${lignes.length} système(s)`] : []),
    ...(avecRadars ? [`${radars.length} radar(s)`] : []),
  ];
  if (!parties.length) return '';
  const entete = `# Systèmes de ${propre(rapport.joueur.nom || '')} (n°${rapport.joueur.numero}), tour ${rapport.tour} : ` +
    `${parties.join(' et ')}, à coller dans « Importer systèmes » de l'outil d'aide`;
  return [entete, ...lignes, ...radars].join('\n');
}

function safeInt(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
