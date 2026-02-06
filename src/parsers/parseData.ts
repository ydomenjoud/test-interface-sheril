import {
    Batiment, CaracteristiqueBatiment,
    Commandant,
    GlobalData,
    Marchandise,
    PlanVaisseau,
    Race,
    Technologie,
    VaisseauTailleRule
} from '../types';
import {getAttr, getAttrNum, qAll, qOne} from './parseRapport';

export function parseDataXml(text: string): GlobalData {
    const doc = new DOMParser().parseFromString(text, 'text/xml');

    const technologies: Technologie[] = [];
    qAll(doc, ['technologies > t']).forEach((t) => {
        const caracteristiques: { code: number; value: number }[] = [];
        qAll(t, ['caracteristique']).forEach((c) => {
            caracteristiques.push({
                code: getAttrNum(c, ['code']),
                value: getAttrNum(c, ['value']),
            });
        });

        const marchandises: { code: number; nb: number }[] = [];
        qAll(t, ['marchandise']).forEach((m) => {
            marchandises.push({
                code: getAttrNum(m, ['code']),
                nb: getAttrNum(m, ['nb']),
            });
        });

        const parents: string[] = [];
        qAll(t, ['parent']).forEach((p) => {
            parents.push(getAttr(p, ['code']));
        });

        const specification = qOne(t, ['specification']);

        technologies.push({
            base: getAttr(t, ['base']),
            code: getAttr(t, ['code']),
            niv: getAttrNum(t, ['niv']),
            nom: getAttr(t, ['nom']),
            type: getAttrNum(t, ['type']) as any,
            recherche: getAttrNum(t, ['recherche']),
            description: qOne(t, ['description'])?.textContent || undefined,
            parents,
            caracteristiques,
            marchandises,
            specification: specification ? {
                case: getAttrNum(specification, ['case']),
                min: getAttrNum(specification, ['min']),
                prix: getAttrNum(specification, ['prix']),
                type: getAttr(specification, ['type']),
            } : undefined,
        });
    });

    const commandants: Commandant[] = [];
    qAll(doc, ['commandants > c']).forEach((c) => {
        commandants.push({
            numero: getAttrNum(c, ['num']),
            nom: getAttr(c, ['nom']),
            raceId: getAttrNum(c, ['race']),
        });
    });

    const races: Race[] = [];
    qAll(doc, ['races > r']).forEach((r) => {
        races.push({
            id: getAttrNum(r, ['code']),
            nom: getAttr(r, ['nom']),
            couleur: getAttr(r, ['color']),
            graviteSupporte: {min: getAttrNum(r, ['grav_min']), max: getAttrNum(r, ['grav_max'])},
            temperatureSupporte: {min: getAttrNum(r, ['temp_min']), max: getAttrNum(r, ['temp_max'])},
            radiationSupporte: {min: getAttrNum(r, ['rad_min']), max: getAttrNum(r, ['rad_max'])},
        });
    });

    const marchandises: Marchandise[] = [];
    qAll(doc, ['marchandises > m']).forEach((m) => {
        marchandises.push({
            code: getAttrNum(m, ['code']),
            nom: getAttr(m, ['nom']),
        });
    });

    const politiques: Record<number, string> = {};
    qAll(doc, ['politiques > p']).forEach((p) => {
        politiques[getAttrNum(p, ['code'])] = getAttr(p, ['nom']);
    });

    const caracteristiquesBatiment: Record<number, string> = {};
    qAll(doc, ['caracteristiques_batiment > c']).forEach((c) => {
        caracteristiquesBatiment[getAttrNum(c, ['code'])] = getAttr(c, ['nom']);
    });

    const caracteristiquesComposant: Record<number, string> = {};
    qAll(doc, ['caracteristiques_composant > c']).forEach((c) => {
        caracteristiquesComposant[getAttrNum(c, ['code'])] = getAttr(c, ['nom']);
    });

    const plansPublic: PlanVaisseau[] = [];
    qAll(doc, ['planpublic > p']).forEach((p) => {
        const composants = qAll(p, ['comp']).map((c) => ({
            code: getAttr(c, ['code']),
            nb: getAttrNum(c, ['nb']),
        }));
        plansPublic.push({
            nom: getAttr(p, ['nom']),
            concepteur: getAttrNum(p, ['concepteur']),
            marque: getAttr(p, ['marque']),
            tour: getAttrNum(p, ['tour']),
            taille: getAttrNum(p, ['taille']),
            vitesse: getAttrNum(p, ['vitesse']),
            pc: getAttrNum(p, ['pc']),
            minerai: getAttrNum(p, ['minerai']),
            prix: getAttrNum(p, ['centaures', 'prix']),
            ap: getAttrNum(p, ['ap']),
            as: getAttrNum(p, ['as']),
            royalties: getAttrNum(p, ['royalties']),
            composants,
        });
    });

    const tailleVaisseaux: VaisseauTailleRule[] = [];
    qAll(doc, ['taille_vaisseaux > t']).forEach((t) => {
        tailleVaisseaux.push({
            minCase: getAttrNum(t, ['min']),
            maxCase: getAttrNum(t, ['max']),
            taille: getAttrNum(t, ['taille']),
            vitesse: getAttrNum(t, ['vitesse']),
        });
    });

    const batiments: Batiment[] = [];
    qAll(doc, ['technologies > t']).forEach((t) => {
        const caracteristiques: { code: number; value: number }[] = [];
        qAll(t, ['caracteristique']).forEach((c) => {
            caracteristiques.push({
                code: getAttrNum(c, ['code']),
                value: getAttrNum(c, ['value']),
            });
        });

        const specification = t.querySelector('specification');

        batiments.push({
            code: getAttr(t, ['code']),
            nom: getAttr(t, ['nom']),
            arme: getAttr(specification, ['arme']),
            structure: getAttrNum(specification, ['structure']),
            caracteristiques,
        });
    });

    const caracteristiques: CaracteristiqueBatiment[] = [];
    qAll(doc, ['caracteristiques_batiment > c']).forEach((c) => {
        caracteristiques.push({
            code: getAttrNum(c, ['code']),
            nom: getAttr(c, ['nom']),
        });
    });

    return {
        commandants,
        technologies,
        races,
        marchandises,
        politiques,
        caracteristiquesBatiment: caracteristiques,
        caracteristiquesComposant,
        plansPublic,
        tailleVaisseaux,
        batiments
    };
}
