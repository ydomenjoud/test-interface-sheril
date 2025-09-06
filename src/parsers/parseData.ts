import { GlobalData, Marchandise, Race, Technologie } from '../types';

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
      code: Number(c.getAttribute('code') || 0),
      value: Number(c.getAttribute('value') || 0),
    }));
    techs.push({
      base, code, niv, nom, type, recherche, description, parents, caracteristiques,
    });
  });

  const races: Race[] = [];
  const fallbackCouleurs = ['#CC00FF', '#0066CC', '#FFCC00', '#CC0033', '#009933', '#777777'];
  doc.querySelectorAll('data > races > race')?.forEach((r, idx) => {
    races.push({
      id: Number(r.getAttribute('code') || r.getAttribute('id') || idx + 1),
      nom: r.getAttribute('nom') || `Race ${idx + 1}`,
      couleur: r.getAttribute('couleur') || fallbackCouleurs[(idx) % fallbackCouleurs.length],
    });
  });

  const marchandises: Marchandise[] = [];
  doc.querySelectorAll('data > marchandises > marchandise')?.forEach(m => {
    marchandises.push({
      code: Number(m.getAttribute('code') || 0),
      nom: m.getAttribute('nom') || 'Marchandise',
    });
  });

  const caracteristiquesBatiment: Record<number, string> = {};
  doc.querySelectorAll('data > caracteristiques_batiment > caracteristique')?.forEach(c => {
    const code = Number(c.getAttribute('code') || 0);
    const nom = c.getAttribute('nom') || '';
    caracteristiquesBatiment[code] = nom;
  });

  const caracteristiquesComposant: Record<number, string> = {};
  doc.querySelectorAll('data > caracteristiques_composant > caracteristique')?.forEach(c => {
    const code = Number(c.getAttribute('code') || 0);
    const nom = c.getAttribute('nom') || '';
    caracteristiquesComposant[code] = nom;
  });

  return {
    technologies: techs,
    races,
    marchandises,
    caracteristiquesBatiment,
    caracteristiquesComposant,
  };
}
