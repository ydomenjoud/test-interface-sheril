import {FlotteDetectee, FlotteJoueur, Rapport, SystemeDetecte, XY} from '../types';
import {getTorusDistance, parsePosString} from '../utils/position';
import {getDescriptionPuissance, getPuissance} from '../utils/puissance';
import {FlotteImportee} from '../storage/flottesImporteesStorage';

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
  flottes: FlotteImportee[];
  errors: { line: number; message: string }[];
};

// Parse lines like:
// nbpla=16; nom=Nb 9C; pop=3475; popMax=43547; pos=0_1_26; typeEtoile=1; proprios=4,1
// pop, popMax et tour (tour de l'information) sont facultatifs ; une ligne commençant par « # » est
// un commentaire (en-tête du texte produit par exportSystemesJoueur).
// Une ligne avec « radar= » décrit une portée radar d'allié :
// radar=4; pos=0_10_20; cdt=7; tour=5
// Une ligne avec « flotte= » (numéro de la flotte) décrit une flotte, vue au tour indiqué :
// flotte=12; nom=Escorte; pos=0_10_20; proprio=7; nbVso=5; puiss=petite; tour=5
export function parseManualDetectedSystems(text: string): ManualParseResult {
  const systems: SystemeDetecte[] = [];
  const radars: RadarAllie[] = [];
  const flottes: FlotteImportee[] = [];
  const errors: { line: number; message: string }[] = [];

  if (!text || !text.trim()) return { systems, radars, flottes, errors };

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

      if (map['flotte'] !== undefined) {
        if (map['proprio'] === undefined || map['proprio'] === '') throw new Error('proprio manquant pour une flotte');
        const tourFlotte = safeInt(map['tour'] ?? '0');
        flottes.push({
          type: 'detecte',
          num: safeInt(map['flotte']),
          nom: map['nom'] || 'Flotte',
          pos,
          nbVso: safeInt(map['nbvso'] ?? '0'),
          proprio: safeInt(map['proprio']),
          puiss: map['puiss'] || 'inconnue',
          ...(tourFlotte > 0 ? {tour: tourFlotte} : {}),
        });
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

  return { systems, radars, flottes, errors };
}

/** Ce que contient le texte d'export : sources (cases de la fenêtre) et types d'objets. */
export type ContenuExport = {
  systemes?: boolean;           // mes possessions (systèmes, et flottes si `flottes`) ; oui par défaut
  radars?: boolean;             // mes portées radar ; oui par défaut
  detections?: boolean;         // mes détections propres ; non par défaut
  detectionsAlliance?: boolean; // détections de l'alliance ; non par défaut
  typeSystemes?: boolean;       // les sources ci-dessus donnent leurs systèmes ; oui par défaut
  typeFlottes?: boolean;        // les sources ci-dessus donnent leurs flottes ; non par défaut
};

type RapportExport = Pick<Rapport, 'tour' | 'joueur' | 'systemesJoueur'>
  & Partial<Pick<Rapport, 'flottesJoueur' | 'systemesDetectesDuTour' | 'flottesDetectees'>>;

/**
 * Texte à transmettre à un autre commandant (Discord, mail…) : il le colle dans « Importer systèmes »
 * (parseManualDetectedSystems). Les possessions du joueur ne sont pas partagées automatiquement par
 * l'alliance, contrairement aux détections.
 * - Possessions : systèmes du joueur ; ses flottes avec `typeFlottes` (puissance donnée par son libellé,
 *   comme la verrait un autre commandant, sans l'AS ni l'AP).
 * - Détections propres : systèmes et flottes détectés à ce tour à portée d'un radar de système ou d'un
 *   scanner de flotte du joueur (distance de Tchebychev ≤ portée, `Commandant.determinerSystemesDetectes`
 *   et `determinerFlottesDetectes`), pour un commandant hors de l'alliance.
 * - Détections de l'alliance : les autres, hors de portée des radars du joueur, venues des alliés.
 * - Portées radar des systèmes et des flottes du joueur (position au tour du rapport).
 */
export function exportSystemesJoueur(rapport: RapportExport, contenu: ContenuExport = {}): string {
  const avecPossessions = contenu.systemes ?? true;
  const avecRadars = contenu.radars ?? true;
  const avecDetections = contenu.detections ?? false;
  const avecDetectionsAlliance = contenu.detectionsAlliance ?? false;
  const typeSystemes = contenu.typeSystemes ?? true;
  const typeFlottes = contenu.typeFlottes ?? false;
  const propre = (s: string) => s.replace(/[;\r\n]+/g, ' ').trim();
  const numero = rapport.joueur.numero;

  const ligneSysteme = (s: SystemeDetecte | Rapport['systemesJoueur'][number], proprios: number[], tour: number) => [
    `nbpla=${s.nbPla}`,
    `nom=${propre(s.nom)}`,
    ...(s.pop != null ? [`pop=${s.pop}`] : []),
    ...(s.popMax != null ? [`popMax=${s.popMax}`] : []),
    `pos=0_${s.pos.x}_${s.pos.y}`,
    `typeEtoile=${s.typeEtoile}`,
    `proprios=${proprios.join(',')}`,
    `tour=${tour}`,
  ].join('; ');
  const ligneFlotte = (f: { num: number; nom: string; pos: XY; proprio: number; nbVso: number }, puiss: string) => [
    `flotte=${f.num}`,
    `nom=${propre(f.nom)}`,
    `pos=0_${f.pos.x}_${f.pos.y}`,
    `proprio=${f.proprio}`,
    `nbVso=${f.nbVso}`,
    `puiss=${propre(puiss)}`,
    `tour=${rapport.tour}`,
  ].join('; ');

  const mesSystemes = !(avecPossessions && typeSystemes) ? [] : rapport.systemesJoueur.map(s => {
    const autres = (s.proprietaires || []).filter(o => o !== 0);
    const proprios = Array.from(new Set(autres.length ? autres : [numero])).sort((a, b) => a - b);
    return ligneSysteme(s, proprios, rapport.tour);
  });
  const mesFlottes = !(avecPossessions && typeFlottes) ? [] : (rapport.flottesJoueur || [])
    .map(f => ligneFlotte({...f, proprio: numero}, getDescriptionPuissance(getPuissance(f as FlotteJoueur))));

  const observateurs = [...rapport.systemesJoueur, ...(rapport.flottesJoueur || [])]
    .filter(o => Number(o.scan) > 0);
  const radars = !avecRadars ? [] : observateurs
    .map(o => `radar=${Number(o.scan)}; pos=0_${o.pos.x}_${o.pos.y}; cdt=${numero}; tour=${rapport.tour}`);

  const {propres, alliance} = repartirDetections(rapport, observateurs);
  const flottesRep = repartirFlottesDetectees(rapport, observateurs);
  const lignesDetection = (systemes: SystemeDetecte[], flottes: FlotteDetectee[]) => [
    ...(typeSystemes ? systemes.map(s => ligneSysteme(s, s.proprietaires || [], s.tour ?? rapport.tour)) : []),
    ...(typeFlottes ? flottes.map(f => ligneFlotte(f, f.puiss)) : []),
  ];
  const detections = !avecDetections ? [] : lignesDetection(propres, flottesRep.propres);
  const detectionsAlliance = !avecDetectionsAlliance ? [] : lignesDetection(alliance, flottesRep.alliance);

  const parties = [
    ...(avecPossessions && typeSystemes ? [`${mesSystemes.length} système(s)`] : []),
    ...(avecPossessions && typeFlottes ? [`${mesFlottes.length} flotte(s)`] : []),
    ...(avecDetections && (typeSystemes || typeFlottes) ? [`${detections.length} détection(s)`] : []),
    ...(avecDetectionsAlliance && (typeSystemes || typeFlottes) ? [`${detectionsAlliance.length} détection(s) de l'alliance`] : []),
    ...(avecRadars ? [`${radars.length} radar(s)`] : []),
  ];
  if (!parties.length) return '';
  const entete = `# Systèmes de ${propre(rapport.joueur.nom || '')} (n°${numero}), tour ${rapport.tour} : ` +
    `${parties.join(' et ')}, à coller dans « Importer systèmes » de l'outil d'aide`;
  return [entete, ...mesSystemes, ...mesFlottes, ...detections, ...detectionsAlliance, ...radars].join('\n');
}

const aPortee = (radars: { pos: XY; scan: number }[], pos: XY) =>
  radars.some(o => Number(o.scan) > 0 && getTorusDistance(o.pos, pos) <= Number(o.scan));

const observateursDuJoueur = (rapport: Pick<Rapport, 'systemesJoueur'> & Partial<Pick<Rapport, 'flottesJoueur'>>) =>
  [...rapport.systemesJoueur, ...(rapport.flottesJoueur || [])];

/**
 * Répartit les systèmes détectés à ce tour (sans ceux où le joueur a une planète) entre ceux à portée
 * des radars du joueur lui-même (systèmes et flottes) et ceux que l'alliance a mis en commun. Triés par position.
 */
export function repartirDetections(
  rapport: Pick<Rapport, 'systemesJoueur'> & Partial<Pick<Rapport, 'flottesJoueur' | 'systemesDetectesDuTour'>>,
  observateurs: { pos: XY; scan: number }[] = observateursDuJoueur(rapport),
): { propres: SystemeDetecte[]; alliance: SystemeDetecte[] } {
  const possedes = new Set(rapport.systemesJoueur.map(s => `${s.pos.x}_${s.pos.y}`));
  const vus = new Set<string>();
  const propres: SystemeDetecte[] = [];
  const alliance: SystemeDetecte[] = [];
  [...(rapport.systemesDetectesDuTour || [])]
    .sort((a, b) => a.pos.x - b.pos.x || a.pos.y - b.pos.y)
    .forEach(s => {
      const cle = `${s.pos.x}_${s.pos.y}`;
      if (possedes.has(cle) || vus.has(cle)) return;
      vus.add(cle);
      (aPortee(observateurs, s.pos) ? propres : alliance).push(s);
    });
  return {propres, alliance};
}

/**
 * Même répartition pour les flottes détectées du rapport (hors flottes du joueur). Approchée : une flotte
 * brouillée à portée du joueur peut n'avoir été vue que par un allié (tirage du brouilleur), elle compte
 * quand même parmi les détections propres.
 */
export function repartirFlottesDetectees(
  rapport: Pick<Rapport, 'systemesJoueur' | 'joueur'> & Partial<Pick<Rapport, 'flottesJoueur' | 'flottesDetectees'>>,
  observateurs: { pos: XY; scan: number }[] = observateursDuJoueur(rapport),
): { propres: FlotteDetectee[]; alliance: FlotteDetectee[] } {
  const propres: FlotteDetectee[] = [];
  const alliance: FlotteDetectee[] = [];
  [...(rapport.flottesDetectees || [])]
    .filter(f => f.proprio !== rapport.joueur.numero)
    .sort((a, b) => a.pos.x - b.pos.x || a.pos.y - b.pos.y || a.proprio - b.proprio || a.num - b.num)
    .forEach(f => (aPortee(observateurs, f.pos) ? propres : alliance).push(f));
  return {propres, alliance};
}

function safeInt(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
