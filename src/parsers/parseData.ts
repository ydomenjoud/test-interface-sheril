import {GlobalData, Marchandise, Commandant, Race, Technologie} from '../types';

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
        techs.push({
            base, code, niv, nom, type, recherche, description, parents, caracteristiques, marchandises,
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


    return {
        politiques,
        technologies: techs, commandants, races, marchandises, caracteristiquesBatiment, caracteristiquesComposant,
    };
}
