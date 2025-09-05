export interface Race {
    code: string;
    nom: string;
    couleur: string;
}

export interface Merchandise {
    code: string;
    nom: string;
}

export interface Characteristic {
    code: string;
    nom: string;
}

export interface Technology {
    base: string;
    code: string;
    niv: number;
    nom: string;
    recherche: number;
    type: number;
    description: string;
    parents: string[];
    specifications: Record<string, any>;
    characteristics: Record<string, any>;
    merchandises: Record<string, any>;
}

export interface Planet {
    num: number;
    type: number;
    tai: number;
    grav: number;
    temp: number;
    atm: number;
    rad: number;
    prop: number;
    stab: number;
    revolt: number;
    tax: number;
    terra: number;
    prod: number;
    pdc: number;
    stockmin: number;
    revenumin: number;
}

export interface System {
    nom: string;
    pos: string;
    nombrePla: number;
    typeEtoile: number;
    bcont: number;
    besp: number;
    btech: number;
    entretien: number;
    hscan: number;
    pdc: number;
    politique: number;
    revenu: number;
    planetes: Planet[];
    proprio: number[];
}

export interface Vaisseau {
    type: string;
    plan: string;
    race: number;
    exp: number;
    moral: number;
}

export interface Fleet {
    num: number;
    nom: string;
    pos: string;
    directive: number;
    directive_precision: number;
    vitesse: number;
    hscan: number;
    AP: number;
    AS: number;
    vaisseaux: Vaisseau[];
    proprio?: number;
}

export interface Player {
    nom: string;
    race: number;
    reputation: number;
    statut: string;
    puissance: number;
    argent: number;
    capitale: string;
    systems: System[];
    fleets: Fleet[];
    detectedSystems: System[];
    detectedFleets: Fleet[];
}

export interface GlobalData {
    technologies: Technology[];
    races: Race[];
    merchandises: Merchandise[];
    buildingCharacteristics: Characteristic[];
    componentCharacteristics: Characteristic[];
}

export interface Rapport {
    player: Player;
}
