import {messageToPlain, parseCombatMessages, stripHtml} from './parseCombatMessages';

const HTML_SPATIAL =
  "Combat en <span style='color:#dc3a3a'>Vaxonu(<FONT color='#AC0DFE'>21-9 s(9)</FONT>)</span> entre votre flotte <span style='color:#dc3a3a'>Oyaada(22)</span> et la flottille <span style='color:#dc3a3a'>Flotte neutre(152)</span> du commandant <span style='color:#dc3a3a'><span class='neutre'>neutre</span></span>.résultat de combat:<BR>";

describe('parseCombatMessages', () => {
  const spatialHeader =
    "Combat en Wbta(21-8 s(3)) entre votre flotte Z_P_2(6) et la flottille Flotte neutre(45) du commandant neutre.résultat de combat:";
  const planetaryHeader =
    'Combat entre votre flotte A_Y_2(9) et certaines planètes du système Wbta(21-8 s(3)). Vous avez pris 9 planète(s).';

  it('extrait un combat spatial avec position et flottes', () => {
    const combats = parseCombatMessages([
      {type: 'EVT', text: spatialHeader, html: spatialHeader, index: 0},
      {type: 'EVT', text: 'La flotte ennemie est détruite.', html: 'La flotte ennemie est détruite.', index: 1},
      {type: 'EVT', text: 'Votre flotte bouge.', html: 'Votre flotte bouge.', index: 2},
    ]);
    expect(combats).toHaveLength(1);
    expect(combats[0].kind).toBe('spatial');
    expect(combats[0].pos).toEqual({x: 21, y: 8});
    expect(combats[0].playerFleet).toContain('Z_P_2');
    expect(combats[0].enemyFleet).toContain('Flotte neutre');
    expect(combats[0].details).toHaveLength(2);
  });

  it('extrait un combat planétaire avec planètes capturées', () => {
    const combats = parseCombatMessages([
      {type: 'EVT', text: planetaryHeader, html: planetaryHeader, index: 0},
    ]);
    expect(combats).toHaveLength(1);
    expect(combats[0].kind).toBe('planetary');
    expect(combats[0].pos).toEqual({x: 21, y: 8});
    expect(combats[0].planetsCaptured).toBe(9);
  });

  it('regroupe les messages de détail HTML', () => {
    const tableHtml = "<span><TABLE><TR><TD>Chasseur</TD></TR></TABLE></span>";
    const combats = parseCombatMessages([
      {type: 'EVT', text: spatialHeader, html: spatialHeader, index: 0},
      {type: 'EVT', text: 'Résultat du combat:', html: 'Résultat du combat:', index: 1},
      {type: 'EVT', text: '', html: tableHtml, index: 2},
    ]);
    expect(combats[0].details.length).toBeGreaterThanOrEqual(3);
  });

  it('stripHtml enlève les balises', () => {
    expect(stripHtml('<span>Combat</span> en <b>test</b>')).toBe('Combat en test');
  });

  it('parse un combat spatial avec HTML imbriqué (message réel)', () => {
    const combats = parseCombatMessages([
      {type: 'EVT', text: HTML_SPATIAL, html: HTML_SPATIAL, index: 0},
    ]);
    expect(combats).toHaveLength(1);
    expect(combats[0].pos).toEqual({x: 21, y: 9});
    expect(combats[0].systemName).toBe('Vaxonu');
    expect(combats[0].playerFleet).toContain('Oyaada');
    expect(combats[0].summary).toContain('Oyaada');
    expect(combats[0].summary).not.toContain('<span');
    expect(messageToPlain(HTML_SPATIAL)).not.toContain('<');
  });
});
