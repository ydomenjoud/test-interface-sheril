export type XY = { x: number; y: number };

export type Range = {min: number, max: number};

export type Race = {
    id: number;
    nom: string;
    couleur?: string
    graviteSupporte: Range;
    temperatureSupporte: Range;
    radiationSupporte: Range;
};

export type Marchandise = { code: number; nom: string };
export type Commandant = { numero?: number; nom?: string; raceId?: number; }

export type TechCaracteristique = { code: number; value: number };
export type TechMarchandise = { code: number; nb: number };

// Spécification d'une technologie (utile pour les composants de vaisseaux)
export type TechSpecification = {
    case?: number;   // emprise en cases dans le plan
    min?: number;    // coût minerai unitaire
    prix?: number;   // coût argent unitaire
    type?: string;   // ex: 'arme'
};

export type Technologie = {
    base: string; code: string; niv: number; nom: string; type: 0 | 1; // 0 batiment, 1 composant
    recherche: number; description?: string; parents: string[]; caracteristiques: TechCaracteristique[]; marchandises?: TechMarchandise[];
    specification?: TechSpecification;
};

// Composants d'un plan de vaisseau
export type PlanComposant = { code: string; nb: number };
// Plan de vaisseau (public ou privé)
export type PlanVaisseau = {
    nom: string;
    concepteur?: number;
    marque?: string;
    tour?: number;
    taille?: number;
    vitesse?: number;
    pc?: number;
    minerai?: number;
    prix?: number; // centaures/prix
    ap?: number;
    as?: number;
    royalties?: number;
    composants: PlanComposant[];
};

// Règle de taille des vaisseaux (détermination taille/vitesse via total des cases)
export type VaisseauTailleRule = {
    minCase: number;
    maxCase: number;
    taille: number;
    vitesse: number;
};

export type Planete = {
    num: number;
    proprietaire?: number;
    pdc: number; // points de construction
    minerai?: number;
    revenumin: number;
    stockmin: number;
    batiments: { techCode: string; count: number }[];
    populations: {
        raceId: number;
        nb: number,
        growth: number,
        max: number
    }[];
    tax: number,
    atmosphere: number,
    gravity: number,
    radiation: number,
    temperature: number,
    terraformation: number,
    size: number,
};

export interface SystemBase {
    nom: string;
    pos: XY;
    typeEtoile: number;
    nbPla: number;
    proprietaires: number[]; // PROPRIO list
    politique?: number;
    entretien?: number;
    revenu?: number;
    bcont?: number;
    besp?: number;
    btech?: number;
}

export type MarchandiseData = {
    code: number;
    num: number;
    prod: number;
};

export interface SystemeJoueur extends SystemBase {
    type: 'joueur';
    pdc: number;
    revenumin: number;
    stockmin: number;
    popAct: number;
    popMax: number;
    popAug: number;
    race: string;
    racePop: { [key: number]: number };
    racePopAug: { [key: number]: number };
    planetes: Planete[];
    revenuEstime: number;
    scan: number;
    marchandises: MarchandiseData[];
}

export interface SystemeDetecte extends SystemBase {
    type: 'detecte';
}

export interface FlotteBase {
    type: 'joueur' | 'detecte';
    num: number;
    nom: string;
    pos: XY;
    nbVso: number;
    proprio: number;
}

export interface FlotteJoueur extends FlotteBase {
    type: 'joueur';
    direction?: XY;
    directive: string | number;
    vitesse: number;
    ap?: number;
    as?: number;
    scan: number;
    nbVso: number;
    vaisseaux: { type: string; plan: string; nb?: number; puissance?: string; exp: number; moral: number; race?: number }[];
    equipage: { nom: string; couleur: string }[];
    heros?: string;
}

export interface FlotteDetectee extends FlotteBase {
    type: 'detecte';
    puiss: 'faible' | 'moyenne' | 'grande' | string;
}

export interface Alliance {
    createur: number;
    dirigeant: number;
    droits: number,
    nom: string;
    commandants: number[];
}

export interface Competence {
    comp: number;
    val: number;
}

export interface Lieutenant {
    nom: string;
    pos: string;
    att: number;
    race: number;
    competences: Competence[];
}

export type Rapport = {
    tour: number;
    lieutenants: Lieutenant[];
    joueur: {
        numero: number;
        nom: string;
        raceId: number;
        reputation: string;
        statut: string;
        puissance: number;
        argent: number;
        capitale: XY;
        alliances: Alliance[]; // aliances
        pna: number[]; // ids PNA
    };
    technologiesAtteignables: string[];
    technologiesConnues: string[];
    systemesJoueur: SystemeJoueur[];
    systemesDetectes: SystemeDetecte[];
    flottesJoueur: FlotteJoueur[];
    flottesDetectees: FlotteDetectee[];
    plansVaisseaux: PlanVaisseau[];
    budgetTechnologique: number;
    combats: { x: number; y: number }[];
};
export type GlobalData = {
    commandants: Commandant[];
    technologies: Technologie[];
    races: Race[];
    marchandises: Marchandise[];
    politiques: Record<number, string>;
    caracteristiquesBatiment: CaracteristiqueBatiment[];
    caracteristiquesComposant: Record<number, string>;
    plansPublic: PlanVaisseau[];
    tailleVaisseaux: VaisseauTailleRule[];
    batiments: Batiment[];
};

export type Batiment = {
    code: string;
    nom: string;
    arme?: string;
    structure: number;
    caracteristiques: { code: number; value: number }[];
};

export type CaracteristiqueBatiment = {
    code: number;
    nom: string;
};
