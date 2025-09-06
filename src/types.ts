export type XY = { x: number; y: number };

export type Race = { id: number; nom: string; couleur?: string };
export type Marchandise = { code: number; nom: string };
export type Commandant = { numero?: number; nom?: string; raceId?: number;}

export type TechCaracteristique = { code: number; value: number };
export type Technologie = {
    base: string; code: string; niv: number; nom: string; type: 0 | 1; // 0 batiment, 1 composant
    recherche: number; description?: string; parents: string[]; caracteristiques: TechCaracteristique[];
};

export type Planete = {
    num: number; proprietaire?: number; pdc: number; // points de construction
    minerai?: number; batiments: { techCode: string; count: number }[]; populations: { raceId: number; nb: number }[];
};

interface SystemBase {
    nom: string;
    pos: XY;
    typeEtoile: number;
    nbPla: number;
    proprietaires: number[]; // PROPRIO list
    politique?: number;
    entretien?: number;
    revenu?: number;
    hscan?: number;
    bcont?: number;
    besp?: number;
    btech?: number;
}

export interface SystemeJoueur extends SystemBase {
    type: 'joueur';
    planetes: Planete[];
}

export interface SystemeDetecte extends SystemBase {
    type: 'detecte';
}

export type FlotteJoueur = {
    type: 'joueur';
    num: number;
    nom: string;
    pos: XY;
    direction?: string;
    directive?: string | number;
    vitesse?: number;
    ap?: number;
    as?: number;
    vaisseaux: { type: string; plan: string; nb?: number; puissance?: string }[];
};

export type FlotteDetectee = {
    type: 'detecte';
    num: number;
    nom: string;
    pos: XY;
    proprio: number;
    nbVso?: number;
    direction?: string;
    directive?: string | number;
    vitesse?: number;
    ap?: number;
    as?: number;
    puiss: 'faible' | 'moyenne' | 'grande' | string;
};

export interface Alliance {
    createur: number;
    dirigeant: number;
    droits: number,
    nom: string;
    commandants: number[];
}

export type Rapport = {
    joueur: {
        numero?: number;
        nom?: string;
        raceId?: number;
        reputation?: string;
        statut?: string;
        puissance?: number;
        argent?: number;
        capitale?: XY;
        alliances?: Alliance[]; // aliances
        pna?: number[]; // ids PNA
    };
    technologiesConnues: string[];
    systemesJoueur: SystemeJoueur[];
    systemesDetectes: SystemeDetecte[];
    flottesJoueur: FlotteJoueur[];
    flottesDetectees: FlotteDetectee[];
};
export type GlobalData = {
    commandants: Commandant[];
    technologies: Technologie[];
    races: Race[];
    marchandises: Marchandise[];
    politiques: Record<number, string>;
    caracteristiquesBatiment: Record<number, string>;
    caracteristiquesComposant: Record<number, string>;
};
