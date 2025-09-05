export interface Commandant {
  nom: string;
  numero: string;
  race: string;
  capitale: string;
  planetes: string;
  puissance: string;
  reputation: string;
  statut: string;
  ALLIANCE?: Alliance;
  PNA?: PNA;
  SYSTEMES: { S: Systeme[] };
  FLOTTES: { F: Flotte[] };
  DETECTIONS: {
    FLOTTE: DetectedFlotte[];
    SYSTEME: DetectedSysteme[];
  };
}

export interface Alliance {
  nom: string;
  COM: { num: string }[];
}

export interface PNA {
  P: { com: string }[];
}

export interface Systeme {
  nom: string;
  pos: string;
  typeEtoile: string;
  // This will be 1 if the current player owns it, but might not exist for detected systems
  proprio?: string;
}

export interface Flotte {
  nom: string;
  pos: string;
  num: string;
  // This will be the player's number if they own it.
  proprio?: string;
}

export interface DetectedSysteme extends Systeme {
  PROPRIO: { '#text': string };
}

export interface DetectedFlotte extends Flotte {
  proprio: string;
}

export interface Rapport {
  COMMANDANT: Commandant;
}

// Global Data
export interface Race {
  code: string;
  nom: string;
}

export interface GlobalData {
  RACES: { C: Race[] };
  COMMANDANTS: { C: any[] }; // Keeping this simple for now
}
