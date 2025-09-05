import { XMLParser } from 'fast-xml-parser';
import { GlobalData, Rapport, Technology, Race, Merchandise, Characteristic, Player, System, Fleet, Vaisseau, Planet } from '../models';

const options = {
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: true,
    textNodeName: "#text",
    allowBooleanAttributes: true,
    alwaysCreateTextNode: true,
    isArray: (name: string, jpath: string, isLeafNode: boolean, isAttribute: boolean) => {
        return ['T', 'C', 'R', 'M', 'S', 'F', 'VAISSEAU', 'PROPRIO', 'PLANETES', 'SYSTEME', 'FLOTTE'].indexOf(name) !== -1;
    }
};

const parser = new XMLParser(options);

export const parseGlobalData = (xmlData: string): GlobalData => {
    const parsed = parser.parse(xmlData);
    const data = parsed.DATA;

    const technologies: Technology[] = data.TECHNOLOGIES[0].T.map((t: any): Technology => ({
        base: t['@_base'],
        code: t['@_code'],
        niv: t['@_niv'],
        nom: t['@_nom'],
        recherche: t['@_recherche'],
        type: t['@_type'],
        description: t.DESCRIPTION[0]['#text'],
        parents: t.PARENT ? t.PARENT.map((p: any) => p['@_code']) : [],
        specifications: t.SPECIFICATION ? t.SPECIFICATION[0]['@_'] : {},
        characteristics: t.CARACTERISTIQUE ? t.CARACTERISTIQUE.reduce((acc: any, c: any) => {
            acc[c['@_code']] = c['@_value'];
            return acc;
        }, {}) : {},
        merchandises: t.MARCHANDISE ? t.MARCHANDISE.reduce((acc: any, m: any) => {
            acc[m['@_code']] = m['@_nb'];
            return acc;
        }, {}) : {},
    }));

    const races: Race[] = data.RACES[0].R.map((r: any): Race => ({
        code: r['@_code'],
        nom: r['@_nom'],
        couleur: r['@_couleur'],
    }));

    const merchandises: Merchandise[] = data.MARCHANDISES[0].M.map((m: any): Merchandise => ({
        code: m['@_code'],
        nom: m['@_nom'],
    }));

    const buildingCharacteristics: Characteristic[] = data.CARACTERISTIQUES_BATIMENT[0].C.map((c: any): Characteristic => ({
        code: c['@_code'],
        nom: c['@_nom'],
    }));

    const componentCharacteristics: Characteristic[] = data.CARACTERISTIQUES_COMPOSANT[0].C.map((c: any): Characteristic => ({
        code: c['@_code'],
        nom: c['@_nom'],
    }));

    return {
        technologies,
        races,
        merchandises,
        buildingCharacteristics,
        componentCharacteristics,
    };
};

export const parseRapport = (xmlData: string): Rapport => {
    const parsed = parser.parse(xmlData);
    const rapport = parsed.Rapport;
    const commandant = rapport.Commandant[0];

    const systems: System[] = commandant.systemes[0].S.map((s: any): System => ({
        ...s['@_'],
        planetes: s.PLANETES[0].P.map((p: any): Planet => ({
            ...p['@_'],
        })),
        proprio: [],
    }));

    const fleets: Fleet[] = commandant.flottes[0].F.map((f: any): Fleet => ({
        ...f['@_'],
        vaisseaux: f.VAISSEAU.map((v: any): Vaisseau => ({
            ...v['@_'],
        })),
    }));

    const detectedSystems: System[] = commandant.detection[0].SYSTEME.map((s: any): System => ({
        ...s['@_'],
        planetes: [],
        proprio: s.PROPRIO.map((p: any) => p['#text']),
    }));

    const detectedFleets: Fleet[] = commandant.detection[0].FLOTTE.map((f: any): Fleet => ({
        ...f['@_'],
        vaisseaux: [],
    }));

    const player: Player = {
        nom: commandant.Infos[0].nom[0]['#text'],
        race: commandant.Infos[0].race[0]['#text'],
        reputation: commandant.Infos[0].reputation[0]['#text'],
        statut: commandant.Infos[0].statut[0]['#text'],
        puissance: commandant.Infos[0].puissance[0]['#text'],
        argent: commandant.Infos[0].argent[0]['#text'],
        capitale: commandant.Infos[0].capitale[0]['#text'],
        systems,
        fleets,
        detectedSystems,
        detectedFleets,
    };

    return {
        player,
    };
};
