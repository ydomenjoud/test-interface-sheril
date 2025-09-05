export type XY = { x: number; y: number };

export type Race = { id: number; nom: string; couleur?: string };
export type Marchandise = { code: number; nom: string };

export type TechCaracteristique = { code: number; value: number };
export type Technologie = {
  base: string;
  code: string;
  niv: number;
  nom: string;
  type: 0 | 1; // 0 batiment, 1 composant
  recherche: number;
  description?: string;
  parents: string[];
  caracteristiques: TechCaracteristique[];
};

export type Planete = {
  num: number;
  proprietaire?: number;
  pdc: number; // points de construction
  minerai?: number;
  batiments: { techCode: string; count: number }[];
  populations: { raceId: number; nb: number }[];
};

export type SystemeJoueur = {
  type: 'joueur';
  nom: string;
  pos: XY;
  typeEtoile: number;
  nombrePla: number;
  proprietaires: number[]; // num commandants présents
  planetes: Planete[];
};

export type SystemeDetecte = {
  type: 'detecte';
  nom: string;
  pos: XY;
  typeEtoile: number;
  nbPla: number;
  proprietaires: number[]; // PROPRIO list
};

export type FlotteJoueur = {
  type: 'joueur';
  num: number;
  nom: string;
  pos: XY;
  vaisseaux: { type: string; plan: string; nb?: number; puissance?: string }[];
};

export type FlotteDetectee = {
  type: 'detecte';
  num: number;
  nom: string;
  pos: XY;
  proprio: number;
  puiss: 'faible' | 'moyenne' | 'grande' | string;
};

export type Rapport = {
  joueur: {
    nom?: string;
    raceId?: number;
    reputation?: string;
    statut?: string;
    puissance?: number;
    argent?: number;
    capitale?: XY;
    alliances?: number[]; // ids alliés
    pna?: number[]; // ids PNA
  };
  systemesJoueur: SystemeJoueur[];
  systemesDetectes: SystemeDetecte[];
  flottesJoueur: FlotteJoueur[];
  flottesDetectees: FlotteDetectee[];
};
export type GlobalData = {
  technologies: Technologie[];
  races: Race[];
  marchandises: Marchandise[];
  caracteristiquesBatiment: Record<number, string>;
  caracteristiquesComposant: Record<number, string>;
};
