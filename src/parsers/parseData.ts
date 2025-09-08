import {GlobalData, Marchandise, Commandant, Race, Technologie, PlanVaisseau, VaisseauTailleRule} from '../types';

export function parseDataXml(text: string): GlobalData {
    const doc = new DOMParser().parseFromString(text, 'text/xml');
    const techs: Technologie[] = [];
    doc.querySelectorAll('data > technologies > t')?.forEach(t => {
        const base = t.getAttribute('base') || '';
        const code = t.getAttribute('code') || '';
        const niv = Number(t.getAttribute('niv') || 0);
        const nom = t.getAttribute('nom') || '';
        const type = Number(t.getAttribute('type') || 0) as 0 | 1;
        const recherche = Number(t.getAttribute('recherche') || 0);
        const description = t.querySelector('description')?.textContent?.trim() || undefined;
        const parents: string[] = [];
        t.querySelectorAll('parent')?.forEach(p => {
            const c = p.getAttribute('code');
            if (c) parents.push(c);
        });
        const caracteristiques = Array.from(t.querySelectorAll('caracteristique')).map(c => ({
            code: Number(c.getAttribute('code') || 0), value: Number(c.getAttribute('value') || 0),
        }));
        const marchandises = Array.from(t.querySelectorAll('marchandise')).map(m => ({
            code: Number(m.getAttribute('code') || 0),
            nb: Number(m.getAttribute('nb') || 0),
        }));
        // Spécification (case/min/prix/type) si présente
        const specEl = t.querySelector('specification');
        const specification = specEl ? {
            case: specEl.getAttribute('case') != null ? Number(specEl.getAttribute('case')) || 0 : undefined,
            min: specEl.getAttribute('min') != null ? Number(specEl.getAttribute('min')) || 0 : undefined,
            prix: specEl.getAttribute('prix') != null ? Number(specEl.getAttribute('prix')) || 0 : undefined,
            type: specEl.getAttribute('type') || undefined,
        } : undefined;

        techs.push({
            base, code, niv, nom, type, recherche, description, parents, caracteristiques, marchandises, specification,
        });
    });

    const races: Race[] = [];
    doc.querySelectorAll('data > races > r')?.forEach((r, idx) => {
        races.push({
            id: Number(r.getAttribute('code') || r.getAttribute('id') || idx + 1),
            nom: r.getAttribute('nom') || `Race ${idx + 1}`,
            couleur: r.getAttribute('color') || 'white',
        });
    });

    const marchandises: Marchandise[] = [];
    doc.querySelectorAll('data > marchandises > m')?.forEach(m => {
        marchandises.push({
            code: Number(m.getAttribute('code') || 0), nom: m.getAttribute('nom') || 'Marchandise',
        });
    });

    const caracteristiquesBatiment: Record<number, string> = {};
    doc.querySelectorAll('data > caracteristiques_batiment > c')?.forEach(c => {
        const code = Number(c.getAttribute('code') || 0);
        const nom = c.getAttribute('nom') || '';
        caracteristiquesBatiment[code] = nom;
    });

    const caracteristiquesComposant: Record<number, string> = {};
    doc.querySelectorAll('data > caracteristiques_composant > c')?.forEach(c => {
        const code = Number(c.getAttribute('code') || 0);
        const nom = c.getAttribute('nom') || '';
        caracteristiquesComposant[code] = nom;
    });

    const commandants: Commandant[] = [];
    doc.querySelectorAll('data > commandants > c')?.forEach((r, idx) => {
        commandants.push({
            numero: Number(r.getAttribute('num')),
            nom: r.getAttribute('nom') || 'non trouvé',
            raceId: Number(r.getAttribute('race') || 0),
        });
    });
    const politiques: Record<number, string> = {};
    doc.querySelectorAll('data > politiques > p')?.forEach(c => {
        const code = Number(c.getAttribute('code') || 0);
        const nom = c.getAttribute('nom') || '';
        politiques[code] = nom;
    });

    // Plans de vaisseaux publics
    const plansPublic: PlanVaisseau[] = [];
    doc.querySelectorAll('data > planpublic > p')?.forEach(p => {
        const nom = p.getAttribute('nom') || '';
        const concepteur = Number(p.getAttribute('concepteur') || 0);
        const marque = p.getAttribute('marque') || undefined;
        const tour = Number(p.getAttribute('tour') || 0) || undefined;
        const taille = Number(p.getAttribute('taille') || 0) || undefined;
        const vitesse = Number(p.getAttribute('vitesse') || 0) || undefined;
        const pc = Number(p.getAttribute('pc') || 0) || undefined;
        const minerai = Number(p.getAttribute('minerai') || 0) || undefined;
        const prix = Number(p.getAttribute('centaures') || p.getAttribute('prix') || 0) || undefined;
        const ap = Number(p.getAttribute('ap') || 0) || undefined;
        const as = Number(p.getAttribute('as') || 0) || undefined;
        const royalties = Number(p.getAttribute('royalties') || 0) || undefined;

        const composants = Array.from(p.querySelectorAll('comp')).map(c => ({
            code: c.getAttribute('code') || '',
            nb: Number(c.getAttribute('nb') || 0),
        }));

        plansPublic.push({
            nom, concepteur, marque, tour, taille, vitesse, pc, minerai, prix, ap, as, royalties, composants,
        });
    });

    // Règles de taille des vaisseaux
    const tailleVaisseaux: VaisseauTailleRule[] = [];
    doc.querySelectorAll('data > taille_vaisseaux > t')?.forEach(t => {
        const minCase = Number(t.getAttribute('mincase') ?? t.getAttribute('min_cases') ?? t.getAttribute('min') ?? 0);
        const maxCase = Number(t.getAttribute('maxcase') ?? t.getAttribute('max_cases') ?? t.getAttribute('max') ?? 0);
        const taille = Number(t.getAttribute('taille') ?? 0);
        const vitesse = Number(t.getAttribute('vitesse') ?? t.getAttribute('vit') ?? 0);
        tailleVaisseaux.push({ minCase, maxCase, taille, vitesse });
    });
    tailleVaisseaux.sort((a, b) => a.minCase - b.minCase);

    return {
        politiques,
        technologies: techs, commandants, races, marchandises, caracteristiquesBatiment, caracteristiquesComposant, plansPublic, tailleVaisseaux,
    };
}
