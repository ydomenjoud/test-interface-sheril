import { parseRapportXml } from './parseRapport';

describe('parseRapportXml - XML lowercase only', () => {
  const xml = `
    <rapport numtour="8" version="1.152">
      <commandant capitale="0_4_5" grade="comte" nom="mab" numero="1" planetes="127" puissance="100563" race="1" reputation="85" statut="neutre">
        <systemes>
          <s nom="pavbzyb" pos="0_1_2" typeetoile="8" nombrepla="17">
            <planetes>
              <p num="0" pdc="1" stockmin="28">
                <batiment code="minei" nombre="3" />
                <population race="1" popact="523" />
              </p>
            </planetes>
          </s>
          <s nom="syqo" pos="0_4_5" typeetoile="0" nbpla="18">
            <planetes>
              <p num="1" pdc="2" stockmin="42">
                <batiment code="minei" nombre="4" />
              </p>
            </planetes>
          </s>
        </systemes>

        <detection>
          <systeme nbpla="18" nom="pyj" pos="0_6_2" typeetoile="3">
            <proprio>14</proprio>
          </systeme>
          <flotte nbvso="36" nom="bimzor 2" num="4" pos="0_7_39" proprio="3" puiss="grande"/>
        </detection>

        <flottes>
          <f nom="flotte de départ" num="0" pos="0_4_6">
            <vaisseau plan="intercepteur standard" type="intercepteur standard"/>
          </f>
        </flottes>
      </commandant>
    </rapport>
  `;

  it('extrait les systèmes du joueur avec typeetoile exact (sans +1), nom, pos et nombrepla', () => {
    const res = parseRapportXml(xml);
    expect(res.systemesJoueur).toHaveLength(2);

    const s1 = res.systemesJoueur[0];
    expect(s1.nom).toBe('pavbzyb');
    expect(s1.pos).toEqual({ x: 1, y: 2 });
    expect(s1.typeEtoile).toBe(8);
    expect(s1.nbPla).toBe(17);
    expect(s1.planetes[0].batiments[0]).toEqual({ techCode: 'minei', count: 3 });

    const s2 = res.systemesJoueur[1];
    expect(s2.pos).toEqual({ x: 4, y: 5 });
    expect(s2.typeEtoile).toBe(0);
    expect(s2.nbPla).toBe(18); // lu via nbpla
  });

  it('extrait les systèmes détectés en lowercase et lit typeetoile correctement', () => {
    const res = parseRapportXml(xml);
    expect(res.systemesDetectes).toHaveLength(1);
    const d1 = res.systemesDetectes[0];
    expect(d1.nom).toBe('pyj');
    expect(d1.pos).toEqual({ x: 6, y: 2 });
    expect(d1.typeEtoile).toBe(3);
    expect(d1.nbPla).toBe(18);
    expect(d1.proprietaires).toEqual([14]);
  });

  it('extrait les flottes (joueur et détectées) avec les champs essentiels', () => {
    const res = parseRapportXml(xml);

    expect(res.flottesJoueur).toHaveLength(1);
    expect(res.flottesJoueur[0]).toMatchObject({
      type: 'joueur',
      num: 0,
      nom: 'flotte de départ',
      pos: { x: 4, y: 6 },
    });
    expect(res.flottesJoueur[0].vaisseaux[0]).toMatchObject({
      type: 'intercepteur standard',
      plan: 'intercepteur standard',
    });

    expect(res.flottesDetectees).toHaveLength(1);
    expect(res.flottesDetectees[0]).toMatchObject({
      type: 'detecte',
      num: 4,
      nom: 'bimzor 2',
      pos: { x: 7, y: 39 },
      proprio: 3,
      puiss: 'grande',
    });
  });
});

describe('parseRapportXml - conservation des systèmes détectés entre tours', () => {
  it("conserve les systèmes détectés d'un tour précédent et remplace par position", () => {
    const xmlTour3 = `
      <rapport numtour="3" version="1.152">
        <commandant capitale="0_1_1" grade="comte" nom="mab" numero="1" planetes="0" puissance="0" race="1" reputation="0" statut="neutre">
          <detection>
            <systeme nbpla="10" nom="Ancien" pos="0_6_2" typeetoile="1">
              <proprio>9</proprio>
            </systeme>
          </detection>
        </commandant>
      </rapport>
    `;
    const res3 = parseRapportXml(xmlTour3);
    expect(res3.systemesDetectes).toHaveLength(1);
    expect(res3.systemesDetectes[0]).toMatchObject({ nom: 'Ancien', pos: { x: 6, y: 2 }, typeEtoile: 1, nbPla: 10, proprietaires: [9] });

    const xmlTour4 = `
      <rapport numtour="4" version="1.152">
        <commandant capitale="0_1_1" grade="comte" nom="mab" numero="1" planetes="0" puissance="0" race="1" reputation="0" statut="neutre">
          <detection>
            <systeme nbpla="12" nom="Mis à jour" pos="0_6_2" typeetoile="5">
              <proprio>14</proprio>
            </systeme>
            <systeme nbpla="7" nom="Nouveau" pos="0_8_8" typeetoile="3">
              <proprio>2</proprio>
            </systeme>
          </detection>
        </commandant>
      </rapport>
    `;
    const res4 = parseRapportXml(xmlTour4);
    // Nous devons avoir 2 systèmes: l'ancien (remplacé) et le nouveau
    expect(res4.systemesDetectes).toHaveLength(2);

    // Trouver par position
    const byKey = (x: number, y: number) => res4.systemesDetectes.find(s => s.pos.x === x && s.pos.y === y)!;
    const maj = byKey(6, 2);
    expect(maj).toMatchObject({ nom: 'Mis à jour', typeEtoile: 5, nbPla: 12, proprietaires: [14] });

    const nouveau = byKey(8, 8);
    expect(nouveau).toMatchObject({ nom: 'Nouveau', typeEtoile: 3, nbPla: 7, proprietaires: [2] });
  });
});
